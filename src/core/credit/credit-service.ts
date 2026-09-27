import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';
import { sha256Hex } from '@/core/documents/bytes';
import type { ItemStage } from '@/core/credit/credit-format';

/** Credit workspace data access. Reads are owner-only under RLS; every write is a signed-in server function. */
export type CreditReport = { id: string; bureau: string; report_date: string | null; source: 'extracted' | 'manual' | 'fixture'; upload_id: string | null; created_at: string };
export type CreditAccount = {
  id: string; report_id: string; furnisher_name: string; account_type: string; account_last4: string | null; original_creditor: string | null;
  payment_status: string; is_collection: boolean; is_charged_off: boolean; opened_date: string | null; closed_date: string | null;
  last_reported_date: string | null; first_delinquency_date: string | null; balance_cents: number | string | null; credit_limit_cents: number | string | null;
  extraction_state: 'extracted' | 'needs_review' | 'member_confirmed' | 'corrected_by_member'; low_confidence_fields: string[];
  extracted_values: Record<string, unknown> | null; member_says_not_mine: boolean; source: string;
};
export type ReviewItem = {
  id: string; report_id: string; account_id: string | null; issue_type: string; stage: ItemStage; origin: 'rule' | 'ai' | 'member'; title: string;
  explanation: string; evidence: Record<string, unknown>; member_statement: string | null; created_at: string;
};
export type Dispute = {
  id: string; target_kind: 'bureau' | 'furnisher'; target_name: string; reason: string; status: 'draft' | 'sent' | 'response_received' | 'resolved' | 'closed';
  sent_on: string | null; sent_method: string | null; tracking_reference: string | null; response_due_on: string | null; response_received_on: string | null;
  outcome: string | null; outcome_notes: string | null; follow_up_on: string | null; notes: string | null; created_at: string;
};
export type Upload = { id: string; bureau: string; file_kind: string; status: string; page_count: number | null; byte_size: number; expires_at: string; created_at: string; failure_code: string | null };

export function creditErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  const map: [string, string][] = [
    ['SIGNED_OUT', 'Sign in to continue.'], ['STATEMENT_REQUIRED', 'Write in your own words what is wrong (at least a sentence).'],
    ['INVALID_TRANSITION', 'That step is not available for this item right now.'], ['ITEM_IN_ACTIVE_DISPUTE', 'This item is part of a dispute that has been sent, so it cannot be changed.'],
    ['ITEMS_NOT_CONFIRMED', 'Only issues you confirmed can be included in a dispute.'], ['ITEMS_REQUIRED', 'Choose at least one confirmed issue.'],
    ['INVALID_DATE', 'That date is not valid. Use a date that is not in the future.'], ['UNSUPPORTED_TYPE', 'That file type is not supported. Use a PDF, JPG or PNG.'],
    ['FILE_TOO_LARGE', 'That file is too large (15 MB maximum).'], ['TOO_MANY_PAGES', 'That file has too many pages (60 maximum).'], ['UPLOAD_LIMIT', 'You have reached the upload limit. Delete an old upload first.'],
    ['FILE_NOT_UPLOADED', 'The file did not finish uploading. Please try again.'], ['SAMPLE_DATA_DEV_ONLY', 'Sample data is only available in the development environment.'],
    ['SAMPLE_ALREADY_LOADED', 'The sample reports are already loaded.'], ['violates check', 'Please check the values you entered.'],
  ];
  for (const [k, v] of map) if (text.includes(k)) return v;
  return 'Something went wrong. Please try again.';
}

const one = async <T>(q: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> => {
  const { data, error } = await q;
  if (error) throw error;
  return data as T;
};

export const loadReports = () => one<CreditReport[]>(supabase.from('credit_reports').select('*').order('created_at', { ascending: false }));
export const loadAccounts = () => one<CreditAccount[]>(supabase.from('credit_accounts').select('*').order('furnisher_name'));
export const loadAccount = (id: string) => one<CreditAccount>(supabase.from('credit_accounts').select('*').eq('id', id).single());
export const loadItems = () => one<ReviewItem[]>(supabase.from('credit_review_items').select('*').order('created_at', { ascending: false }));
export const loadItem = (id: string) => one<ReviewItem>(supabase.from('credit_review_items').select('*').eq('id', id).single());
export const loadDisputes = () => one<Dispute[]>(supabase.from('credit_disputes').select('*').order('created_at', { ascending: false }));
export const loadUploads = () => one<Upload[]>(supabase.from('credit_report_uploads').select('id,bureau,file_kind,status,page_count,byte_size,expires_at,created_at,failure_code').neq('status', 'deleted').order('created_at', { ascending: false }));

export async function loadDisputeDetail(id: string) {
  const [dispute, links, events, evidence] = await Promise.all([
    one<Dispute>(supabase.from('credit_disputes').select('*').eq('id', id).single()),
    one<{ item_id: string }[]>(supabase.from('credit_dispute_items').select('item_id').eq('dispute_id', id)),
    one<{ event_type: string; created_at: string }[]>(supabase.from('credit_dispute_events').select('event_type,created_at').eq('dispute_id', id).order('created_at')),
    one<{ id: string; description: string; created_at: string }[]>(supabase.from('credit_dispute_evidence').select('id,description,created_at').eq('dispute_id', id).order('created_at')),
  ]);
  return { dispute, itemIds: links.map((l) => l.item_id), events, evidence };
}

const rpcCall = async (fn: string, args: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
};

export const loadSampleReports = () => rpcCall('load_credit_sample_report');
export const createManualReport = (bureau: string, reportDate: string | null) => rpcCall('create_manual_credit_report', { p_bureau: bureau, p_report_date: reportDate }) as Promise<string>;
export const addAccount = (reportId: string, fields: Record<string, unknown>) => rpcCall('add_credit_account', { p_report: reportId, p: fields });
export const confirmAccount = (id: string, corrections: Record<string, unknown> = {}) => rpcCall('confirm_credit_account', { p_id: id, p_corrections: corrections });
export const flagNotMine = (accountId: string, statement: string) => rpcCall('flag_credit_account_not_mine', { p_account: accountId, p_statement: statement });
export const runReview = (reportId: string) => rpcCall('run_credit_review', { p_report: reportId });
export const setItemStage = (itemId: string, stage: ItemStage | 'reopen', statement?: string) => rpcCall('set_credit_item_stage', { p_item: itemId, p_stage: stage, p_statement: statement ?? null });
export const deleteReport = (id: string) => rpcCall('delete_credit_report', { p_id: id });
export const createDispute = (kind: 'bureau' | 'furnisher', name: string, itemIds: string[], reason: string) => rpcCall('create_credit_dispute', { p_target_kind: kind, p_target_name: name, p_item_ids: itemIds, p_reason: reason }) as Promise<Dispute>;
export const markDisputeSent = (id: string, sentOn: string, method: 'mail' | 'online' | 'other', reference: string, windowDays = 30) => rpcCall('mark_credit_dispute_sent', { p_id: id, p_sent_on: sentOn, p_method: method, p_reference: reference || null, p_response_window_days: windowDays });
export const recordDisputeResponse = (id: string, receivedOn: string, outcome: string, notes: string) => rpcCall('record_credit_dispute_response', { p_id: id, p_received_on: receivedOn, p_outcome: outcome, p_notes: notes || null });
export const updateDispute = (id: string, patch: { followUpOn?: string; notes?: string; close?: boolean }) => rpcCall('update_credit_dispute', { p_id: id, p_follow_up_on: patch.followUpOn ?? null, p_notes: patch.notes ?? null, p_close: Boolean(patch.close) });
export const addEvidence = (disputeId: string, description: string) => rpcCall('add_credit_dispute_evidence', { p_dispute: disputeId, p_description: description, p_document: null });
export const deleteDispute = (id: string) => rpcCall('delete_credit_dispute', { p_id: id });

export const extendUploadRetention = (id: string, days: 30 | 90) => rpcCall('extend_credit_upload_retention', { p_id: id, p_days: days });
export async function deleteUpload(id: string): Promise<void> {
  const path = (await rpcCall('delete_credit_upload', { p_id: id })) as string | null;
  if (path) { try { await supabase.storage.from('credit-uploads').remove([path]); } catch { /* the server-side cleanup queue removes it */ } }
}

function uuid(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => { const r = (Math.random() * 16) | 0; return (ch === 'x' ? r : (r & 3) | 8).toString(16); });
}

export type PickedFile = { uri: string; name: string; mimeType: string; size: number };
export async function pickReportFile(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', size: a.size ?? 0 };
}

const EXT_BY_MIME: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif' };

/** Uploads a report to the member's private folder, then registers it (the server verifies the object exists at the exact path). */
export async function uploadReportFile(file: PickedFile, bureau: string): Promise<Upload> {
  const ext = EXT_BY_MIME[file.mimeType];
  if (!ext) throw new Error('UNSUPPORTED_TYPE');
  const user = await currentUser();
  const bytes = new Uint8Array(await (await fetch(file.uri)).arrayBuffer());
  if (bytes.length > 15 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
  let pages: number | null = ext === 'pdf' ? null : 1;
  if (ext === 'pdf') {
    try { pages = (await (await import('pdf-lib')).PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount(); } catch { pages = null; }
    if (pages !== null && pages > 60) throw new Error('TOO_MANY_PAGES');
  }
  const id = uuid();
  const path = `${user.id}/${id}/report.${ext}`;
  const up = await supabase.storage.from('credit-uploads').upload(path, bytes, { contentType: file.mimeType, upsert: false });
  if (up.error) throw up.error;
  const checksum = await sha256Hex(bytes);
  const { data, error } = await supabase.rpc('register_credit_upload', { p_upload_id: id, p_bureau: bureau, p_ext: ext, p_pages: pages, p_bytes: bytes.length, p_mime: file.mimeType, p_checksum: checksum });
  if (error) { try { await supabase.storage.from('credit-uploads').remove([path]); } catch { /* ignore */ } throw error; }
  return data as Upload;
}
