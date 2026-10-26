// FairPath AI Gateway — authenticated orchestration metadata (deterministic, no model spend).
// Returns intent + allowed read tools + safe routes. Tool execution stays in the mobile client / RLS-backed RPCs.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';

type IntentId = 'find_jobs' | 'find_housing' | 'find_resources' | 'next_steps' | 'help';

function classifyIntent(message: string): IntentId {
  const t = message.toLowerCase();
  if (/\b(job|work|employ|hire|career)\b/.test(t)) return 'find_jobs';
  if (/\b(hous|rent|apartment|shelter|stay)\b/.test(t)) return 'find_housing';
  if (/\b(food|grocer|resource|legal|childcare|transport|benefit|veteran)\b/.test(t)) return 'find_resources';
  if (/\b(next step|my path|plan|focus)\b/.test(t)) return 'next_steps';
  return 'help';
}

function toolsForIntent(intent: IntentId): string[] {
  switch (intent) {
    case 'find_jobs':
      return ['search_jobs'];
    case 'find_housing':
      return ['search_housing'];
    case 'find_resources':
      return ['search_resources'];
    case 'next_steps':
      return ['my_path'];
    default:
      return ['pathways'];
  }
}

function routesForIntent(intent: IntentId): { label: string; route: string }[] {
  switch (intent) {
    case 'find_jobs':
      return [{ label: 'Job search', route: '/find-jobs' }];
    case 'find_housing':
      return [{ label: 'Housing search', route: '/find-housing' }];
    case 'find_resources':
      return [{ label: 'Resource Center', route: '/resources' }];
    case 'next_steps':
      return [{ label: 'My Path', route: '/my-path' }];
    default:
      return [{ label: 'Explore FairPath', route: '/explore' }];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader ?? '' } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json(401, { error: 'signed_out' });

  let body: { message?: string; zip?: string; radiusMiles?: number } = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 500) return json(400, { error: 'invalid_message' });

  const intent = classifyIntent(message);
  const zip =
    typeof body.zip === 'string' && /^\d{5}$/.test(body.zip)
      ? body.zip
      : null;
  const radiusMiles =
    typeof body.radiusMiles === 'number' && body.radiusMiles >= 1 && body.radiusMiles <= 100
      ? Math.round(body.radiusMiles)
      : null;

  return json(200, {
    authenticated: true,
    intent,
    tools: toolsForIntent(intent),
    routes: routesForIntent(intent),
    location: { zip, radiusMiles },
    modelAssisted: false,
  });
});
