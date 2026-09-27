import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';
import { sha256Hex } from '@/core/documents/bytes';
import { MIME, type DocFormat, type DocSensitivity } from '@/core/documents/spec';

export type DocumentRow = {
  id: string;
  document_type: string;
  source_module: string;
  source_record_id: string | null;
  title: string;
  file_name: string;
  format: DocFormat;
  kind: string;
  status: 'ready' | 'expired' | 'failed' | 'deleted';
  version: number;
  supersedes_id: string | null;
  template_id: string;
  template_version: string;
  official_form_ref: unknown;
  generated_by: 'server' | 'device';
  sensitivity: DocSensitivity;
  persist_policy: 'on_demand' | 'history_only' | 'stored';
  input_fingerprint: string;
  confirmed_data_at: string;
  expires_at: string | null;
  created_at: string;
  has_stored_copy: boolean;
  byte_size?: number | null;
  checksum_sha256?: string | null;
  metadata?: { options_code?: string } | null;
};
export type DocumentListItem = { doc: DocumentRow; isLatest: boolean; exportCount: number };

export function documentErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (text.includes('SIGNED_OUT')) return 'Sign in to continue.';
  if (text.includes('DOCUMENT_UNAVAILABLE')) return 'That document is no longer available.';
  if (text.includes('FILE_NOT_UPLOADED')) return 'The file could not be stored. Please try again.';
  if (text.includes('INVALID_RETENTION')) return 'That retention choice is not available for this document.';
  return 'Something went wrong. Please try again.';
}

export async function listMyDocuments(): Promise<DocumentListItem[]> {
  const { data, error } = await supabase.rpc('list_my_documents');
  if (error) throw error;
  return ((data ?? []) as { doc: DocumentRow; is_latest: boolean; export_count: number | string }[]).map((r) => ({ doc: r.doc, isLatest: r.is_latest, exportCount: Number(r.export_count) }));
}

export async function registerDeviceDocument(args: {
  documentType: string; sourceModule: string; sourceRecordId: string | null; subject: string; title: string; format: DocFormat; kind: string;
  templateId: string; templateVersion: string; sensitivity: DocSensitivity; fingerprint: string; confirmedDataAt: string; optionsCode?: string;
}): Promise<DocumentRow> {
  const { data, error } = await supabase.rpc('register_generated_document', {
    p_document_type: args.documentType, p_source_module: args.sourceModule, p_source_record_id: args.sourceRecordId, p_subject: args.subject, p_title: args.title,
    p_format: args.format, p_kind: args.kind, p_template_id: args.templateId, p_template_version: args.templateVersion, p_sensitivity: args.sensitivity,
    p_input_fingerprint: args.fingerprint, p_confirmed_data_at: args.confirmedDataAt, p_metadata: args.optionsCode ? { options_code: args.optionsCode } : {},
    p_official_form_ref: null, p_target_user: null,
  });
  if (error) throw error;
  return { ...(data as DocumentRow), has_stored_copy: false };
}

export async function logDocumentExport(id: string, action: 'preview' | 'download' | 'share_sheet_opened' | 'save_to_files' | 'print' | 'regenerate', platform: 'web' | 'ios' | 'android') {
  // Metadata only; a logging failure must never block the member's export.
  try { await supabase.rpc('log_document_export', { p_id: id, p_action: action, p_platform: platform }); } catch { /* ignore */ }
}

const BUCKET = 'generated-documents';

/** Deletes the FairPath-stored copy and its history entry. A file already exported cannot be recalled. */
export async function deleteDocument(id: string): Promise<void> {
  const { data, error } = await supabase.rpc('delete_generated_document', { p_id: id });
  if (error) throw error;
  const path = data as string | null;
  if (path) { try { await supabase.storage.from(BUCKET).remove([path]); } catch { /* the server-side cleanup queue removes it */ } }
}

/** Uploads the file to the member's own private folder, then records the retention choice server-side. */
export async function keepDocumentCopy(doc: Pick<DocumentRow, 'id' | 'version' | 'format'>, bytes: Uint8Array, days: 30 | 90 | 365): Promise<DocumentRow> {
  const user = await currentUser();
  const path = `${user.id}/${doc.id}/v${doc.version}.${doc.format}`;
  const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: MIME[doc.format], upsert: false });
  if (up.error && !/already exists|Duplicate/i.test(up.error.message)) throw up.error;
  const checksum = await sha256Hex(bytes);
  const { data, error } = await supabase.rpc('keep_document_copy', { p_id: doc.id, p_days: days, p_bytes: bytes.length, p_checksum: checksum ?? '0'.repeat(64) });
  if (error) throw error;
  return { ...(data as DocumentRow), has_stored_copy: true };
}

/** A short-lived (60 second) signed link for a stored copy, minted only on an explicit member action. */
export async function downloadStoredCopy(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw error ?? new Error('NO_URL');
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error('DOWNLOAD_FAILED');
  return new Uint8Array(await res.arrayBuffer());
}

export async function storedPathFor(id: string): Promise<string | null> {
  // storage_path is deliberately not in list_my_documents; members read their own row for the path.
  const { data } = await supabase.from('generated_documents').select('storage_path').eq('id', id).maybeSingle();
  return (data?.storage_path as string | null) ?? null;
}
