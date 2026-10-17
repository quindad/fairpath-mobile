// Edge Function entry for academy-lesson-question: Signal answers a member's follow-up question about a real
// FairPath-authored Academy lesson -- grounded ONLY in that lesson's own text (sent by the client, since
// course content lives in the app bundle, not the database). Never answers beyond what the lesson itself
// says, and never gives legal advice beyond what the lesson already states. Same real flow: auth ->
// spend_ai_credits -> gateway -> safety guard -> text.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { anthropicChain, runSignalCall } from '../_shared/core/ai-gateway/run.ts';

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

  let body: { lesson_title?: string; lesson_body?: string; question?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const lessonTitle = (body.lesson_title ?? '').trim().slice(0, 200);
  const lessonBody = (body.lesson_body ?? '').trim().slice(0, 3000);
  const question = (body.question ?? '').trim().slice(0, 400);
  if (!lessonBody || !question) return json(400, { error: 'missing_fields' });

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('SIGNAL_MODEL') ?? 'claude-sonnet-5';
  const { chain, adapters } = anthropicChain(apiKey, model);

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters,
    input: {
      system: 'You are FairPath Signal, answering a member\'s follow-up question about an Academy lesson they just read. Answer using ONLY the lesson text given to you -- you may explain, rephrase, or expand on what it already says, but never introduce a new legal claim, law, or fact not present in the lesson. If the question asks something the lesson doesn\'t cover (like a specific state\'s law), say so plainly and suggest they check FairPath\'s Record Relief tool or a legal aid organization, rather than guessing. Keep it under 150 words.',
      user: `Lesson: ${lessonTitle}\n\nLesson text:\n${lessonBody}\n\nMember's question: "${question}"`,
    },
  });
});
