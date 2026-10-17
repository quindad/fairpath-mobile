// Edge Function entry for interview-prep: Signal generates likely interview questions and short practice-answer
// guidance for a specific job a member applied to, grounded in the job's real posting and the member's own
// background. Never invents facts about the employer not in the listing. Same real flow: auth ->
// spend_ai_credits -> gateway -> safety guard -> text.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { anthropicChain, runSignalCall } from '../_shared/core/ai-gateway/run.ts';

const WORKFLOW = WORKFLOWS.candidate_preparation;
const COST = 1;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });

  let body: { job_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  if (!body.job_id) return json(400, { error: 'missing_job_id' });

  const { data: job, error: jobError } = await userClient
    .from('jobs')
    .select('title,company_name,description,requirements,skills,employment_type,workplace_type,background_policy_summary')
    .eq('id', body.job_id)
    .maybeSingle();
  if (jobError || !job) return json(404, { error: 'job_not_found' });

  const { data: profile } = await userClient.from('profiles').select('experience_summary').maybeSingle();

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('SIGNAL_MODEL') ?? 'claude-sonnet-5';
  const { chain, adapters } = anthropicChain(apiKey, model);

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters,
    input: {
      system: 'You are FairPath Signal, helping a job seeker (often with a past conviction) prepare for an interview. Generate 4-6 realistic interview questions for this specific role based only on the listing given to you, plus a short coaching tip for each on how to answer well, including how to briefly and confidently address a record if asked, without over-explaining or being defensive. Never invent facts about the employer or guarantee an outcome. Keep the whole response under 250 words, as a simple list.',
      user: `Job: ${job.title} at ${job.company_name}\nDescription: ${job.description ?? ''}\nRequirements: ${(job.requirements ?? []).join(', ')}\nBackground policy: ${job.background_policy_summary ?? 'not specified'}\n\nApplicant background: ${profile?.experience_summary ?? 'not provided'}\n\nGenerate likely interview questions with brief coaching tips.`,
    },
  });
});
