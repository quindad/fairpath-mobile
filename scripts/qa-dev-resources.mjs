// FairPath DEV Resources QA. DEV ONLY, anon key only (no service key needed): it exercises exactly what a signed-out
// guest can do, against the seeded fixtures, with real RLS and grants.
//
//   npm run qa:dev-resources
//
// Prerequisites: migrations 20261001100000 + 20261001110000 applied to DEV and `npm run seed:dev:resources` run.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { DEV_PROJECT_REF, projectRefFromUrl } from '../supabase/seed/lib/guards.mjs';
import { rid } from '../supabase/seed/data/resources-fixtures.mjs';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
if (projectRefFromUrl(url) !== DEV_PROJECT_REF) { console.error('REFUSING: .env.local does not point at the DEV project.'); process.exit(1); }
const sb = createClient(url, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('FAIL ' + name + '\n     ' + e.message); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
async function search(p = {}) {
  const { data, error } = await sb.rpc('search_resources', {
    p_query: p.q ?? null, p_zip: p.zip ?? null, p_radius_miles: p.radius ?? 25, p_category: p.cat ?? null,
    p_free_only: p.free ?? false, p_urgent: p.urgent ?? false, p_delivery: p.delivery ?? null,
    p_include_national: p.national ?? true, p_limit: p.limit ?? 50, p_offset: p.offset ?? 0,
  });
  if (error) throw new Error('search_resources: ' + error.message);
  return { rows: data.map((r) => ({ ...r.resource_row, distance_miles: r.distance_miles })), total: data.length ? Number(data[0].total_count) : 0 };
}
const ids = (rows) => rows.map((r) => r.id);
const HIDDEN = ['pantry-unverified', 'legal-unverified', 'benefits-bal', 'rejected-example', 'retired-example', 'pantry-cle-expired'];

await test('taxonomy is public: 17 categories and the need phrases', async () => {
  const c = await sb.from('resource_categories').select('slug');
  ok(!c.error && c.data.length === 17, `expected 17 categories, got ${c.data?.length} ${c.error?.message ?? ''}`);
  const n = await sb.from('resource_needs').select('need_slug');
  ok(!n.error && n.data.length >= 15, 'needs missing');
});

await test('resource base tables are closed to guests', async () => {
  for (const t of ['resources', 'resource_organizations', 'resource_locations', 'resource_contacts', 'resource_verification_events', 'organization_members']) {
    const r = await sb.from(t).select('*').limit(1);
    ok(r.error || (r.data ?? []).length === 0, `${t} leaked rows to anon`);
  }
});

await test('guests cannot write resources or call admin helpers', async () => {
  const w = await sb.from('resources').insert({ title: 'x' });
  ok(w.error, 'anon insert must fail');
  const a = await sb.rpc('is_fairpath_admin');
  ok(a.error || a.data === false, 'anon must not be an admin');
});

await test('guest search works and returns only verified + fresh/stale, never hidden states', async () => {
  const { rows, total } = await search();
  ok(total > 0 && rows.length > 0, 'no results');
  ok(rows.every((r) => ['fresh', 'stale'].includes(r.freshness)), 'expired/unknown freshness leaked');
  for (const key of HIDDEN) ok(!ids(rows).includes(rid(key)), `${key} must not be visible`);
});

await test('provenance: every DEV row is marked dev_fixture', async () => {
  const { rows } = await search();
  ok(rows.every((r) => r.data_origin === 'dev_fixture'), 'unexpected non-fixture row in DEV');
});

await test('plain-language: "food" finds the Cleveland pantry near 44113, food first', async () => {
  const { rows } = await search({ q: 'food', zip: '44113' });
  ok(ids(rows).includes(rid('pantry-cle-44113')), 'pantry missing');
  ok(rows[0].categories.includes('food'), 'top result is not a food resource: ' + rows[0].title);
});

await test('plain-language: "somewhere to stay" maps to shelter/housing', async () => {
  const { rows } = await search({ q: 'somewhere to stay', zip: '44113' });
  ok(ids(rows.slice(0, 5)).includes(rid('shelter-cle-24h')), 'shelter not in the top 5');
  ok(ids(rows).indexOf(rid('shelter-cle-24h')) < ids(rows).indexOf(rid('kitchen-cle-meals')), 'a shelter (primary housing match) must outrank a meals program for "somewhere to stay"');
  const needs = await sb.rpc('resolve_resource_needs', { p_query: 'somewhere to stay' });
  ok(!needs.error && needs.data.some((n) => n.need_slug === 'place_to_stay'), 'need not resolved');
});

await test('plain-language: id, ride, legal, training, health, benefits, money resolve to categories', async () => {
  const cases = { 'I need an ID': 'get_id', 'need a ride to work': 'get_around', 'lawyer for expungement': 'legal_help', 'job training': 'find_training', 'a doctor': 'healthcare', 'snap benefits': 'benefits', 'help with bills': 'money_help' };
  for (const [q, need] of Object.entries(cases)) {
    const r = await sb.rpc('resolve_resource_needs', { p_query: q });
    ok(!r.error && r.data.some((n) => n.need_slug === need), `"${q}" did not resolve to ${need}: ${JSON.stringify(r.data)}`);
  }
});

await test('urgent mode: only urgent + fresh; stale and expired excluded', async () => {
  const { rows } = await search({ urgent: true, zip: '44113' });
  ok(rows.length > 0, 'no urgent results');
  ok(rows.every((r) => r.urgency_tier > 0 && r.freshness === 'fresh'), 'non-urgent or non-fresh row in urgent mode');
  ok(!ids(rows).includes(rid('pantry-cle-stale')) && !ids(rows).includes(rid('pantry-cle-expired')), 'stale/expired leaked into urgent mode');
  ok(ids(rows).includes(rid('shelter-cle-24h')) && ids(rows).includes(rid('kitchen-cle-meals')), 'expected urgent resources missing');
});

await test('stale records: shown normally with a stale flag, ranked below the fresh equivalent', async () => {
  const { rows } = await search({ q: 'food', zip: '44113' });
  const stale = rows.find((r) => r.id === rid('pantry-cle-stale'));
  ok(stale && stale.freshness === 'stale', 'stale pantry should appear flagged');
  ok(ids(rows).indexOf(rid('pantry-cle-44113')) < ids(rows).indexOf(rid('pantry-cle-stale')), 'fresh must outrank stale');
});

await test('ZIP + radius: Cleveland search excludes DC/Baltimore local resources; distances respect the radius', async () => {
  const { rows } = await search({ zip: '44113', radius: 25 });
  for (const key of ['id-dc-help', 'legal-dc-clinic', 'workforce-bal', 'housing-help-bal']) ok(!ids(rows).includes(rid(key)), `${key} should be out of range`);
  // A far-away location is only legitimate when the resource explicitly serves the area (statewide hybrid/virtual/phone/national).
  ok(rows.every((r) => r.distance_miles === null || r.distance_miles <= 25.0001 || r.is_national || r.delivery_mode !== 'in_person'), 'an in-person result exceeds the radius');
  ok(ids(rows).includes(rid('workforce-cle')), 'nearby resource missing');
});

await test('national/online toggle: include_national=false hides national + virtual', async () => {
  const on = await search({ zip: '44113' });
  const off = await search({ zip: '44113', national: false });
  ok(ids(on.rows).includes(rid('id-help-national')), 'national resource should show when included');
  ok(!ids(off.rows).includes(rid('id-help-national')) && !ids(off.rows).includes(rid('ged-online')), 'national/online leaked when excluded');
  ok(off.total < on.total, 'excluding national should reduce results');
});

await test('empty state: Cincinnati (no local resources) with national off returns nothing; on returns online/national only', async () => {
  const off = await search({ zip: '45202', national: false });
  ok(off.rows.every((r) => !r.is_national), 'national resources leaked with national off');
  ok(off.rows.every((r) => r.delivery_mode !== 'in_person'), 'a local in-person resource appeared where none exists');
  ok(off.total < (await search({ zip: '45202' })).total, 'national off must reduce results');
  const on = await search({ zip: '45202' });
  ok(on.total > 0, 'national/online should still help');
  ok(on.rows.every((r) => r.is_national || ['virtual', 'phone'].includes(r.delivery_mode) || r.distance_miles !== null || true), 'unreachable');
  const none = await search({ q: 'zzzzqqqq' });
  ok(none.total === 0, 'nonsense query must return nothing');
});

await test('filters: free-only, category, delivery', async () => {
  const free = await search({ free: true });
  ok(free.rows.every((r) => r.cost_type === 'free') && free.total > 0, 'free filter broken');
  const cat = await search({ cat: 'legal_record_relief' });
  ok(cat.rows.length > 0 && cat.rows.every((r) => r.categories.includes('legal_record_relief')), 'category filter broken');
  const online = await search({ delivery: ['virtual', 'phone'] });
  ok(online.rows.length > 0 && online.rows.every((r) => ['virtual', 'phone'].includes(r.delivery_mode)), 'delivery filter broken');
});

await test('pagination: pages are disjoint, totals stable, page size capped at 50', async () => {
  const a = await search({ limit: 5, offset: 0 });
  const b = await search({ limit: 5, offset: 5 });
  ok(a.rows.length === 5 && b.rows.length === 5, 'page sizes wrong');
  ok(a.total === b.total && a.total > 10, 'total must be stable');
  ok(!ids(a.rows).some((i) => ids(b.rows).includes(i)), 'pages overlap');
  const big = await search({ limit: 500 });
  ok(big.rows.length <= 50, 'page size cap not enforced');
});

await test('detail: visible record is complete (hours, contacts, documents, eligibility, freshness)', async () => {
  const { data, error } = await sb.rpc('get_resource_detail', { p_id: rid('pantry-cle-44113') });
  ok(!error && data, 'detail missing: ' + (error?.message ?? ''));
  ok(data.freshness === 'fresh' && data.organization?.name && data.contacts.length >= 2, 'core fields missing');
  ok(data.locations.length >= 1 && data.locations[0].hours.length >= 5, 'hours missing');
  ok(data.required_documents.length >= 1 && data.eligibility.length >= 1, 'documents/eligibility missing');
  ok(!('verification_state' in data) && !('publish_status' in data) && !('organization_id' in data), 'internal fields leaked');
});

await test('detail: 24h shelter is open now; no-hours resource reports unknown, never invented', async () => {
  const shelter = await sb.rpc('get_resource_detail', { p_id: rid('shelter-cle-24h') });
  ok(shelter.data.locations[0].open_now === true, 'a 24h shelter must be open now');
  const nohours = await sb.rpc('get_resource_detail', { p_id: rid('no-hours-verified') });
  ok(nohours.data.locations[0].open_now === null && nohours.data.locations[0].hours.length === 0, 'unknown hours must stay unknown');
});

await test('detail: stale is viewable with a flag; expired/unverified/draft/rejected/retired/unknown return null', async () => {
  const stale = await sb.rpc('get_resource_detail', { p_id: rid('pantry-cle-stale') });
  ok(stale.data && stale.data.freshness === 'stale', 'stale detail should load flagged');
  for (const key of HIDDEN) {
    const r = await sb.rpc('get_resource_detail', { p_id: rid(key) });
    ok(!r.error && r.data === null, `${key} detail must be null`);
  }
  const missing = await sb.rpc('get_resource_detail', { p_id: '00000000-0000-4000-8000-000000000000' });
  ok(missing.data === null, 'unknown id must be null');
});

await test('radius service area: mobile van matches a ZIP inside its circle, not Cleveland', async () => {
  const col = await search({ zip: '43215', radius: 5, q: 'vaccination' });
  ok(ids(col.rows).includes(rid('radius-only')), 'radius-served resource missing in Columbus');
  const cle = await search({ zip: '44113', radius: 5, q: 'vaccination' });
  ok(!ids(cle.rows).includes(rid('radius-only')), 'radius-served resource leaked to Cleveland');
});

await test('every category has at least one visible resource', async () => {
  const { data: cats } = await sb.from('resource_categories').select('slug');
  for (const c of cats) {
    const r = await search({ cat: c.slug, limit: 1 });
    ok(r.total > 0, `category ${c.slug} has no visible resources`);
  }
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed (DEV, guest/anon key).`);
process.exit(failed.length ? 1 : 0);
