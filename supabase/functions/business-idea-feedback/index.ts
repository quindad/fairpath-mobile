// Edge Function entry for business-idea-feedback: Signal gives honest, practical feedback on a member's own
// business idea as they work through the Startup Academy track -- no funding promise, no guaranteed success,
// just grounded next-step thinking. Same real flow: auth -> spend_ai_credits -> gateway -> safety guard -> text.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { runSignalCall } from '../_shared/core/ai-gateway/run.ts';
import { resolveSignalChain } from '../_shared/core/ai-gateway/signal-chains.ts';

const WORKFLOW = WORKFLOWS.member_signal;
const COST = 1;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });

  let body: { idea?: string; current_step?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const idea = (body.idea ?? '').trim().slice(0, 800);
  if (!idea) return json(400, { error: 'missing_idea' });

  const { chain, adapters, capabilities } = resolveSignalChain('fast');

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters, capabilities,
    input: {
      system: 'You are FairPath Signal, giving honest, encouraging, practical feedback on a member\'s own small business idea as they work through a self-paced startup track. Point out one real strength and one real open question or risk to think through, grounded only in what they described. Never promise funding, a grant, or success. Never invent market facts, numbers, or competitors you weren\'t told about. Keep it under 150 words.',
      user: `Member's business idea: "${idea}"\n${body.current_step ? `Current track step: ${body.current_step}\n` : ''}\nGive honest, practical feedback.`,
    },
  });
});
