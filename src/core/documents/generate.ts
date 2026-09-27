import { supabase } from '@/lib/supabase';
import { base64ToBytes } from '@/core/documents/bytes';
import { buildContactSheet, buildRequiredDocumentsChecklist, buildSavedResourcesList, type ResourceForDoc } from '@/core/documents/builders/resources';
import {
  DEFAULT_PROFILE_OPTIONS, buildOpportunityProfile, decodeProfileOptions, profileExportReady, type OpportunityProfileOptions,
} from '@/core/documents/builders/opportunity-profile';
import { documentTypeInfo } from '@/core/documents/document-types';
import { registerDeviceDocument, type DocumentRow } from '@/core/documents/document-service';
import { MIME, fingerprintOf, toCsv, type DocBlock, type DocFormat, type DocumentSpec } from '@/core/documents/spec';
import { loadProfileForDocument } from '@/core/profile/opportunity-service';
import { loadResourceCategories, loadSavedResourceDetails } from '@/core/resources/resources-service';

/**
 * Document generation orchestration.
 *
 *  1. SERVER first: the render-document Edge Function derives the content from the member's own confirmed data
 *     (client-supplied content is never accepted), renders it and registers the version (generated_by = 'server').
 *  2. DEVICE fallback (clearly labelled): when the function is not deployed/reachable, the SAME pure builders and
 *     renderers run on the device and the version is registered as generated_by = 'device'. Device generation can
 *     never produce an official form (the database refuses it).
 * Both paths use one DocumentSpec, so the preview the member reviews equals what is exported.
 */
export type RenderableType = 'saved_resources_list' | 'resource_contact_sheet' | 'resource_required_documents' | 'opportunity_profile';
export const RENDERABLE: RenderableType[] = ['saved_resources_list', 'resource_contact_sheet', 'resource_required_documents', 'opportunity_profile'];

export type GeneratedDocument = {
  row: DocumentRow;
  bytes: Uint8Array;
  fileName: string;
  mime: string;
  format: DocFormat;
  preview: { title: string; blocks: DocBlock[]; footer: string };
  generatedBy: 'server' | 'device';
  fingerprint: string;
};

let serverDownUntil = 0;
const SERVER_RETRY_MS = 10 * 60 * 1000;

async function loadResourceInputs(): Promise<{ resources: ResourceForDoc[]; labels: Record<string, string> }> {
  const [details, cats] = await Promise.all([loadSavedResourceDetails(), loadResourceCategories().catch(() => [])]);
  return { resources: details as unknown as ResourceForDoc[], labels: Object.fromEntries(cats.map((c) => [c.slug, c.label])) };
}

/** Builds the spec on the device from the member's own data (used for the preview and for the device fallback). */
export async function buildSpec(type: RenderableType, profileOptions: OpportunityProfileOptions = DEFAULT_PROFILE_OPTIONS): Promise<DocumentSpec> {
  if (type === 'opportunity_profile') return buildOpportunityProfile(await loadProfileForDocument(), profileOptions);
  const { resources, labels } = await loadResourceInputs();
  if (type === 'saved_resources_list') return buildSavedResourcesList(resources, labels);
  if (type === 'resource_contact_sheet') return buildContactSheet(resources);
  return buildRequiredDocumentsChecklist(resources);
}

/** Can this document be produced right now? Reasons are shown to the member; nothing is faked as ready. */
export async function readinessFor(type: RenderableType): Promise<{ ready: boolean; reason: string }> {
  if (type === 'opportunity_profile') return profileExportReady(await loadProfileForDocument());
  const details = await loadSavedResourceDetails();
  return details.length ? { ready: true, reason: '' } : { ready: false, reason: 'Save at least one resource first.' };
}

/** Fingerprint of what the document would contain today (for "changed since you generated it"). */
export async function currentFingerprint(type: RenderableType, optionsCode?: string | null): Promise<string> {
  const options = type === 'opportunity_profile' ? decodeProfileOptions(optionsCode) ?? DEFAULT_PROFILE_OPTIONS : DEFAULT_PROFILE_OPTIONS;
  return fingerprintOf((await buildSpec(type, options)).inputs);
}

async function renderOnDevice(spec: DocumentSpec, format: DocFormat): Promise<Uint8Array> {
  if (format === 'pdf') return (await import('@/core/documents/render-pdf')).renderPdf(spec);
  if (format === 'docx') return (await import('@/core/documents/render-docx')).renderDocx(spec);
  if (!spec.csv) throw new Error('CSV_UNAVAILABLE');
  return new TextEncoder().encode(toCsv(spec.csv.columns, spec.csv.rows));
}

async function tryServer(type: RenderableType, format: DocFormat, profileOptions: OpportunityProfileOptions): Promise<GeneratedDocument | 'unavailable'> {
  if (Date.now() < serverDownUntil) return 'unavailable';
  const { data, error } = await supabase.functions.invoke('render-document', {
    body: { document_type: type, format, options: type === 'opportunity_profile' ? profileOptions : undefined },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    // 4xx that mean "you may not do this" are real answers; anything else means the server path is not usable right now.
    if (status === 400 || status === 401 || status === 403 || status === 413) throw new Error('SERVER_REFUSED:' + status);
    serverDownUntil = Date.now() + SERVER_RETRY_MS;
    return 'unavailable';
  }
  const r = data as { document: DocumentRow; file_name: string; mime: string; file_base64: string; spec: GeneratedDocument['preview']; input_fingerprint: string };
  if (!r?.file_base64) { serverDownUntil = Date.now() + SERVER_RETRY_MS; return 'unavailable'; }
  return {
    row: { ...r.document, has_stored_copy: false }, bytes: base64ToBytes(r.file_base64), fileName: r.file_name, mime: r.mime, format,
    preview: r.spec, generatedBy: 'server', fingerprint: r.input_fingerprint,
  };
}

export async function generateDocument(type: RenderableType, format: DocFormat, profileOptions: OpportunityProfileOptions = DEFAULT_PROFILE_OPTIONS): Promise<GeneratedDocument> {
  const info = documentTypeInfo(type);
  if (!info || !info.formats.includes(format)) throw new Error('FORMAT_NOT_AVAILABLE');
  const server = await tryServer(type, format, profileOptions);
  if (server !== 'unavailable') return server;

  const spec = await buildSpec(type, profileOptions);
  const bytes = await renderOnDevice(spec, format);
  const fingerprint = fingerprintOf(spec.inputs);
  const row = await registerDeviceDocument({
    documentType: spec.documentType, sourceModule: spec.sourceModule, sourceRecordId: spec.sourceRecordId, subject: spec.subject, title: spec.title, format,
    kind: spec.kind, templateId: spec.templateId, templateVersion: spec.templateVersion, sensitivity: spec.sensitivity, fingerprint,
    confirmedDataAt: spec.confirmedDataAt, optionsCode: spec.optionsCode,
  });
  return { row, bytes, fileName: row.file_name, mime: MIME[format], format, preview: { title: spec.title, blocks: spec.blocks, footer: spec.footer }, generatedBy: 'device', fingerprint };
}

/**
 * Generic DEVICE generation for a spec the caller already built from the member's confirmed data (credit letters,
 * record-relief worksheets...). Registered as generated_by = 'device'; the database refuses official-form claims from here.
 */
export async function generateFromSpec(spec: DocumentSpec, format: DocFormat, packet?: { position: number; total: number }): Promise<GeneratedDocument> {
  const info = documentTypeInfo(spec.documentType);
  if (!info || !info.formats.includes(format)) throw new Error('FORMAT_NOT_AVAILABLE');
  const bytes = await renderOnDevice(spec, format);
  const fingerprint = fingerprintOf(spec.inputs);
  const row = await registerDeviceDocument({
    documentType: spec.documentType, sourceModule: spec.sourceModule, sourceRecordId: spec.sourceRecordId, subject: spec.subject, title: spec.title, format,
    kind: spec.kind, templateId: spec.templateId, templateVersion: spec.templateVersion, sensitivity: spec.sensitivity, fingerprint,
    confirmedDataAt: spec.confirmedDataAt, optionsCode: spec.optionsCode, packet,
  });
  return { row, bytes, fileName: row.file_name, mime: MIME[format], format, preview: { title: spec.title, blocks: spec.blocks, footer: spec.footer }, generatedBy: 'device', fingerprint };
}
