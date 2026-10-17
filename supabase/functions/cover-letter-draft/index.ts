// Edge Function: first-draft cover letter for a job listing. Member edits before sending — never auto-submits.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { runSignalCall } from '../_shared/core/ai-gateway/run.ts';
import { resolveSignalChain } from '../_shared/core/ai-gateway/signal-chains.ts';

const WORKFLOW = WORKFLOWS.job_writer;
const COST = 2;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });

  let body: { job_id?: string; highlights?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  if (!body.job_id) return json(400, { error: 'missing_job_id' });

  const { data: job, error: jobError } = await userClient
    .from('jobs')
    .select('title,company_name,description,requirements,skills,employment_type,workplace_type')
    .eq('id', body.job_id)
    .maybeSingle();
  if (jobError || !job) return json(404, { error: 'job_not_found' });

  const { data: profile } = await userClient.from('profiles').select('full_name,experience_summary').maybeSingle();
  const highlights = (body.highlights ?? '').trim().slice(0, 800);

  const { chain, adapters, capabilities } = resolveSignalChain('quality');

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters, capabilities,
    input: {
      system: 'You are FairPath Signal, drafting a FIRST cover letter for a job seeker (often with a past conviction) to review, edit, and send themselves. Write in first person as the applicant. Use only facts from the applicant background and optional highlights they provided — never invent employers, degrees, dates, or accomplishments. Be professional, specific to the role, and honest. Never guarantee an interview or hire. End with a short reminder that the member should verify every detail before sending. Keep under 250 words.',
      user: `Job: ${job.title} at ${job.company_name}\nWorkplace: ${job.workplace_type}\nEmployment: ${job.employment_type}\nDescription: ${job.description ?? ''}\nRequirements: ${(job.requirements ?? []).join(', ')}\nSkills mentioned: ${(job.skills ?? []).join(', ')}\n\nApplicant name: ${profile?.full_name ?? 'Applicant'}\nBackground summary: ${profile?.experience_summary ?? 'not provided'}\nMember highlights to include (optional): ${highlights || 'none'}\n\nWrite the cover letter body (greeting through sign-off).`,
    },
  });
});
