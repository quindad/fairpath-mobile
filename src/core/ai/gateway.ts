import { supabase } from '@/lib/supabase';
import type { AiGateway, Provenance } from '@/core/ai/orchestrator';
import { loadAccounts, loadItems } from '@/core/credit/credit-service';
import { loadMemberSummary } from '@/core/profile/member-summary';
import { loadCompletion } from '@/core/profile/opportunity-service';
import { loadCases } from '@/core/record-relief/relief-service';
import { isSignedIn, resolveResourceNeeds } from '@/core/resources/resources-service';

/**
 * The assistant's ONLY window into member data: read-only loaders that already run under the member's own RLS.
 * There is no write function here (audited), no raw table access beyond these, and no free-form SQL.
 */
export const gateway: AiGateway = {
  signedIn: isSignedIn,
  summary: loadMemberSummary,
  profileCompletion: async () => (await loadCompletion()).map((s) => ({ section_key: s.section_key, label: s.label, is_complete: s.is_complete, sort_order: s.sort_order })),
  needs: async (text) => (await resolveResourceNeeds(text)).map((n) => ({ need_slug: n.need_slug, label: n.label, urgent: n.urgent })),
  creditItems: async () => (await loadItems()).map((i) => ({ id: i.id, account_id: i.account_id, stage: i.stage, issue_type: i.issue_type, title: i.title, explanation: i.explanation, origin: i.origin })),
  creditAccountsToConfirm: async () => (await loadAccounts()).filter((a) => a.extraction_state === 'needs_review' || a.extraction_state === 'extracted').length,
  reliefCases: async () => (await loadCases()).map((c) => ({ id: c.id, label: c.label })),
  upcomingMeetings: async () => {
    const r = await supabase.from('member_meetings').select('id,title,start_at').neq('status', 'cancelled').gte('start_at', new Date().toISOString()).order('start_at', { ascending: true }).limit(5);
    return (r.data ?? []) as { id: string; title: string; start_at: string }[];
  },
  resumeCount: async () => {
    const r = await supabase.from('member_resumes').select('id', { count: 'exact', head: true });
    return r.count ?? 0;
  },
  reliefEvaluations: async () => {
    const evals = await supabase.from('record_relief_evaluations').select('id,case_id,outcome,eligibility_date,rule_key,rule_version').eq('superseded', false);
    return ((evals.data ?? []) as { id: string; case_id: string; outcome: never; eligibility_date: string | null; rule_key: string | null; rule_version: number | null }[]).map((e) => ({
      ...e,
      days_remaining: e.eligibility_date ? Math.max(0, Math.round((Date.parse(e.eligibility_date) - Date.now()) / 86400000)) : null,
    }));
  },
};

/** Best-effort provenance log (ids, rule versions and official sources only; never text). Failure never blocks the answer. */
export async function logInteraction(p: Provenance): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('log_ai_interaction', {
      p_task: p.task, p_intent: p.intent === ('help' as string) ? 'help' : p.intent, p_engine: p.engine, p_route: p.route && /^\/[a-zA-Z0-9/_\-?=&\[\]]*$/.test(p.route) ? p.route : null,
      p_source_refs: p.sourceRefs.map((r) => ({ kind: r.kind, id: r.id })), p_rule_versions: p.ruleVersions.map((r) => ({ rule_key: r.rule_key, rule_version: r.rule_version })),
      p_official_sources: p.officialSources.map((o) => ({ label: o.label, url: o.url })), p_confidence: p.confidence, p_confirmation: 'not_required',
    });
    return error ? null : (data as string);
  } catch { return null; }
}

export async function deleteAiHistory(): Promise<number> {
  const { data, error } = await supabase.rpc('delete_my_ai_history');
  if (error) throw error;
  return Number(data ?? 0);
}
