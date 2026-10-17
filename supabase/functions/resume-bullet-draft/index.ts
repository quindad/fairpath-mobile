// Edge Function entry for resume-bullet-draft: Signal strengthens resume bullet points the member already
// wrote -- rephrasing for clarity and impact, never inventing an accomplishment, employer, number, or
// responsibility the member didn't mention. The member reviews and can edit/reject before saving. Same real
// flow: auth -> spend_ai_credits -> gateway -> safety guard -> text.
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

  let body: { job_title?: string; employer?: string; bullets?: string[]; target_role?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const jobTitle = (body.job_title ?? '').trim().slice(0, 120);
  const employer = (body.employer ?? '').trim().slice(0, 120);
  const bullets = (body.bullets ?? []).map((b) => (b ?? '').trim()).filter(Boolean).slice(0, 15);
  if (!bullets.length) return json(400, { error: 'missing_bullets' });

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('SIGNAL_MODEL') ?? 'claude-sonnet-5';
  const { chain, adapters } = anthropicChain(apiKey, model);

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters,
    input: {
      system: 'You are FairPath Signal, strengthening resume bullet points a member already wrote about their own work. Rephrase each bullet to be clear, specific, and action-oriented. You may NEVER invent a number, accomplishment, responsibility, or outcome the member did not mention -- only clarify and strengthen the wording of what they actually gave you. If a bullet is too vague to strengthen honestly, lightly clean up the grammar instead of inventing detail. Return one improved bullet per line, same count and order as given, no numbering, no extra commentary.',
      user: `Job title: ${jobTitle || 'not given'}\nEmployer: ${employer || 'not given'}\n${body.target_role ? `Target role they're applying toward: ${body.target_role}\n` : ''}\nTheir bullets, as written:\n${bullets.map((b) => '- ' + b).join('\n')}\n\nReturn the improved bullets, one per line.`,
    },
  });
});
