// Trusted-server entry point for the Corrections -> community FairPath+ benefit (90 days, no payment).
//
// Called ONLY by the verified Corrections/tablet migration integration (or a future Admin tool), never by the
// mobile app. It authenticates with a shared secret held in function env (CORRECTIONS_INTEGRATION_SECRET) and
// then calls public.claim_correctional_transition, which enforces once-per-identity / once-per-account and
// writes the audit log. Deploy with JWT verification off (see supabase/config.toml) because the caller is a
// server, not a signed-in member. If the secret is not configured the function refuses to run.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv, timingSafeEqual } from '../_shared/http.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const secret = requireEnv('CORRECTIONS_INTEGRATION_SECRET');
  if (!secret) return json(501, { error: 'not_configured', detail: 'CORRECTIONS_INTEGRATION_SECRET is not set for this environment.' });
  if (!timingSafeEqual(req.headers.get('x-fairpath-integration-secret'), secret)) return json(401, { error: 'unauthorized' });

  let body: { user_id?: string; identity_key?: string; deployment?: string; verified_at?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const { user_id, identity_key, deployment, verified_at } = body;
  if (!user_id || !identity_key || !deployment || !verified_at || Number.isNaN(Date.parse(verified_at))) {
    return json(400, { error: 'missing_or_invalid_fields' });
  }

  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'server_misconfigured' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc('claim_correctional_transition', {
    p_user: user_id,
    p_identity_key: identity_key,
    p_deployment: deployment,
    p_verified_at: verified_at,
    p_verified_by: 'corrections-integration',
  });
  if (error) return json(400, { error: 'claim_failed', detail: error.message });
  const row = Array.isArray(data) ? data[0] : data;
  return json(200, { result: row?.result, grant_id: row?.grant_id ?? null, expires_at: row?.expires_at ?? null });
});
