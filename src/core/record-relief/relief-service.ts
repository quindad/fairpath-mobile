import { supabase } from '@/lib/supabase';
import type { Outcome } from '@/core/record-relief/relief-format';
import type { ReliefDetailForDoc, ReliefCaseForDoc } from '@/core/documents/builders/record-relief';
import { RECORD_RELIEF_ENGINE_VERSION, daysUntil, getRuleFreshness } from '@/core/record-relief/shared-engine';
import { planRecordReliefEvaluation } from '@/core/record-relief/engine-registry';
import { executeRecordRelief, type EngineFacts } from '@/core/record-relief/engine-executor';
import type { CaseBundle } from '@/core/record-relief/jurisdiction-engine';
import type { CaseDocumentExtraction } from '@/core/record-relief/ai-intake';

/** Record Relief data access. Cases are owner-only; rules/forms/pathways are verified-only reference data. */
export type Jurisdiction = { code: string; name: string; kind: 'state' | 'district' | 'territory' | 'federal' | 'test'; sort_order: number };
export type ReliefCase = Omit<ReliefCaseForDoc, 'jurisdiction_name'> & { notes: string | null; updated_at: string; created_at: string };
export type ReliefEvaluation = {
  id: string; outcome: Outcome; remedy: string | null; eligibility_date: string | null; days_remaining: number | null; inputs_used: Record<string, unknown>;
  missing_inputs: string[]; reasons: { code: string; text: string }[]; rule_stale: boolean; rule_changed: boolean; rule_key: string | null; rule_version: number | null; evaluated_at: string;
  rule: null | {
    title: string; summary: string | null; citation_text: string; source_url: string; source_authority: string; effective_from: string; last_verified_at: string | null; rule_version: number;
    fees: Record<string, unknown>; filing: Record<string, unknown>; required_documents: { key: string; label: string }[]; steps: { key: string; title: string; body?: string }[]; form_keys: string[]; data_origin: string;
  };
};
export type ReliefDetail = Omit<ReliefDetailForDoc, 'evaluations'> & { evaluations: ReliefEvaluation[]; events: { event_type: string; detail: string | null; created_at: string }[] };

export function reliefErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  const map: [string, string][] = [
    ['SIGNED_OUT', 'Sign in to continue.'], ['CASE_LIMIT', 'You have reached the case limit. Delete a case you no longer need.'], ['INVALID_JURISDICTION', 'Choose where the case was heard.'],
    ['INVALID_DATE', 'That date cannot be in the future.'], ['INVALID_STATUS', 'That status is not valid.'], ['violates check', 'Please check the dates and values you entered.'],
  ];
  for (const [k, v] of map) if (text.includes(k)) return v;
  return 'Something went wrong. Please try again.';
}

const one = async <T>(q: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> => {
  const { data, error } = await q;
  if (error) throw error;
  return data as T;
};

export const loadJurisdictions = () => one<Jurisdiction[]>(supabase.from('record_relief_jurisdictions').select('code,name,kind,sort_order').order('sort_order').order('name'));
export const loadCases = () => one<ReliefCase[]>(supabase.from('record_relief_cases').select('*').order('updated_at', { ascending: false }));
export const loadCase = (id: string) => one<ReliefCase>(supabase.from('record_relief_cases').select('*').eq('id', id).single());

/** Jurisdictions that currently have at least one verified rule (so the UI can be honest about coverage). */
export async function loadCoveredJurisdictions(): Promise<Set<string>> {
  const rows = await one<{ jurisdiction_code: string }[]>(supabase.from('record_relief_rules').select('jurisdiction_code'));
  return new Set(rows.map((r) => r.jurisdiction_code));
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}
export const loadCaseDetail = (id: string) => call<ReliefDetail>('get_record_relief_case_detail', { p_case: id });
export const saveCase = (id: string | null, payload: Record<string, unknown>) => call<ReliefCase>('save_record_relief_case', { p_id: id, p: payload });
export const reevaluateCase = (id: string) => call<unknown>('evaluate_record_relief_case', { p_case: id });
/** Plans a substantive evaluation through the shared 57-authority registry before persistence/RPC reconciliation. */
export const planSharedEvaluation = (caseBundle: CaseBundle, facts: Record<string, unknown> = {}) => planRecordReliefEvaluation(caseBundle, facts);
/** Executes the same substantive engine intended for mobile, web API, and Command Center consumers. */
export const executeSharedEvaluation = (caseBundle: CaseBundle, facts: EngineFacts = {}) => executeRecordRelief(caseBundle, facts);
export const setCaseStatus = (id: string, status: string, filedOn?: string | null) => call<ReliefCase>('set_record_relief_case_status', { p_id: id, p_status: status, p_filed_on: filedOn ?? null });
export const toggleChecklist = (id: string, kind: 'step' | 'document', key: string, done: boolean) => call<void>('toggle_record_relief_checklist', { p_case: id, p_kind: kind, p_key: key, p_done: done });
export const deleteCase = (id: string) => call<void>('delete_record_relief_case', { p_id: id });

/** Latest (non-superseded) evaluations for many cases, for list rows. Owner-only via RLS. */
export async function loadCurrentEvaluations(): Promise<Record<string, { outcome: Outcome; eligibility_date: string | null }[]>> {
  const rows = await one<{ case_id: string; outcome: Outcome; eligibility_date: string | null }[]>(supabase.from('record_relief_evaluations').select('case_id,outcome,eligibility_date').eq('superseded', false));
  const out: Record<string, { outcome: Outcome; eligibility_date: string | null }[]> = {};
  for (const r of rows) (out[r.case_id] ??= []).push({ outcome: r.outcome, eligibility_date: r.eligibility_date });
  return out;
}

/** Shared lifecycle metadata used by mobile now and by web/API consumers of the same engine contract. */
export function enrichEvaluationLifecycle(e: ReliefEvaluation, jurisdictionCode: string, asOf = new Date()) {
  const freshness = getRuleFreshness(jurisdictionCode, asOf);
  const eligibilityDate = e.eligibility_date;
  return {
    ...e,
    days_remaining: daysUntil(eligibilityDate, asOf),
    rule_stale: e.rule_stale || freshness?.stale === true,
    engine_version: RECORD_RELIEF_ENGINE_VERSION,
    next_rule_review_on: freshness?.nextReviewOn ?? null,
    needs_recalculation: e.rule_changed || e.rule_stale || freshness?.stale === true || (eligibilityDate ? daysUntil(eligibilityDate, asOf) === 0 : false),
  };
}
export type RecordReliefExtractionResult = { extraction: CaseDocumentExtraction; upload_id: string; model_version: string; extracted_at: string };
/** Server-side AI document reader. Raw files stay behind authenticated storage; explicit consent is required per extraction. */
export async function extractRecordReliefCase(uploadId: string, consent: true): Promise<RecordReliefExtractionResult> {
  if (consent !== true) throw new Error('consent_required');
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('SIGNED_OUT');
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('service_unavailable');
  const res = await fetch(`${base}/functions/v1/extract-record-relief-case`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ upload_id: uploadId, consent: true }) });
  const body = await res.json();
  if (!res.ok) throw new Error(String(body?.error ?? 'engine_error'));
  return body as RecordReliefExtractionResult;
}

