// extract-credit-report: reads a member's OWN uploaded credit report (PDF/photo) with an extraction engine and stores the
// result as candidates for MEMBER REVIEW. It never decides anything is inaccurate and never invents data.
//
// SAFETY MODEL
//  * Off by default: nothing is read or sent anywhere unless an operator enables an engine AND the member consents in
//    the request (consent is explicit because the file is sent to the engine provider).
//  * Signed-in members only, and only for an upload they own (checked through their JWT, so RLS applies).
//  * The engine output is untrusted: validateExtraction() is the only path into the database, and only last-4 digits survive.
//  * Nothing from the file or the engine is ever logged or echoed back; errors are short codes.
import { validateExtraction, type ExtractionPayload } from '../_shared/core/credit/extraction.ts';

export type UploadRef = { id: string; status: string; mime_type: string; byte_size: number; storage_path: string | null };
export type ExtractDeps = {
  enabled(): boolean;
  getUserId(authHeader: string | null): Promise<string | null>;
  getOwnUpload(uploadId: string): Promise<UploadRef | null>;
  download(path: string): Promise<Uint8Array | null>;
  /** Returns the engine's raw (untrusted) structured output, or null when the engine could not read the file. */
  runEngine(bytes: Uint8Array, mime: string): Promise<unknown | null>;
  ingest(uploadId: string, payload: ExtractionPayload): Promise<string>;
  markFailed(uploadId: string, code: string): Promise<void>;
  now(): Date;
};
export type ExtractResponse = { status: number; body: Record<string, unknown> };

const MAX_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleExtract(method: string, authHeader: string | null, rawBody: string, deps: ExtractDeps): Promise<ExtractResponse> {
  if (method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } };
  const userId = await deps.getUserId(authHeader);
  if (!userId) return { status: 401, body: { error: 'unauthorized' } };
  if (!deps.enabled()) return { status: 503, body: { error: 'extraction_not_enabled' } };
  if (rawBody.length > 1000) return { status: 413, body: { error: 'request_too_large' } };
  let body: { upload_id?: unknown; consent?: unknown };
  try { body = JSON.parse(rawBody); } catch { return { status: 400, body: { error: 'invalid_json' } }; }
  const uploadId = String(body.upload_id ?? '');
  if (!UUID.test(uploadId)) return { status: 400, body: { error: 'invalid_upload_id' } };
  if (body.consent !== true) return { status: 400, body: { error: 'consent_required' } };

  const up = await deps.getOwnUpload(uploadId);
  if (!up || up.status === 'deleted' || !up.storage_path) return { status: 404, body: { error: 'upload_unavailable' } };
  if (up.status === 'needs_review' || up.status === 'extracted') return { status: 409, body: { error: 'already_read' } };
  if (up.byte_size > MAX_BYTES) { await deps.markFailed(uploadId, 'file_too_large'); return { status: 413, body: { error: 'file_too_large' } }; }

  const bytes = await deps.download(up.storage_path);
  if (!bytes || bytes.length === 0) { await deps.markFailed(uploadId, 'file_unreadable'); return { status: 422, body: { error: 'file_unreadable' } }; }
  let raw: unknown;
  try { raw = await deps.runEngine(bytes, up.mime_type); } catch { await deps.markFailed(uploadId, 'engine_error'); return { status: 502, body: { error: 'engine_error' } }; }
  if (raw === null || raw === undefined) { await deps.markFailed(uploadId, 'nothing_extracted'); return { status: 422, body: { error: 'nothing_extracted' } }; }

  const outcome = validateExtraction(raw, deps.now());
  if (!outcome.ok) { await deps.markFailed(uploadId, outcome.reason); return { status: 422, body: { error: outcome.reason } }; }
  const reportId = await deps.ingest(uploadId, outcome.payload);
  // Counts only: never any account content.
  return { status: 200, body: { report_id: reportId, accounts: outcome.payload.accounts.length, inquiries: outcome.payload.inquiries.length, skipped_fields: outcome.dropped.length, needs_member_review: true } };
}
