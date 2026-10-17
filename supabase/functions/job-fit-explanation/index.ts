// Edge Function entry for job-fit-explanation: the first live FairPath Signal workflow a member can trigger.
// Flow: verify the caller's own JWT -> spend an AI credit via spend_ai_credits() (the real rate-limit system,
// see docs/proposed-migrations/20261013020000_ai_credit_rate_limit_DRAFT.sql) -> run the gateway -> guard the
// output -> return text. No provider key configured yet means runWorkflow naturally returns {ok:false}, and the
// caller gets an honest fallback, never a crash and never a fabricated answer.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { anthropicChain, runSignalCall } from '../_shared/core/ai-gateway/run.ts';

const WORKFLOW = WORKFLOWS.job_fit_explanation;
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
    .select('title,company_name,description,requirements,skills,background_policy_summary,employment_type,workplace_type')
    .eq('id', body.job_id)
    .maybeSingle();
  if (jobError || !job) return json(404, { error: 'job_not_found' });

  const { data: profile } = await userClient.from('profiles').select('full_name,experience_summary').maybeSingle();

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('SIGNAL_MODEL') ?? 'claude-sonnet-5';
  const { chain, adapters } = anthropicChain(apiKey, model);

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters,
    input: {
      system: 'You are FairPath Signal, explaining to a job seeker (often with a past conviction) why a specific job listing might or might not fit them, in plain, encouraging, honest language. Never state a hiring decision, a score, or a guarantee. Only explain fit based on the listed requirements versus their background. Keep it under 150 words.',
      user: `Job: ${job.title} at ${job.company_name}\nDescription: ${job.description ?? ''}\nRequirements: ${(job.requirements ?? []).join(', ')}\nBackground policy: ${job.background_policy_summary ?? 'not specified'}\n\nApplicant background: ${profile?.experience_summary ?? 'not provided'}\n\nExplain, in plain language, how this applicant's background lines up with this job's requirements.`,
    },
  });
});
