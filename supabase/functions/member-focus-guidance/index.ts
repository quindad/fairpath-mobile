// Edge Function entry for member-focus-guidance: Signal looks at a member's real activity across jobs, housing,
// credit, and Record Relief and suggests what's worth focusing on next -- grounded only in real counts pulled
// from the member's own rows (RLS-scoped), never inventing progress that isn't there. Same real flow: auth ->
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

  const [jobApps, housingApps, creditItems, reliefCases] = await Promise.all([
    userClient.from('job_applications').select('status').in('status', ['started', 'submitted', 'viewed', 'interview']),
    userClient.from('housing_applications').select('status').in('status', ['started', 'submitted', 'reviewing', 'tour']),
    userClient.from('credit_review_items').select('stage').eq('stage', 'possible_inaccuracy'),
    userClient.from('record_relief_cases').select('id'),
  ]);

  const summary = [
    `Job applications in progress: ${jobApps.data?.length ?? 0} (${(jobApps.data ?? []).filter((a: { status: string }) => a.status === 'started').length} unfinished drafts)`,
    `Housing applications in progress: ${housingApps.data?.length ?? 0} (${(housingApps.data ?? []).filter((a: { status: string }) => a.status === 'started').length} unfinished drafts)`,
    `Credit items needing the member's review: ${creditItems.data?.length ?? 0}`,
    `Record Relief cases tracked: ${reliefCases.data?.length ?? 0}`,
  ].join('\n');

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('SIGNAL_MODEL') ?? 'claude-sonnet-5';
  const { chain, adapters } = anthropicChain(apiKey, model);

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters,
    input: {
      system: 'You are FairPath Signal, looking at a member\'s real activity across the app and suggesting what to focus on next. Base this ONLY on the numbers given to you -- never invent other activity. If everything is at zero, encourage them to explore Jobs, Housing, Record Relief, or Resources rather than implying failure. Be warm, brief, and practical. Never guarantee an outcome. Keep it under 150 words.',
      user: `Member's current activity across FairPath:\n${summary}\n\nWhat should they focus on next?`,
    },
  });
});
