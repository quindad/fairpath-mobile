// Resources audit: schema security boundaries, fixture provenance, and the verified-only visibility contract.
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const core = read('supabase/migrations/20261001100000_resources_core.sql');
// The LATEST definition of each function is what runs, so audit both files together (later definitions win via lastIndexOf).
const search = read('supabase/migrations/20261001110000_resources_search.sql') + '\n' + read('supabase/migrations/20261001111000_resources_search_national_toggle.sql');
const allSql = fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).map((f) => [f, read('supabase/migrations/' + f)]);

// ---- base tables: RLS on, no client grants except the deliberate ones ----
const tables = [...core.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
check(tables.length >= 13, `Expected the normalized resource tables, found ${tables.length}.`);
for (const t of tables) {
  check(new RegExp(`alter table public\\.${t} enable row level security`).test(core), `${t}: RLS must be enabled.`);
  check(new RegExp(`grant [^;]*on table public\\.${t} to service_role`).test(core), `${t}: needs an explicit service_role grant.`);
}
const clientGrants = [...core.matchAll(/grant ([^;]*?) on table public\.(\w+) to ([^;]*);/g)]
  .filter((m) => /anon|authenticated/.test(m[3]));
const allowedClientTables = new Set(['resource_categories', 'resource_needs', 'organization_members']);
for (const g of clientGrants) {
  check(allowedClientTables.has(g[2]), `${g[2]}: anon/authenticated must not be granted direct access to a resource base table.`);
  check(/^select$/.test(g[1].trim()), `${g[2]}: client grants must be select-only.`);
}
check(!/policy [^;]*on public\.resources\b/.test(core), 'resources must have no anon/authenticated policy (read only through functions).');

// ---- invariants that the search functions rely on ----
check(/check \(publish_status <> 'published' or verification_state = 'verified'\)/.test(core), 'A published resource must be verified (CHECK).');
check(/check \(verification_state <> 'verified' or last_verified_at is not null\)/.test(core), 'A verified resource must have last_verified_at (CHECK).');
check(/resources_guard_fixture/.test(core) && /app_config\.environment = ''dev''/.test(core), 'The dev-fixture guard trigger is required.');
check(/coalesce\(env, ''\) <> 'dev'/.test(core), 'Fixture guard must reject when the environment is unset.');
check(/resource_verification_events_no_update/.test(core), 'Verification events must block updates.');

// ---- visibility contract: every member/guest read path filters ----
for (const fn of ['search_resources', 'get_resource_detail']) {
  const body = search.slice(search.lastIndexOf(`create or replace function public.${fn}(`));
  const end = body.indexOf('\n$$;', 10);
  const def = body.slice(0, end);
  check(/security definer/.test(def), `${fn} must be SECURITY DEFINER (base tables are closed).`);
  check(/publish_status = 'published'/.test(def) && /verification_state = 'verified'/.test(def), `${fn} must return published + verified rows only.`);
  check(/resource_freshness\(/.test(def) && /in \('fresh', 'stale'\)/.test(def), `${fn} must hide expired records.`);
  check(/o\.status = 'active'/.test(def), `${fn} must hide suspended organizations.`);
  check(!/auth\.uid\(\)/.test(def), `${fn} is public: it must not read member identity.`);
}
check(/urgency_tier > 0 and public\.resource_freshness\(r\.last_verified_at, r\.verify_by\) = 'fresh'/.test(search), 'Urgent mode must exclude stale records.');
check(/least\(greatest\(coalesce\(p_limit, 20\), 1\), 50\)/.test(search), 'Search must cap page size.');
check(/a\.area_type = 'national' and coalesce\(p_include_national, true\)/.test(search), 'National service areas must respect the include-national toggle.');
check(/limit lim offset off/.test(search) && /count\(\*\) over \(\)/.test(search), 'Search must be server-paginated with a total count.');
check(/grant execute on function public\.search_resources[^;]*anon, authenticated/.test(search.replace(/\n/g, ' ')), 'Guests must be able to search (anon execute).');
check(!/insert into public\.search|search_log|product_events/.test(search), 'Search text must not be stored or logged.');

// ---- no fixtures in migrations (production also runs migrations) ----
for (const [f, sql] of allSql) {
  if (!/resources|resource_/.test(f) && !/dev_fixture/.test(sql)) continue;
  check(!/insert into public\.(resource_organizations|resources|resource_locations)\b/i.test(sql), `${f}: fixtures/organizations must never be inserted by a migration.`);
}
check(!/'test_fixture'|dev_fixture'\s*,/.test(core.replace(/check[^\n]*\n/g, '').replace(/--[^\n]*/g, '').replace(/data_origin[^\n]*/g, '').replace(/[^\n]*'dev_fixture'[^\n]*/g, '')), 'Migrations must not create dev_fixture data.');

// ---- taxonomy ----
const cats = [...core.matchAll(/^\s+\('([a-z_]+)',\s*'[^']+',\s*'[^']+',\s*\d+,\s*(true|false)\)/gm)].map((m) => m[1]);
check(cats.length === 17, `Expected the 17 blueprint categories, found ${cats.length}.`);
const needs = [...core.matchAll(/^\s+\('([a-z_]+)',\s*'[^']+',\s*array\[/gm)].map((m) => m[1]);
check(needs.length >= 15, `Expected the need mapping, found ${needs.length}.`);
for (const must of ['food_today', 'place_to_stay', 'get_id', 'get_around', 'legal_help', 'find_training', 'healthcare', 'benefits', 'money_help']) {
  check(needs.includes(must), `Missing plain-language need: ${must}.`);
}

// ---- fixtures: provenance + coverage ----
const fx = await import('../supabase/seed/data/resources-fixtures.mjs');
const rows = fx.buildResourceFixtures(new Date('2026-10-01T12:00:00Z'));
const allRows = [...rows.orgs, ...rows.resources];
check(allRows.every((r) => r.data_origin === 'dev_fixture' && r.fixture_set === fx.FIXTURE_SET), 'Every fixture organization/resource must carry dev_fixture provenance.');
check(rows.resources.every((r) => r.source_authority === 'test_fixture'), 'Fixture resources must use source_authority test_fixture.');
const urls = [...rows.resources.flatMap((r) => [r.application_url, r.official_source_url]), ...rows.orgs.map((o) => o.website_url), ...rows.contacts.filter((c) => c.method === 'url').map((c) => c.value)].filter(Boolean);
check(urls.every((u) => /^https:\/\/[a-z0-9.-]+\.test(\/|$)/.test(u)), 'Fixture URLs must all use the reserved .test TLD.');
check(rows.contacts.filter((c) => c.method === 'phone').every((c) => /^\(555\) 010-\d{4}$/.test(c.value)), 'Fixture phone numbers must be 555-01xx.');
const ids = new Set();
for (const list of Object.values(rows)) for (const r of list) if (r.id) { check(!ids.has(r.id), `Duplicate fixture id ${r.id}`); ids.add(r.id); }
for (const r of rows.resources) {
  check(r.publish_status !== 'published' || r.verification_state === 'verified', `${r.title}: published must be verified.`);
  check(r.verification_state !== 'verified' || r.last_verified_at, `${r.title}: verified needs last_verified_at.`);
}
const has = (pred) => rows.resources.some(pred);
check(rows.resources.length >= 50 && rows.orgs.length >= 12, 'Fixtures must be large enough to test the product.');
check(has((r) => r.verification_state === 'verified' && new Date(r.verify_by) > new Date('2026-10-01')), 'Need verified + fresh records.');
check(has((r) => r.verification_state === 'verified' && new Date(r.verify_by) < new Date('2026-10-01') && new Date(r.verify_by) > new Date('2026-04-01')), 'Need verified + stale records.');
check(has((r) => r.verification_state === 'verified' && new Date(r.verify_by) < new Date('2025-12-01')), 'Need verified + expired records.');
for (const st of ['unverified', 'rejected']) check(has((r) => r.verification_state === st), `Need ${st} records.`);
for (const ps of ['draft', 'pending_review', 'retired']) check(has((r) => r.publish_status === ps), `Need ${ps} records.`);
check(has((r) => r.urgency_tier === 2) && has((r) => r.urgency_tier === 0), 'Need urgent and non-urgent records.');
for (const c of ['free', 'sliding', 'paid']) check(has((r) => r.cost_type === c), `Need ${c} cost records.`);
for (const m of ['in_person', 'virtual', 'phone', 'hybrid']) check(has((r) => r.delivery_mode === m), `Need ${m} delivery records.`);
check(has((r) => r.is_national), 'Need national records.');
check(rows.hours.some((h) => h.is_24h) && rows.hours.some((h) => !h.is_24h), 'Need 24h and scheduled hours.');
check(rows.docs.length > 0 && rows.eligibility.length > 0, 'Need required documents and eligibility rules.');
check(rows.areas.some((a) => a.area_type === 'radius') && rows.areas.some((a) => a.area_type === 'state') && rows.areas.some((a) => a.area_type === 'zip'), 'Need zip/state/radius service areas.');
const catsUsed = new Set(rows.links.map((l) => l.category_slug));
check(cats.every((c) => catsUsed.has(c)), 'Fixtures must cover all 17 categories: missing ' + cats.filter((c) => !catsUsed.has(c)).join(', '));
check(!rows.locations.some((l) => l.postal_code === '45202'), 'The 45202 empty-state market must have no local resources.');
check(new Set(rows.locations.map((l) => l.state_code).filter(Boolean)).size >= 3, 'Fixtures must span several states/markets.');

// ---- member state migration: owner-only reads, no client writes, signed-in functions only ----
const ms = read('supabase/migrations/20261001120000_resources_member_state.sql');
for (const t of ['saved_resources', 'resource_interactions', 'resource_reports']) {
  check(new RegExp(`alter table public\\.${t} enable row level security`).test(ms), `${t}: RLS must be enabled.`);
  check(new RegExp(`grant [^;]*on table public\\.${t} to service_role`).test(ms), `${t}: needs an explicit service_role grant.`);
  check(!new RegExp(`grant [^;]*(insert|update|delete)[^;]*on table public\\.${t} to authenticated`).test(ms), `${t}: clients must not write directly (functions only).`);
}
check(/grant select \(id, user_id, resource_id, reason, status, created_at\) on table public\.resource_reports to authenticated/.test(ms), 'Members must not be able to read report notes back (column grant).');
for (const fn of ['save_resource', 'unsave_resource', 'set_resource_progress', 'report_resource', 'my_resource_states', 'list_my_saved_resources', 'list_my_resource_progress', 'my_resource_counts']) {
  const start = ms.indexOf(`create or replace function public.${fn}(`);
  check(start >= 0, `${fn} missing.`);
  const def = ms.slice(start, ms.indexOf('$$;', start + 10));
  check(/security definer/.test(def), `${fn} must be SECURITY DEFINER.`);
  check(/auth\.uid\(\)/.test(def), `${fn} must scope to auth.uid().`);
  check(new RegExp(`revoke all on function public\\.${fn}\\(`).test(ms), `${fn}: revoke from public.`);
  check(!new RegExp(`grant execute on function public\\.${fn}\\([^;]*anon`).test(ms), `${fn}: must not be callable by anon.`);
}
for (const fn of ['save_resource', 'set_resource_progress', 'report_resource']) {
  const start = ms.indexOf(`create or replace function public.${fn}(`);
  const def = ms.slice(start, ms.indexOf('$$;', start + 10));
  check(/SIGNED_OUT/.test(def), `${fn} must reject signed-out callers.`);
}
check(/RESOURCE_UNAVAILABLE/.test(ms) && /resource_is_visible/.test(ms), 'Saving/starting/reporting must require a currently visible resource.');
check(/REPORT_RATE_LIMIT/.test(ms) && /interval '24 hours'/.test(ms), 'Reports must be rate limited.');
check(/left\(btrim\(coalesce\(p_note, ''\)\), 500\)/.test(ms), 'Report notes must be trimmed to 500 characters.');
check(/jsonb_build_object\('id', s\.resource_id\)/.test(ms) && /jsonb_build_object\('id', ri\.resource_id\)/.test(ms), 'Unavailable saved records must not reveal details.');
check(/note is null or length\(note\) <= 500/.test(ms), 'Report note length constraint.');
check(/actor_id is not null and new\.actor_id is null/.test(ms), 'Append-only trigger must still allow anonymizing actor_id (deleting a member must not fail).');
check(!/member_achievements|achievement_definitions|award_achievement/i.test(ms),'Self-reported progress must never feed achievements.');

// ---- client formatting rules (pure, executable) ----
const fmt = await import('../src/core/resources/resource-format.ts');
const wk = [1, 2, 3, 4, 5].map((d) => ({ weekday: d, opens_at: '09:00:00', closes_at: '17:00:00', is_24h: false }));
check(fmt.formatHours(wk).join('|') === 'Mon–Fri 9:00 AM – 5:00 PM', 'Consecutive weekdays with equal hours must collapse: ' + fmt.formatHours(wk).join('|'));
const all24 = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, opens_at: null, closes_at: null, is_24h: true }));
check(fmt.formatHours(all24).join('|') === 'Open 24 hours, every day', '24/7 must read "Open 24 hours, every day".');
check(fmt.formatHours([]).length === 0 && fmt.formatHours(null).length === 0, 'No hours -> no lines (never invent hours).');
check(fmt.formatHours([{ weekday: 6, opens_at: '10:00', closes_at: '14:00', is_24h: false }, { weekday: 0, opens_at: '10:00', closes_at: '14:00', is_24h: false }]).join('|') === 'Sat, Sun 10:00 AM – 2:00 PM', 'Weekend grouping.');
check(fmt.telUrl('(555) 010-0123') === 'tel:5550100123' && fmt.telUrl('n/a') === null, 'tel: links must be digits only and refuse non-numbers.');
check(fmt.safeExternalUrl('https://a.example.test/x') !== null && fmt.safeExternalUrl('javascript:alert(1)') === null && fmt.safeExternalUrl('file:///etc/passwd') === null && fmt.safeExternalUrl('not a url') === null, 'Only http(s) links may be opened from resource data.');
check(fmt.provenanceBadge('dev_fixture') === 'DEV TEST DATA' && fmt.provenanceBadge('production') === '', 'Non-production rows must be labelled; production rows must not.');
check(fmt.freshnessLabel('stale').tone === 'warn' && fmt.freshnessLabel('fresh').tone === 'ok' && fmt.freshnessLabel('expired').tone === 'none', 'Freshness labels.');
check(fmt.isZip5('44113') && !fmt.isZip5('4411') && !fmt.isZip5('441133') && !fmt.isZip5('abcde'), 'ZIP validation.');
check(fmt.distanceLabel(2.345) === '2.3 mi' && fmt.distanceLabel(14.6) === '15 mi' && fmt.distanceLabel(null) === '', 'Distance labels.');
check(fmt.costLabel('paid') === 'Costs money' && fmt.costLabel('free') === 'Free' && fmt.costLabel(undefined) === 'Cost not listed', 'Cost labels never imply free when unknown.');

// ---- client never queries resource base tables directly (guests/members read only via functions) ----
const svc = read('src/core/resources/resources-service.ts');
const fromTables = [...svc.matchAll(/\.from\('(\w+)'\)/g)].map((m) => m[1]);
check(fromTables.every((t) => ['resource_categories', 'resource_needs'].includes(t)), 'The client may only read the public taxonomy tables directly: ' + fromTables.join(','));
check(/rpc\('search_resources'/.test(svc) && /rpc\('get_resource_detail'/.test(svc), 'Client must use the search/detail functions.');
check(!/slice\(0,\s*100\)|\.limit\(100\)/.test(svc), 'No client-side 100-row filtering.');

// ---- seed script safety ----
const seed = read('scripts/seed-dev-resources.mjs');
check(/assertDevTarget/.test(seed) && /--confirm-dev/.test(seed) && /SUPABASE_SERVICE_ROLE_KEY/.test(seed), 'Seed script must use the DEV guards and read the key only from the environment.');
check(!/eyJ[A-Za-z0-9_-]{20,}/.test(seed) && !/sb_secret_/.test(seed.replace(/startsWith/g, '')), 'No keys in the seed script.');

// Regression: same fix/finding as Jobs/Housing — a failed FRESH search must clear results/total/etc, never leave
// a prior successful search's results rendered under a fresh error banner. A failed load-more is different (the
// first page stays visible) so the fix only applies to the `!append` branch.
{
  const resourcesSrc = read('src/app/resources.tsx');
  const catchBlock = (resourcesSrc.match(/\} catch \{[\s\S]*?\n(?:    \}|\s{4}\})/) || [''])[0];
  check(/if \(!append\) \{ setResults\(\[\]\); setTotal\(0\); setHasMore\(false\); \}/.test(catchBlock), 'a failed fresh resources search must clear results/total/etc before setting the error, not leave stale results visible under it (load-more failures correctly keep the first page)');
}

if (failures.length) {
  console.error('Resources audit FAILED:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log(`Resources audit passed: ${tables.length} tables closed to clients, guest-safe verified-only search, ${rows.resources.length} provenance-marked fixtures across ${new Set(rows.locations.map((l) => l.state_code).filter(Boolean)).size} states.`);
