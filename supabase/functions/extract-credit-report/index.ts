// Edge Function entry for extract-credit-report. DISABLED unless CREDIT_EXTRACTION_ENABLED=true AND ANTHROPIC_API_KEY are set.
// Deploy (DEV only): npx supabase functions deploy extract-credit-report --project-ref znvhmuhojvwvjzmaqwff
// JWT verification stays ON. Enabling it means member-consented credit reports are sent to the engine provider: a
// product/privacy decision for the founder, not a default.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { EXTRACTION_INSTRUCTIONS, EXTRACTION_TOOL_SCHEMA } from '../_shared/core/credit/extraction.ts';
import { handleExtract, type ExtractDeps } from './handler.ts';

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json(500, { error: 'server_misconfigured' });
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('CREDIT_EXTRACTION_MODEL') ?? 'claude-sonnet-5';

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const deps: ExtractDeps = {
    enabled: () => requireEnv('CREDIT_EXTRACTION_ENABLED') === 'true' && Boolean(apiKey),
    async getUserId(header) { if (!header) return null; const { data } = await userClient.auth.getUser(); return data?.user?.id ?? null; },
    async getOwnUpload(id) {
      const { data } = await userClient.from('credit_report_uploads').select('id,status,mime_type,byte_size,storage_path').eq('id', id).maybeSingle();
      return (data as never) ?? null;
    },
    async download(path) {
      const { data, error } = await admin.storage.from('credit-uploads').download(path);
      return error || !data ? null : new Uint8Array(await data.arrayBuffer());
    },
    async runEngine(bytes, mime) {
      const isPdf = mime === 'application/pdf';
      const block = isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(bytes) } }
        : { type: 'image', source: { type: 'base64', media_type: mime === 'image/png' ? 'image/png' : 'image/jpeg', data: toBase64(bytes) } };
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey ?? '', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model, max_tokens: 8000, system: EXTRACTION_INSTRUCTIONS,
          tools: [{ name: 'record_report', description: 'Record the accounts and inquiries printed on the report.', input_schema: EXTRACTION_TOOL_SCHEMA }],
          tool_choice: { type: 'tool', name: 'record_report' },
          messages: [{ role: 'user', content: [block, { type: 'text', text: 'Transcribe this report.' }] }],
        }),
      });
      if (!res.ok) throw new Error('engine_http');
      const out = await res.json() as { content?: { type: string; input?: unknown }[] };
      return out.content?.find((c) => c.type === 'tool_use')?.input ?? null;
    },
    async ingest(uploadId, payload) {
      const { data, error } = await admin.rpc('ingest_credit_extraction', { p_upload: uploadId, p_payload: payload, p_engine: 'ocr_v1' });
      if (error) throw new Error('ingest_failed');
      return data as string;
    },
    async markFailed(uploadId, code) {
      await admin.from('credit_report_uploads').update({ status: 'failed' }).eq('id', uploadId);
      await admin.from('credit_extraction_jobs').update({ status: 'failed', error_code: code, finished_at: new Date().toISOString() }).eq('upload_id', uploadId).in('status', ['queued', 'running']);
    },
    now: () => new Date(),
  };
  try {
    const res = await handleExtract(req.method, authHeader, await req.text(), deps);
    return json(res.status, res.body);
  } catch {
    return json(500, { error: 'extract_failed' });
  }
});
