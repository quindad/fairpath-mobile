// Edge Function entry for credit-report-explanation: Signal explains, in plain English, either one flagged
// review item or the member's whole credit workspace -- using only the member's own already-extracted data
// (never a raw uploaded file; that is credit-report-extraction's job). Sensitive workflow: the chain hop is
// explicitly marked sensitiveApproved so the gateway doesn't drop it. Same real flow: auth -> spend_ai_credits
// -> gateway -> safety guard -> text.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { anthropicChain, runSignalCall } from '../_shared/core/ai-gateway/run.ts';

const WORKFLOW = WORKFLOWS.credit_report_explanation;
const COST = 1;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });

  let body: { item_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }

  let context: string;
  if (body.item_id) {
    const { data: item, error: itemError } = await userClient.from('credit_review_items').select('issue_type,stage,title,explanation,evidence,account_id,member_statement').eq('id', body.item_id).maybeSingle();
    if (itemError || !item) return json(404, { error: 'item_not_found' });
    const account = item.account_id ? (await userClient.from('credit_accounts').select('furnisher_name,payment_status,balance_cents,account_type').eq('id', item.account_id).maybeSingle()).data : null;
    context = `One flagged item on this member's credit report:\nTitle: ${item.title}\nIssue type: ${item.issue_type}\nStage: ${item.stage}\nFairPath's rule explanation: ${item.explanation}\nEvidence: ${JSON.stringify(item.evidence)}\n${item.member_statement ? 'Member statement: ' + item.member_statement + '\n' : ''}${account ? `Account: ${account.furnisher_name}, status ${account.payment_status}, balance ${account.balance_cents}` : ''}`;
  } else {
    const [accountsRes, itemsRes] = await Promise.all([
      userClient.from('credit_accounts').select('furnisher_name,payment_status,balance_cents,account_type,is_collection,is_charged_off').limit(50),
      userClient.from('credit_review_items').select('title,issue_type,stage').limit(50),
    ]);
    const accounts = accountsRes.data ?? [];
    const items = itemsRes.data ?? [];
    context = `This member's credit workspace.\nAccounts (${accounts.length}): ${accounts.map((a: { furnisher_name: string; payment_status: string; balance_cents: number }) => `${a.furnisher_name} (${a.payment_status}, balance ${a.balance_cents})`).join('; ') || 'none yet'}\nFlagged items (${items.length}): ${items.map((i: { title: string; stage: string }) => `${i.title} [${i.stage}]`).join('; ') || 'none yet'}`;
  }

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('SIGNAL_MODEL') ?? 'claude-sonnet-5';
  const { chain, adapters } = anthropicChain(apiKey, model, true);

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters,
    input: {
      system: 'You are FairPath Signal, explaining a member\'s own credit report data back to them in plain English. You may only describe and explain what is in the data given to you -- never invent accounts, numbers, or facts not present. Never state a credit score, a risk score, a number out of 100, or any prediction of what a score will become. Never say something "is" or "will be" approved, denied, or guaranteed. Explain what things mean and what questions are worth asking, not what will happen. Keep it under 180 words.',
      user: `${context}\n\nExplain this to the member in plain English.`,
    },
  });
});
