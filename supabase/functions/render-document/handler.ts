// render-document: the server side of the FairPath document engine.
//
// SECURITY MODEL
//  * Signed-in members only. The function never accepts document CONTENT from the client: the request names a
//    document type (+ a few booleans/enums); the function reads the member's own confirmed data through their JWT
//    (RLS applies), builds the spec with the shared pure builders, renders it, and registers the version.
//  * Registration runs with the service role and is what marks a document `generated_by = 'server'`. Only this path
//    can ever attach an official_form_ref, and only from the server-side template registry (none are verified yet).
//  * Nothing is persisted by default. Bytes are returned to the caller; a stored copy exists only if the member later
//    calls keep_document_copy. No request/response bodies are logged.
//  * Audience rules are enforced here again (justice/credit documents can never be prepared for employers/landlords).
//
// The handler takes its dependencies as arguments so it can be tested under Node without Deno or a database.
import { audienceAllowed, documentTypeInfo } from '../_shared/core/documents/document-types.ts';
import { fingerprintOf, MIME, type DocFormat, type DocumentSpec } from '../_shared/core/documents/spec.ts';
import { buildContactSheet, buildRequiredDocumentsChecklist, buildSavedResourcesList, type ResourceForDoc } from '../_shared/core/documents/builders/resources.ts';
import { buildOpportunityProfile, DEFAULT_PROFILE_OPTIONS, type OpportunityProfileData, type OpportunityProfileOptions } from '../_shared/core/documents/builders/opportunity-profile.ts';

export const RENDERABLE_TYPES = ['saved_resources_list', 'resource_contact_sheet', 'resource_required_documents', 'opportunity_profile'] as const;

export type RenderDeps = {
  getUserId(authHeader: string | null): Promise<string | null>;
  loadResources(userId: string): Promise<{ resources: ResourceForDoc[]; categoryLabels: Record<string, string> }>;
  loadProfile(userId: string): Promise<OpportunityProfileData>;
  register(userId: string, spec: DocumentSpec, format: DocFormat): Promise<{ id: string; file_name: string; version: number } & Record<string, unknown>>;
  renderPdf(spec: DocumentSpec): Promise<Uint8Array>;
  renderDocx(spec: DocumentSpec): Promise<Uint8Array>;
  toCsv(columns: string[], rows: string[][]): string;
  sha256(bytes: Uint8Array): Promise<string>;
  now(): Date;
};

export type RenderResponse = { status: number; body: Record<string, unknown> };

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Only known keys, only booleans/enums: anything else in `options` is ignored. */
export function sanitizeProfileOptions(raw: unknown): OpportunityProfileOptions {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (o.sections && typeof o.sections === 'object' ? o.sections : {}) as Record<string, unknown>;
  const d = DEFAULT_PROFILE_OPTIONS;
  const audience = ['self', 'employer', 'caseworker'].includes(o.audience as string) ? (o.audience as OpportunityProfileOptions['audience']) : 'self';
  return {
    audience,
    includeName: bool(o.includeName, d.includeName),
    includePhone: bool(o.includePhone, d.includePhone),
    includeEmail: bool(o.includeEmail, d.includeEmail),
    includeZip: bool(o.includeZip, d.includeZip),
    includePay: bool(o.includePay, d.includePay),
    sections: {
      experience: bool(s.experience, d.sections.experience),
      education: bool(s.education, d.sections.education),
      credentials: bool(s.credentials, d.sections.credentials),
      skills: bool(s.skills, d.sections.skills),
      preferences: bool(s.preferences, d.sections.preferences),
      availability: bool(s.availability, d.sections.availability),
      transportation: bool(s.transportation, d.sections.transportation),
    },
  };
}

export async function handleRender(method: string, authHeader: string | null, rawBody: string, deps: RenderDeps): Promise<RenderResponse> {
  if (method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } };
  const userId = await deps.getUserId(authHeader);
  if (!userId) return { status: 401, body: { error: 'unauthorized' } };
  if (rawBody.length > 4000) return { status: 413, body: { error: 'request_too_large' } };

  let body: { document_type?: unknown; format?: unknown; options?: unknown };
  try { body = JSON.parse(rawBody); } catch { return { status: 400, body: { error: 'invalid_json' } }; }

  const type = String(body.document_type ?? '');
  const format = String(body.format ?? '') as DocFormat;
  const info = documentTypeInfo(type);
  if (!info || !(RENDERABLE_TYPES as readonly string[]).includes(type)) return { status: 400, body: { error: 'unknown_document_type' } };
  if (!info.formats.includes(format)) return { status: 400, body: { error: 'format_not_available', formats: info.formats } };

  const now = deps.now();
  let spec: DocumentSpec;
  if (type === 'opportunity_profile') {
    const requested = (body.options && typeof body.options === 'object' ? (body.options as Record<string, unknown>).audience : undefined);
    // An explicit audience that is not allowed is refused (never silently downgraded to "self").
    if (requested !== undefined && !audienceAllowed(type, String(requested) as never)) return { status: 403, body: { error: 'audience_not_allowed' } };
    const options = sanitizeProfileOptions(body.options);
    if (!audienceAllowed(type, options.audience)) return { status: 403, body: { error: 'audience_not_allowed' } };
    const data = await deps.loadProfile(userId);
    spec = buildOpportunityProfile(data, options, now);
  } else {
    const { resources, categoryLabels } = await deps.loadResources(userId);
    spec = type === 'saved_resources_list' ? buildSavedResourcesList(resources, categoryLabels, now)
      : type === 'resource_contact_sheet' ? buildContactSheet(resources, now)
      : buildRequiredDocumentsChecklist(resources, now);
  }

  // Server-generated documents never carry an official form reference until a verified template registry exists.
  spec.officialFormRef = null;

  let bytes: Uint8Array;
  if (format === 'pdf') bytes = await deps.renderPdf(spec);
  else if (format === 'docx') bytes = await deps.renderDocx(spec);
  else {
    if (!spec.csv) return { status: 400, body: { error: 'csv_not_available' } };
    bytes = new TextEncoder().encode(deps.toCsv(spec.csv.columns, spec.csv.rows));
  }

  const row = await deps.register(userId, spec, format);
  const checksum = await deps.sha256(bytes);
  return {
    status: 200,
    body: {
      document: row,
      file_name: row.file_name,
      mime: MIME[format],
      checksum_sha256: checksum,
      byte_size: bytes.length,
      input_fingerprint: fingerprintOf(spec.inputs),
      generated_by: 'server',
      spec: { title: spec.title, blocks: spec.blocks, footer: spec.footer },
      file_base64: toBase64(bytes),
    },
  };
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}
