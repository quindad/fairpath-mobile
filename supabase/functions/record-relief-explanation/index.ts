// Edge Function entry for record-relief-explanation: Signal explains a member's own Record Relief case results
// in plain English -- using ONLY the case's own already-evaluated data (the real rule engine's outcome,
// reasons, missing inputs, countdown), never generating new legal conclusions of its own. Same real flow:
// auth -> spend_ai_credits -> gateway -> safety guard -> text.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { runSignalCall } from '../_shared/core/ai-gateway/run.ts';
import { resolveSignalChain } from '../_shared/core/ai-gateway/signal-chains.ts';

const WORKFLOW = WORKFLOWS.member_signal;
const COST = 1;

type Evaluation = {
  outcome: string; remedy: string | null; eligibility_date: string | null; days_remaining: number | null;
  missing_inputs: string[]; reasons: { code: string; text: string }[];
  rule: null | { title: string; citation_text: string; last_verified_at: string | null };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });

  let body: { case_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  if (!body.case_id) return json(400, { error: 'missing_case_id' });

  const { data: caseRow, error: caseError } = await userClient.from('record_relief_cases').select('label,jurisdiction_code,out_of_state_conviction').eq('id', body.case_id).maybeSingle();
  if (caseError || !caseRow) return json(404, { error: 'case_not_found' });

  const { data: detail, error: detailError } = await userClient.rpc('get_record_relief_case_detail', { p_case: body.case_id });
  if (detailError || !detail) return json(400, { error: 'detail_lookup_failed' });

  const evaluations = (detail.evaluations ?? []) as Evaluation[];
  const evalText = evaluations.length
    ? evaluations.map((e) => `- ${e.rule?.title ?? 'Unverified rule'}: outcome "${e.outcome}"${e.remedy ? `, remedy ${e.remedy}` : ''}${e.eligibility_date ? `, eligible on ${e.eligibility_date}` : ''}${e.days_remaining != null ? `, ${e.days_remaining} days remaining` : ''}. Reasons: ${e.reasons.map((r) => r.text).join('; ') || 'none given'}.${e.missing_inputs.length ? ` Still needs: ${e.missing_inputs.join(', ')}.` : ''}${e.rule ? ` Source: ${e.rule.citation_text}.` : ''}`).join('\n')
    : 'No eligibility check has been run on this case yet.';

  const { chain, adapters, capabilities } = resolveSignalChain('fast');

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters, capabilities,
    input: {
      system: 'You are FairPath Signal, explaining a member\'s own Record Relief case results in plain English. This is NOT legal advice and you are not a lawyer. You may ONLY restate and explain the outcome, reasons, and dates already given to you by FairPath\'s rule engine -- never invent a legal conclusion, a law, a form, or a deadline not given to you. Never say something is guaranteed, certain, or will definitely happen. Always remind the member to confirm anything important with a court clerk or legal aid before acting. Keep it under 180 words.',
      user: `Case: ${caseRow.label} (${caseRow.jurisdiction_code})\n\nEligibility results from FairPath's rule engine:\n${evalText}\n\nExplain this to the member in plain English: what it means, and what's still needed.`,
    },
  });
});
