// Edge Function entry for marketplace-listing-draft: Signal writes a clear, honest description for a free
// item a member wants to give away, from their own rough notes -- never inventing condition, features, or
// facts about the item they didn't mention. Same real flow: auth -> spend_ai_credits -> gateway -> safety
// guard -> text.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { runSignalCall } from '../_shared/core/ai-gateway/run.ts';
import { resolveSignalChain } from '../_shared/core/ai-gateway/signal-chains.ts';

const WORKFLOW = WORKFLOWS.marketplace_listing_draft;
const COST = 1;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });

  let body: { title?: string; notes?: string; category?: string; condition?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const title = (body.title ?? '').trim().slice(0, 120);
  const notes = (body.notes ?? '').trim().slice(0, 500);
  if (!title && !notes) return json(400, { error: 'missing_details' });

  const { chain, adapters, capabilities } = resolveSignalChain('fast');

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters, capabilities,
    input: {
      system: 'You are FairPath Signal, writing a clear, honest, friendly description for a free item a member is giving away on FairPath Marketplace. Use ONLY the details given to you -- never invent condition, brand, features, age, or dimensions the member didn\'t mention. If something important is missing (like condition), note that it is not specified rather than guessing. Keep it under 80 words, plain and welcoming.',
      user: `Title: ${title || 'not given'}\nCategory: ${body.category ?? 'not given'}\nCondition: ${body.condition ?? 'not given'}\nMember's notes about the item: "${notes || 'none'}"\n\nWrite the listing description.`,
    },
  });
});
