// FairPath AI Gateway — authenticated orchestration + RLS-backed read tools (no model spend).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';

type IntentId = 'find_jobs' | 'find_housing' | 'find_resources' | 'next_steps' | 'help';

type ToolId = 'search_jobs' | 'search_housing' | 'search_resources';

type ResultCard = {
  kind: 'job' | 'housing' | 'resource';
  recordId: string;
  title: string;
  subtitle: string;
  route: string;
  detail?: string;
};

function classifyIntent(message: string): IntentId {
  const t = message.toLowerCase();
  if (/\b(job|work|employ|hire|career)\b/.test(t)) return 'find_jobs';
  if (/\b(hous|rent|apartment|shelter|stay)\b/.test(t)) return 'find_housing';
  if (/\b(food|grocer|resource|legal|childcare|transport|benefit|veteran)\b/.test(t)) return 'find_resources';
  if (/\b(next step|my path|plan|focus)\b/.test(t)) return 'next_steps';
  return 'help';
}

function planTools(message: string, intent: IntentId): ToolId[] {
  const t = message.toLowerCase();
  const out: ToolId[] = [];
  const add = (id: ToolId) => {
    if (!out.includes(id)) out.push(id);
  };
  if (intent === 'find_jobs' || /\b(job|work|employ)\b/.test(t)) add('search_jobs');
  if (intent === 'find_housing' || /\b(hous|rent|apartment)\b/.test(t)) add('search_housing');
  if (
    intent === 'find_resources' ||
    /\b(food|transport|transportation|ride|bus|childcare|benefit|resource)\b/.test(t)
  ) {
    add('search_resources');
  }
  if (!out.length && intent === 'find_jobs') add('search_jobs');
  if (!out.length && intent === 'find_housing') add('search_housing');
  if (!out.length && intent === 'find_resources') add('search_resources');
  return out.slice(0, 3);
}

function toolQuery(toolId: ToolId, message: string): string {
  if (toolId === 'search_resources' && /\b(transport|transportation|ride|bus)\b/i.test(message)) {
    return 'transportation assistance';
  }
  if (toolId === 'search_jobs') {
    return message.replace(/\band\b[^.]*?(transport|transportation|ride|bus)[^.]*/gi, '').trim() || message;
  }
  return message;
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

async function profileLocation(client: ReturnType<typeof createClient>): Promise<{ zip: string | null; radius: number }> {
  const { data } = await client.from('profiles').select('zip_code, search_radius_miles').maybeSingle();
  const zip = typeof data?.zip_code === 'string' && /^\d{5}$/.test(data.zip_code) ? data.zip_code : null;
  const radius =
    typeof data?.search_radius_miles === 'number' && data.search_radius_miles >= 1 && data.search_radius_miles <= 100
      ? Math.round(data.search_radius_miles)
      : 25;
  return { zip, radius };
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

  let body: { message?: string; zip?: string; radiusMiles?: number; executeTools?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 500) return json(400, { error: 'invalid_message' });

  const intent = classifyIntent(message);
  const tools = planTools(message, intent);
  const profile = await profileLocation(userClient);
  const zip =
    typeof body.zip === 'string' && /^\d{5}$/.test(body.zip) ? body.zip : profile.zip;
  const radiusMiles =
    typeof body.radiusMiles === 'number' && body.radiusMiles >= 1 && body.radiusMiles <= 100
      ? Math.round(body.radiusMiles)
      : profile.radius;

  const resultCards: ResultCard[] = [];
  const execute = body.executeTools !== false;

  if (execute) {
    for (const toolId of tools) {
      const q = toolQuery(toolId, message).slice(0, 200);
      if (toolId === 'search_jobs') {
        const { data } = await userClient.rpc('search_jobs', {
          p_query: q || null,
          p_zip: zip,
          p_radius_miles: radiusMiles,
          p_location: null,
          p_remote: false,
          p_employment_type: null,
          p_second_chance: true,
          p_limit: 3,
          p_offset: 0,
          p_veteran_friendly: false,
        });
        for (const row of (data ?? []).slice(0, 3) as { job: { id: string; title: string; company_name: string; city: string | null; state: string | null } }[]) {
          const j = row.job;
          resultCards.push({
            kind: 'job',
            recordId: j.id,
            title: j.title,
            subtitle: j.company_name,
            route: `/job/${j.id}`,
            detail: j.city && j.state ? `${j.city}, ${j.state}` : undefined,
          });
        }
      }
      if (toolId === 'search_housing') {
        const { data } = await userClient.rpc('search_housing', {
          p_query: q || null,
          p_zip: zip,
          p_radius_miles: radiusMiles,
          p_location: null,
          p_filters: {},
          p_sort: 'featured',
          p_limit: 3,
          p_offset: 0,
        });
        for (const row of (data ?? []).slice(0, 3) as {
          listing: { id: string; title: string; city: string; state: string; rent_monthly: number | null };
        }[]) {
          const h = row.listing;
          resultCards.push({
            kind: 'housing',
            recordId: h.id,
            title: h.title,
            subtitle: `${h.city}, ${h.state}`,
            route: `/housing/${h.id}`,
            detail: h.rent_monthly ? `$${h.rent_monthly}/mo` : undefined,
          });
        }
      }
      if (toolId === 'search_resources') {
        const { data } = await userClient.rpc('search_resources', {
          p_query: q || null,
          p_zip: zip,
          p_radius_miles: radiusMiles,
          p_category: null,
          p_free_only: false,
          p_urgent: false,
          p_delivery: null,
          p_include_national: true,
          p_limit: 3,
          p_offset: 0,
        });
        for (const row of (data ?? []).slice(0, 3) as {
          resource_row: { id: string; title: string; organization: { name: string }; is_national: boolean };
          distance_miles: number | null;
        }[]) {
          const r = row.resource_row;
          resultCards.push({
            kind: 'resource',
            recordId: r.id,
            title: r.title,
            subtitle: r.organization?.name ?? 'Verified resource',
            route: `/resource/${r.id}`,
            detail: row.distance_miles != null ? `${row.distance_miles.toFixed(1)} mi` : r.is_national ? 'Nationwide' : undefined,
          });
        }
      }
    }
  }

  return json(200, {
    authenticated: true,
    intent,
    tools,
    routes: routesForIntent(intent),
    location: { zip, radiusMiles },
    resultCards: resultCards.slice(0, 6),
    modelAssisted: false,
  });
});
