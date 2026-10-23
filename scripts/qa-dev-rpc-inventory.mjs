// Read-only: community + marketplace RPC presence on linked DEV (anon probe — not signed-in behavior).
import fs from 'node:fs';

const DEV_REF = 'znvhmuhojvwvjzmaqwff';
const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const linked = fs.existsSync('supabase/.temp/project-ref') ? fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim() : '';
if (!url?.includes(DEV_REF) || linked !== DEV_REF) {
  console.error('REFUSING: DEV project only.');
  process.exit(1);
}

const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
async function rpc(name, args = {}) {
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
  let body = null;
  try {
    body = await r.json();
  } catch {
    /* empty */
  }
  return { status: r.status, body };
}

const rpcs = [
  ['search_jobs', { p_zip: '43228', p_radius_miles: 25, p_limit: 1 }],
  ['search_housing', { p_zip: '43228', p_radius_miles: 25, p_limit: 1, p_filters: {} }],
  ['save_record_relief_case', { p_id: null, p: { jurisdiction_code: 'US-OH', label: 'probe' } }],
  ['get_record_relief_case_detail', { p_case: '00000000-0000-0000-0000-000000000001' }],
  [
    'member_create_community_help_request',
    {
      p_category: 'groceries',
      p_description: 'preflight probe',
      p_household_size: 1,
      p_urgency: 'today',
      p_city: 'Columbus',
      p_state: 'OH',
      p_postal_code: '43228',
      p_pickup_ok: true,
      p_delivery_preferred: false,
      p_expires_at: new Date(Date.now() + 864e5).toISOString(),
    },
  ],
  ['list_open_community_help_board', {}],
  ['request_marketplace_claim', { p_item_id: '00000000-0000-0000-0000-000000000001' }],
  ['record_document_consent', { p_event_type: 'terms_accepted', p_document_version: 'v1', p_granted: true }],
  ['get_member_home_summary', {}],
];

const rows = [];
for (const [name, args] of rpcs) {
  const r = await rpc(name, args);
  const missing = r.body?.code === 'PGRST202' || r.status === 404;
  rows.push({ name, missing, status: r.status, code: r.body?.code, message: r.body?.message });
  console.log(`${missing ? 'MISSING' : 'PRESENT'} ${name} (HTTP ${r.status}${r.body?.message ? ', ' + r.body.message : ''})`);
}

fs.writeFileSync('qa-dev-rpc-inventory-results.json', JSON.stringify({ generatedAt: new Date().toISOString(), projectRef: DEV_REF, rows }, null, 2));
const missingCount = rows.filter((x) => x.missing).length;
process.exit(missingCount ? 1 : 0);
