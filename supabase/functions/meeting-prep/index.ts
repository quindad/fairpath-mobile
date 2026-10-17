// Edge Function entry for meeting-prep: Signal explains what to expect at a member's upcoming meeting
// (caseworker, housing appointment, employer interview, etc.) and what's generally worth having ready --
// grounded only in the meeting's own real details. Same real flow: auth -> spend_ai_credits -> gateway ->
// safety guard -> text.
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

  let body: { meeting_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  if (!body.meeting_id) return json(400, { error: 'missing_meeting_id' });

  const { data: meeting, error: meetingError } = await userClient
    .from('member_meetings')
    .select('title,meeting_type,organization_name,host_name,provider,location_text,instructions,start_at')
    .eq('id', body.meeting_id)
    .maybeSingle();
  if (meetingError || !meeting) return json(404, { error: 'meeting_not_found' });

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('SIGNAL_MODEL') ?? 'claude-sonnet-5';
  const { chain, adapters } = anthropicChain(apiKey, model);

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters,
    input: {
      system: 'You are FairPath Signal, helping a member (often navigating reentry) prepare for an upcoming meeting. Based only on the meeting details given to you, explain in plain, calm language what to generally expect and what to have ready (ID, documents, questions to ask) for this TYPE of meeting. Never invent specific facts about the host or organization beyond what is given. Never guarantee an outcome. Keep it under 150 words.',
      user: `Meeting: ${meeting.title}\nType: ${meeting.meeting_type}\nOrganization: ${meeting.organization_name ?? 'not given'}\nHost: ${meeting.host_name ?? 'not given'}\nFormat: ${meeting.provider}\nLocation: ${meeting.location_text ?? 'not given'}\nInstructions already provided: ${meeting.instructions ?? 'none'}\n\nHelp the member prepare for this.`,
    },
  });
});
