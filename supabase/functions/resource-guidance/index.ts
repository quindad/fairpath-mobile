// Edge Function entry for resource-guidance: Signal helps a member figure out what to do next -- especially
// useful when there's no job match available yet -- by pointing at REAL FairPath resource categories (fetched
// from the live table, never invented) based on what the member describes in their own words. Same real flow
// as the other Signal workflows: auth -> spend_ai_credits -> gateway -> safety guard -> text.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { runSignalCall } from '../_shared/core/ai-gateway/run.ts';
import { resolveSignalChain } from '../_shared/core/ai-gateway/signal-chains.ts';

const WORKFLOW = WORKFLOWS.program_scout;
const COST = 1;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });

  let body: { situation?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const situation = (body.situation ?? '').trim().slice(0, 600);
  if (!situation) return json(400, { error: 'missing_situation' });

  const { data: categories } = await userClient.from('resource_categories').select('slug,label,description').limit(60);
  const categoryList = (categories ?? []).map((c: { slug: string; label: string; description: string | null }) => `${c.slug}: ${c.label}${c.description ? ' — ' + c.description : ''}`).join('\n');

  const { chain, adapters, capabilities } = resolveSignalChain('fast');

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters, capabilities,
    input: {
      system: 'You are FairPath Signal, helping someone (often recently out of incarceration, and often with no job match available to them yet) figure out what practical help to look for right now. You may ONLY point to the resource categories listed below -- never invent a program, agency, or category that is not listed. Recommend 1-3 category slugs from the list and briefly say why, in plain, encouraging, non-judgmental language. Never promise an outcome or say something is guaranteed to help. Keep it under 150 words.',
      user: `Available FairPath resource categories (slug: label — description):\n${categoryList || 'none loaded'}\n\nWhat the member said about their situation: "${situation}"\n\nWhich category slugs should they look at, and why?`,
    },
  });
});
