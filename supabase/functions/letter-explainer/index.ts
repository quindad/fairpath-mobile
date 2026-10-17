// Edge Function: plain-English summary of a photo of mail (court, bureau, landlord, etc.). Not legal advice.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { WORKFLOWS } from '../_shared/core/ai-gateway/gateway.ts';
import { runSignalCall } from '../_shared/core/ai-gateway/run.ts';
import { resolveSignalChain } from '../_shared/core/ai-gateway/signal-chains.ts';

const WORKFLOW = WORKFLOWS.document_vision;
const COST = 2;
const MAX_B64 = 6_500_000;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });

  let body: { mime?: string; base64?: string; context?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const mime = (body.mime ?? '').trim().toLowerCase();
  const base64 = (body.base64 ?? '').trim();
  const context = (body.context ?? '').trim().slice(0, 400);
  if (!mime.startsWith('image/') || !base64) return json(400, { error: 'missing_image' });
  if (base64.length > MAX_B64) return json(413, { error: 'file_too_large' });

  const { chain, adapters, capabilities } = resolveSignalChain('vision', true);

  return await runSignalCall({
    userClient, workflow: WORKFLOW, cost: COST, chain, adapters, capabilities,
    input: {
      system: 'You are FairPath Signal, helping someone understand a photo of a letter or notice in plain English. Summarize who it appears to be from, what it is asking for or stating, and any dates or deadlines you can read. If text is unclear, say so. This is NOT legal advice — do not tell them what they must do legally, do not predict case outcomes, and do not guarantee any result. Suggest they verify details with the sender or a qualified professional when unsure. Keep under 200 words.',
      user: context ? `Member context: ${context}\n\nExplain this document.` : 'Explain this document in plain English.',
      document: { mime, base64 },
    },
  });
});
