// Edge Function entry for veteran-experience-translation: when FairPath has no human-reviewed civilian
// translation for a member's occupation code, Signal helps them describe their OWN military duties in
// civilian-resume language instead -- it never claims a specific code-to-role mapping as fact (that stays
// reviewed-only, per the existing design in veterans.tsx), it only rephrases what the member actually
// describes. Same real flow: auth -> spend_ai_credits -> gateway -> safety guard -> text.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { anthropicChain, runSignalCall } from '../_shared/core/ai-gateway/run.ts';

const WORKFLOW = WORKFLOWS.resume_bullet_draft;
const COST = 1;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });

  let body: { duties?: string; branch?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const duties = (body.duties ?? '').trim().slice(0, 800);
  if (!duties) return json(400, { error: 'missing_duties' });

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('SIGNAL_MODEL') ?? 'claude-sonnet-5';
  const { chain, adapters } = anthropicChain(apiKey, model);

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters,
    input: {
      system: 'You are FairPath Signal, helping a veteran describe their own military duties in civilian-resume language for job applications. Rephrase ONLY what they tell you -- never invent a job title, certification, or responsibility they didn\'t mention, and never claim their occupation code officially corresponds to any specific civilian role (that requires human review FairPath hasn\'t done for this code). Return 3-5 resume-style bullet points describing transferable skills. Keep it under 150 words.',
      user: `Branch: ${body.branch ?? 'not given'}\nWhat they did, in their own words: "${duties}"\n\nRephrase this as civilian-resume bullet points.`,
    },
  });
});
