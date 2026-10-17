// Edge Function entry for dispute-letter-draft: Signal writes a FIRST DRAFT of a dispute letter body from
// issues the member has already confirmed themselves. The member reviews and edits it before sending -- this
// function never sends, mails, or submits anything. Same real flow: auth -> spend_ai_credits -> gateway ->
// safety guard -> text.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { anthropicChain, runSignalCall } from '../_shared/core/ai-gateway/run.ts';

const WORKFLOW = WORKFLOWS.dispute_letter_draft;
const COST = 1;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });

  let body: { item_ids?: string[]; target_kind?: 'bureau' | 'furnisher'; target_name?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const itemIds = (body.item_ids ?? []).filter((x) => typeof x === 'string').slice(0, 10);
  const targetName = (body.target_name ?? '').trim();
  if (!itemIds.length || !targetName || !body.target_kind) return json(400, { error: 'missing_fields' });

  const { data: items, error: itemsError } = await userClient
    .from('credit_review_items')
    .select('title,issue_type,explanation,member_statement,stage,account_id')
    .in('id', itemIds)
    .eq('stage', 'confirmed_dispute_issue');
  if (itemsError) return json(400, { error: 'items_lookup_failed' });
  if (!items || items.length !== itemIds.length) return json(409, { error: 'items_not_confirmed', detail: 'Only issues you confirmed as inaccurate can be drafted into a dispute letter.' });

  const accountIds = items.map((i: { account_id: string | null }) => i.account_id).filter(Boolean) as string[];
  const { data: accounts } = accountIds.length ? await userClient.from('credit_accounts').select('id,furnisher_name,account_last4').in('id', accountIds) : { data: [] };
  const accountName = (id: string | null) => accounts?.find((a: { id: string }) => a.id === id)?.furnisher_name ?? '';

  const issueList = items.map((i: { title: string; issue_type: string; member_statement: string | null; account_id: string | null }) =>
    `- ${accountName(i.account_id) || i.title} (${i.issue_type}): ${i.member_statement ?? i.title}`,
  ).join('\n');

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('SIGNAL_MODEL') ?? 'claude-sonnet-5';
  const { chain, adapters } = anthropicChain(apiKey, model);

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters,
    input: {
      system: 'You are FairPath Signal, writing a FIRST DRAFT of a credit dispute letter body for a member to review, edit, and send themselves. Write it as a formal, factual letter body (no letterhead needed) addressed to the named recipient, citing the specific items being disputed exactly as given, in the member\'s own described terms -- never add facts, dates, or amounts not given to you. Request investigation and correction or removal per the Fair Credit Reporting Act, in plain respectful language. Never claim the dispute will succeed or guarantee any outcome. End with a line reminding the member to review every detail before sending. Keep it under 300 words.',
      user: `Recipient: ${targetName} (${body.target_kind === 'bureau' ? 'credit bureau' : 'furnisher/company'})\n\nItems being disputed, in the member's own words:\n${issueList}\n\nWrite the dispute letter body.`,
    },
  });
});
