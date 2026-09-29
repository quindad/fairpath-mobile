// Cross-cutting security audit for the Profile/Resources/Documents/Credit/Record Relief/AI pass. `npm run test:security`
// Static invariants over every migration and source file added in this pass, complementing the executable suites.
import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const strip = (sql) => sql.replace(/--[^\n]*/g, '');

const NEW = fs.readdirSync('supabase/migrations').filter((f) => /^202610\d{8}_/.test(f) && f >= '20261001100000').sort();
check(NEW.length >= 10, 'expected the new migrations, found ' + NEW.length);

// Functions that guests (anon) may execute: only public, member-state-free reference reads.
const ANON_OK = new Set(['resolve_resource_needs', 'search_resources', 'get_resource_detail', 'resource_location_open_now', 'resource_freshness',
  'get_market_coverage']);

for (const f of NEW) {
  const sql = strip(read('supabase/migrations/' + f));

  // 1. every table is RLS-protected
  for (const m of sql.matchAll(/create table if not exists public\.(\w+)/g)) {
    const t = m[1];
    const enabled = new RegExp(`alter table public\\.${t} enable row level security`).test(sql) || new RegExp(`'${t}'`).test(sql) && /enable row level security/.test(sql);
    check(enabled, `${f}: table ${t} does not enable RLS`);
  }
  // 2. no anon table grants; anon function grants only from the allow-list
  // The only guest-readable tables are the public taxonomy (categories and plain-language need phrases).
  const withoutTaxonomy = sql.replace(/grant select on table public\.resource_(categories|needs) to anon, authenticated;/g, '');
  check(!/grant [^;]*\bon table [^;]*\bto [^;]*\banon\b/i.test(withoutTaxonomy), `${f}: grants table access to anon`);
  for (const m of sql.matchAll(/grant execute on function public\.(\w+)\([^)]*\)\s+to ([^;]+);/gi)) {
    if (/\banon\b/.test(m[2])) check(ANON_OK.has(m[1]), `${f}: function ${m[1]} is executable by anon`);
  }
  // 3. security definer functions pin search_path
  for (const m of sql.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\$\$;/g)) {
    const body = m[0];
    if (/security definer/i.test(body)) check(/set search_path = public/i.test(body), `${f}: ${m[1]} is SECURITY DEFINER without a pinned search_path`);
  }
  // 4. no employer/landlord/partner reads of member tables
  check(!/create policy[^;]*\b(employer|landlord|partner)\b/i.test(sql), `${f}: a policy mentions employer/landlord/partner`);
  // 5. no fixtures/rules/sample rows shipped in migrations - checked OUTSIDE function bodies only, since a
  // controlled, parameterized insert inside a SECURITY DEFINER function (e.g. promoting an already-reviewed
  // candidate into record_relief_rules) is a sanctioned runtime write path, not a hardcoded literal seed row.
  const withoutFunctionBodies = sql.replace(/create or replace function[\s\S]*?\$\$;/gi, '');
  check(!/insert into public\.(resources|resource_organizations|record_relief_rules|record_relief_forms|record_relief_federal_pathways)\b/i.test(withoutFunctionBodies), `${f}: inserts fixture-class data`);
  // 6. new buckets are private
  for (const m of sql.matchAll(/insert into storage\.buckets[^;]*values\s*\(([^)]*)\)/gi)) check(/'[a-z-]+',\s*'[a-z-]+',\s*false/i.test(m[1]), `${f}: a new storage bucket is not private`);
  // 7. functions that only the platform should run are not granted to authenticated
  for (const svc of ['expire_generated_documents', 'expire_credit_uploads', 'generate_member_reminders', 'record_relief_reminders_due', 'credit_dispute_reminders_due', 'expire_ai_interactions', 'list_due_account_deletions', 'ingest_credit_extraction', 'ingest_credit_report', 'member_summary_core', 'build_opportunity_snapshot', 'resource_is_visible', 'resource_summary_json']) {
    check(!new RegExp(`grant execute on function public\\.${svc}\\([^)]*\\)\\s+to [^;]*authenticated`, 'i').test(sql), `${f}: ${svc} must be service-only`);
  }
}

// ---------- client code ----------
const src = walk('src').filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => f.replace(/\\/g, '/'));
for (const f of src) {
  const t = read(f);
  check(!/SERVICE_ROLE|service_role_key|sb_secret_|eyJhbGciOi/.test(t), `${f}: references a service-role key or a JWT literal`);
  check(!/getPublicUrl/.test(t) || /marketplace|Marketplace/.test(t), `${f}: getPublicUrl outside the (intentionally public) Marketplace media`);
}
const sensitiveDirs = ['src/core/credit', 'src/core/record-relief', 'src/core/documents', 'src/core/ai', 'src/core/profile'];
for (const f of src.filter((x) => sensitiveDirs.some((d) => x.startsWith(d)) || /src\/app\/(credit|record-relief|documents|fairpath-ai|privacy|me)/.test(x))) {
  check(!/console\.(log|info|debug|warn|error)\(/.test(read(f).replace(/__DEV__[^\n]*/g, '')), `${f}: logs to the console (sensitive area)`);
  check(!/analytics|track\w*\(|product_events/.test(read(f)), `${f}: sends data to analytics (sensitive area)`);
}
// Anything the client sends to storage stays in the member's own folder.
for (const f of ['src/core/credit/credit-service.ts', 'src/core/documents/document-service.ts']) {
  const t = read(f);
  check(/user\.id\}\//.test(t), `${f}: storage paths must start with the member's id`);
}

// ---------- Edge Functions ----------
const cfg = read('supabase/config.toml');
check(!/\[functions\.render-document\][^\[]*verify_jwt\s*=\s*false/.test(cfg), 'render-document must keep JWT verification on');
const handler = read('supabase/functions/render-document/handler.ts');
check(/getUserId/.test(handler) && /401/.test(handler) && /audienceAllowed/.test(handler), 'render-document authenticates and enforces audience rules');
check(!/console\./.test(handler + read('supabase/functions/render-document/index.ts')), 'render-document never logs');
const idx = read('supabase/functions/render-document/index.ts');
check(/p_official_form_ref: null/.test(idx), 'the server path never mints an official form yet');

// extract-credit-report is off by default, consent-gated, authenticated and silent
check(!/\[functions\.extract-credit-report\][^\[]*verify_jwt\s*=\s*false/.test(cfg), 'extract-credit-report must keep JWT verification on');
const ex = read('supabase/functions/extract-credit-report/handler.ts') + read('supabase/functions/extract-credit-report/index.ts');
check(/consent_required/.test(ex) && /extraction_not_enabled/.test(ex) && /CREDIT_EXTRACTION_ENABLED/.test(ex), 'credit extraction is consent-gated and disabled by default');
check(!/console\./.test(ex), 'credit extraction never logs');

// ---------- the fixture guard exists for every fixture-bearing table ----------
check(/resources_guard_fixture/.test(read('supabase/migrations/20261001100000_resources_core.sql')), 'resources fixture guard');
check(/record_relief_guard_fixture/.test(read('supabase/migrations/20261001170000_record_relief.sql')), 'record relief fixture guard');
check(/SAMPLE_DATA_DEV_ONLY/.test(read('supabase/migrations/20261001160000_credit_workspace.sql')), 'credit sample guard');

// ---------- every new migration has an executable suite ----------
const pkg = JSON.parse(read('package.json'));
for (const s of ['test:sql:resources', 'test:sql:profile', 'test:sql:documents', 'test:sql:member', 'test:sql:credit', 'test:sql:relief', 'test:sql:ai']) check(pkg.scripts[s], `missing script ${s}`);

// ---------- secrets never checked in ----------
for (const f of ['.env.local']) if (fs.existsSync(f)) { const t = read(f); check(!/SERVICE_ROLE/i.test(t), `${f} must not contain a service role key`); }
check(!fs.readdirSync('scripts').some((f) => /\.json$/.test(f) && /key|secret/i.test(f)), 'no key files in scripts/');

if (failures.length) { console.error('Security audit FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log(`Security audit passed: ${NEW.length} migrations checked (RLS everywhere, no anon access beyond public reference reads, pinned search_path, private buckets, service-only jobs), client has no keys/logging/analytics in sensitive areas, Edge function authenticated.`);
