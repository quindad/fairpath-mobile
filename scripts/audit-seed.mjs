import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildInventory, summarize, SEED_LABEL } from '../supabase/seed/build-inventory.mjs';
import { validateInventory } from '../supabase/seed/validate.mjs';
import { assertDevTarget, DEV_PROJECT_REF, PROD_PROJECT_REF } from '../supabase/seed/lib/guards.mjs';
import { SEED_EMAIL_DOMAIN, EMPLOYERS, OWNERS } from '../supabase/seed/data/accounts.mjs';
import { OFFENSE_SOURCE_AGENCY } from '../supabase/seed/data/offenses.mjs';
import { INDUSTRIES } from '../supabase/seed/data/job-templates.mjs';

const root = process.cwd();
const failures = [];
const fail = (m) => failures.push(m);
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(root, f));

const inv = buildInventory();
const s = summarize(inv);
const by = (rows, f) => rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] || 0) + 1), m), {});

// ---------------------------------------------------------------------
// 1. Volume and breadth (Inventory Pass requirements)
// ---------------------------------------------------------------------
if (inv.jobs.length < 75) fail(`Need >= 75 jobs, have ${inv.jobs.length}.`);
if (inv.listings.length < 50) fail(`Need >= 50 housing listings, have ${inv.listings.length}.`);
for (const i of INDUSTRIES) if ((s.jobsByIndustry[i] || 0) < 6) fail(`Industry ${i} has only ${s.jobsByIndustry[i] || 0} jobs (need >= 6).`);
if (Object.keys(s.jobsByState).length < 12) fail(`Jobs cover only ${Object.keys(s.jobsByState).length} states (need >= 12).`);
if (Object.keys(s.listingsByState).length < 12) fail(`Listings cover only ${Object.keys(s.listingsByState).length} states (need >= 12).`);

const region = (rows, r) => rows.filter((x) => x._region === r).length;
const focus = [['cleveland', 10, 6], ['columbus', 10, 6], ['dc-md', 12, 8]];
for (const [r, jobsMin, housingMin] of focus) {
  if (region(inv.jobs, r) < jobsMin) fail(`Focus region ${r}: ${region(inv.jobs, r)} jobs (need >= ${jobsMin}).`);
  if (region(inv.listings, r) < housingMin) fail(`Focus region ${r}: ${region(inv.listings, r)} listings (need >= ${housingMin}).`);
}
if (region(inv.jobs, 'other') < 10 || region(inv.listings, 'other') < 10) fail('Need >= 10 jobs and >= 10 listings in non-focus markets for radius testing.');
if (s.markets < 15) fail(`Only ${s.markets} markets represented (need >= 15).`);
const dcStates = new Set(inv.jobs.filter((j) => j._region === 'dc-md').map((j) => j.state));
for (const st of ['DC', 'MD']) if (!dcStates.has(st)) fail(`DC/MD region has no ${st} jobs.`);

// variety
const has = (obj, ...keys) => keys.every((k) => (obj[k] || 0) > 0);
if (!has(s.jobsByWorkplace, 'onsite', 'hybrid', 'remote')) fail('Jobs must include onsite, hybrid AND remote.');
if (!has(s.jobsByType, 'full_time', 'part_time')) fail('Jobs must include full_time AND part_time.');
if (Object.keys(s.jobsByType).length < 3) fail('Jobs need >= 3 employment types.');
if (!has(s.jobsByPayUnit, 'hour', 'year')) fail('Jobs must include hourly AND salaried pay.');
if (!has(s.jobsBySecondChance, 'explicit', 'none')) fail('Jobs must mix explicit second-chance and no-evidence postings.');
if (!has(by(inv.jobs, (j) => j.application_method), 'fairpath', 'external')) fail('Jobs must include Easy Apply AND external-apply postings.');
if (new Set(inv.jobs.map((j) => j.eligibility_rules.conviction_policy ?? 'unset')).size < 4) fail('Jobs need >= 4 distinct conviction-policy stances (incl. unset).');
if (inv.jobs.filter((j) => j.eligibility_rules.excluded_categories?.length).length < 3) fail('Need some postings with excluded offense categories.');
if (inv.jobs.filter((j) => j.easy_apply_enabled && j.application_questions.length).length < 10) fail('Need >= 10 Easy Apply jobs with employer questions.');
if (Object.keys(s.listingsByKind).length < 6) fail('Housing needs >= 6 property kinds.');
if (s.listingsFastTrack < 10 || s.listingsFastTrack > inv.listings.length - 10) fail('Housing needs a healthy FastTrack / Standard mix.');
if (!inv.listings.some((l) => l.bedrooms === 0) || !inv.listings.some((l) => l.bedrooms >= 4)) fail('Housing needs studios and 4+ bedroom homes.');
if (!inv.listings.some((l) => l.garage_spaces > 0) || !inv.listings.some((l) => l.has_yard) || !inv.listings.some((l) => l.furnished)) fail('Housing needs garages, yards and furnished units.');
if (new Set(inv.listings.map((l) => l.pet_policy)).size < 4) fail('Housing needs >= 4 pet policies.');
if (new Set(inv.listings.map((l) => JSON.stringify(l.required_application_documents))).size < 4) fail('Housing needs varied required-document sets.');
const mediaByListing = by(inv.media, (m) => m.listing_id);
for (const l of inv.listings) if ((mediaByListing[l.id] || 0) < 3) fail(`Listing "${l.title}" has < 3 photos.`);

// sanity of numbers and geography
for (const j of inv.jobs) {
  if (!(j.pay_min > 0 && j.pay_max > j.pay_min)) fail(`Job "${j.title}" has invalid pay range ${j.pay_min}-${j.pay_max}.`);
  const [lo, hi] = j.pay_period === 'hour' ? [10, 60] : j.pay_period === 'week' ? [700, 2600] : [30000, 160000];
  if (j.pay_min < lo || j.pay_max > hi) fail(`Job "${j.title}" pay ${j.pay_min}-${j.pay_max}/${j.pay_period} is outside realistic bounds.`);
  if (j.postal_code && !/^\d{5}$/.test(j.postal_code)) fail(`Job "${j.title}" has an invalid ZIP.`);
  if (j.latitude != null && (j.latitude < 24 || j.latitude > 50 || j.longitude > -66 || j.longitude < -125)) fail(`Job "${j.title}" coordinates are outside the continental US.`);
  if (j.workplace_type === 'remote' && (j.latitude != null || j.postal_code)) fail(`Remote job "${j.title}" must not carry a fixed location.`);
}
for (const l of inv.listings) {
  if (!/^\d{5}$/.test(l.postal_code)) fail(`Listing "${l.title}" has an invalid ZIP.`);
  if (l.latitude < 24 || l.latitude > 50 || l.longitude > -66 || l.longitude < -125) fail(`Listing "${l.title}" coordinates are outside the continental US.`);
  if (!(l.rent_monthly >= 400 && l.rent_monthly <= 6000)) fail(`Listing "${l.title}" rent $${l.rent_monthly} is unrealistic.`);
}

// ---------------------------------------------------------------------
// 2. Honesty: obviously TEST data, no real brands, no fabricated provider data
// ---------------------------------------------------------------------
for (const e of EMPLOYERS) if (!/\bDemo\b/.test(e.name)) fail(`Employer "${e.name}" must contain the word "Demo".`);
for (const o of OWNERS) if (!/\bDemo\b/.test(o.name)) fail(`Owner "${o.name}" must contain the word "Demo".`);
for (const j of inv.jobs) {
  if (!/\bDemo\b/.test(j.company_name)) fail(`Job "${j.title}" company "${j.company_name}" is not marked Demo.`);
  if (!/DEV test data/.test(j.description)) fail(`Job "${j.title}" description lacks the DEV test-data footer.`);
  if (j.source_label !== SEED_LABEL) fail(`Job "${j.title}" has source_label "${j.source_label}".`);
}
for (const l of inv.listings) {
  if (!l.address_line1.startsWith('[TEST] ')) fail(`Listing "${l.title}" address is not marked [TEST].`);
  if (!/DEV test listing/.test(l.description)) fail(`Listing "${l.title}" description lacks the DEV test-listing footer.`);
  if (l.source_label !== SEED_LABEL) fail(`Listing "${l.title}" has source_label "${l.source_label}".`);
  for (const k of ['walk_score', 'transit_score', 'bike_score', 'neighborhood_data_provider']) if (l[k] != null) fail(`Listing "${l.title}" sets ${k} — provider data must not be fabricated.`);
}
const REAL_BRANDS = ['amazon', 'walmart', 'target', 'ups', 'fedex', 'home depot', 'lowe', 'kroger', 'costco', 'starbucks', 'mcdonald', 'chipotle', 'marriott', 'hilton', 'hyatt', 'sherwin', 'cleveland clinic', 'ohio state', 'google', 'microsoft', 'apple', 'tesla', 'general motors', 'uber', 'lyft', 'doordash', 'cvs', 'walgreens', 'kaiser', 'dhl', 'xpo', 'ryder', 'zillow', 'greystar', 'avalonbay', 'equity residential', 'indeed', 'linkedin'];
const brandRe = new RegExp('\\b(' + REAL_BRANDS.map((b) => b.replace(/ /g, '\\s+')).join('|') + ')\\b', 'i');
for (const name of [...inv.jobs.map((j) => j.company_name), ...EMPLOYERS.map((e) => e.name), ...OWNERS.map((o) => o.name), ...inv.listings.map((l) => l.title)]) {
  if (brandRe.test(name)) fail(`"${name}" matches a real brand name — seed data must not impersonate real organizations.`);
}
for (const u of inv.users) {
  if (!u.email.endsWith('@' + SEED_EMAIL_DOMAIN)) fail(`Seed account ${u.email} must use the reserved ${SEED_EMAIL_DOMAIN} domain.`);
  if ('password' in u) fail(`Seed account ${u.email} carries a password — accounts must be passwordless.`);
}
for (const o of inv.offenses) {
  if (!o.offense_code.startsWith('DEV-')) fail(`Offense ${o.offense_code} must use a DEV- test code.`);
  if (o.source_agency !== OFFENSE_SOURCE_AGENCY) fail(`Offense ${o.offense_code} lacks the test-data source_agency marker.`);
  if (o.last_verified_at !== null) fail(`Offense ${o.offense_code} claims verification — test entries must never be marked verified.`);
}
const cats = new Set(inv.offenses.map((o) => o.offense_category));
if (cats.size < 9) fail(`Offense catalog covers only ${cats.size} of 9 taxonomy categories.`);
for (const st of ['OH', 'MD', 'DC']) if (!inv.offenses.some((o) => o.state_code === st)) fail(`Offense catalog missing ${st}.`);
if (!inv.offenses.some((o) => o.jurisdiction_type === 'federal')) fail('Offense catalog missing federal entries.');

// flags
const flag = (k) => inv.flags.find((f) => f.key === k);
if (flag('justice_eligibility_engine_enabled')?.enabled !== false) fail('The seed must never enable justice_eligibility_engine_enabled.');
if (flag('marketplace_enabled')?.enabled !== true) fail('marketplace_enabled should be seeded true.');
for (const k of ['fairpath_ai_enabled', 'credit_builder_enabled', 'record_relief_enabled']) if (flag(k)?.enabled !== false) fail(`${k} should be seeded false.`);

// ---------------------------------------------------------------------
// 3. Determinism + schema validity (real production CHECKs / NOT NULLs / types)
// ---------------------------------------------------------------------
if (JSON.stringify(buildInventory()) !== JSON.stringify(inv)) fail('Inventory is not deterministic (two builds differ).');
const problems = validateInventory(inv);
for (const p of problems.slice(0, 15)) fail('Schema validation: ' + p);
{
  const bad = buildInventory();
  bad.jobs[0].workplace_type = 'sideways';
  bad.listings[0].status = 'live';
  delete bad.jobs[1].title;
  if (validateInventory(bad).length < 3) fail('Validator negative control failed: deliberately bad rows were not all caught.');
}

// ---------------------------------------------------------------------
// 4. Safety guards (pure unit tests — no network)
// ---------------------------------------------------------------------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeJwt = (payload) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.${'x'.repeat(20)}`; // unsigned, test-only
const devUrl = `https://${DEV_PROJECT_REF}.supabase.co`;
const prodUrl = `https://${PROD_PROJECT_REF}.supabase.co`;
const goodKey = fakeJwt({ role: 'service_role', ref: DEV_PROJECT_REF });
const mustThrow = (name, args, re) => { try { assertDevTarget(args); fail(`Guard did not refuse: ${name}`); } catch (e) { if (re && !re.test(e.message)) fail(`Guard refused "${name}" for the wrong reason: ${e.message.split('\n')[1]}`); } };
const mustPass = (name, args) => { try { assertDevTarget(args); } catch (e) { fail(`Guard wrongly refused: ${name} (${e.message.split('\n')[1]})`); } };

mustPass('dry run needs no key', { url: devUrl, apply: false });
mustPass('valid DEV apply (service_role JWT for DEV)', { url: devUrl, serviceKey: goodKey, confirmDev: true, apply: true, linkedRef: DEV_PROJECT_REF });
mustPass('valid DEV apply (opaque sb_secret_ key)', { url: devUrl, serviceKey: 'sb_secret_abc123', confirmDev: true, apply: true });
mustThrow('production URL', { url: prodUrl, serviceKey: goodKey, confirmDev: true, apply: true }, /PRODUCTION/);
mustThrow('production URL even for a dry run', { url: prodUrl, apply: false }, /PRODUCTION/);
mustThrow('unknown project ref', { url: 'https://abcdefghijklmnopqrst.supabase.co', serviceKey: goodKey, confirmDev: true, apply: true }, /not the DEV project/);
mustThrow('non-supabase URL', { url: 'https://example.com', serviceKey: goodKey, confirmDev: true, apply: true }, /missing or not/);
mustThrow('missing URL', { serviceKey: goodKey, confirmDev: true, apply: true }, /missing or not/);
mustThrow('CLI linked to production', { url: devUrl, serviceKey: goodKey, confirmDev: true, apply: true, linkedRef: PROD_PROJECT_REF }, /project-ref/);
mustThrow('no --confirm-dev', { url: devUrl, serviceKey: goodKey, confirmDev: false, apply: true }, /--confirm-dev/);
mustThrow('no key', { url: devUrl, confirmDev: true, apply: true }, /SUPABASE_SERVICE_ROLE_KEY/);
mustThrow('publishable key', { url: devUrl, serviceKey: 'sb_publishable_abc', confirmDev: true, apply: true }, /publishable/);
mustThrow('anon-role JWT', { url: devUrl, serviceKey: fakeJwt({ role: 'anon', ref: DEV_PROJECT_REF }), confirmDev: true, apply: true }, /anon key/);
mustThrow('service_role JWT for the PRODUCTION project', { url: devUrl, serviceKey: fakeJwt({ role: 'service_role', ref: PROD_PROJECT_REF }), confirmDev: true, apply: true }, /not DEV/);
mustThrow('garbage key', { url: devUrl, serviceKey: 'hunter2', confirmDev: true, apply: true }, /neither/);

// ---------------------------------------------------------------------
// 5. The runner itself: dry run works offline; unsafe invocations refuse
// ---------------------------------------------------------------------
{
  const cleanEnv = { ...process.env }; delete cleanEnv.SUPABASE_SERVICE_ROLE_KEY; delete cleanEnv.SEED_SUPABASE_URL;
  const run = (args, env = {}) => spawnSync(process.execPath, ['scripts/seed-dev.mjs', ...args], { cwd: root, env: { ...cleanEnv, EXPO_PUBLIC_SUPABASE_URL: devUrl, ...env }, encoding: 'utf8', timeout: 60000 });
  const dry = run([]);
  if (dry.status !== 0 || !/DRY RUN/.test(dry.stdout) || !/no network calls/.test(dry.stdout)) fail('Runner dry run failed or did not state it is offline: ' + (dry.stderr || dry.stdout).slice(0, 200));
  const noConfirm = run(['--apply']);
  if (noConfirm.status === 0) fail('Runner --apply without --confirm-dev/key must fail.');
  const prod = run(['--apply', '--confirm-dev'], { SEED_SUPABASE_URL: prodUrl, SUPABASE_SERVICE_ROLE_KEY: goodKey });
  if (prod.status === 0 || !/PRODUCTION/.test(prod.stderr)) fail('Runner must refuse a production URL even with a key and --confirm-dev.');
  const resetNoConfirm = run(['--reset']);
  if (resetNoConfirm.status === 0) fail('Runner --reset without --confirm-dev must fail.');
  const src = read('scripts/seed-dev.mjs');
  if (!/process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(src)) fail('Runner must read the service key from the environment.');
  if (/readFileSync\([^)]*(service|secret)/i.test(src)) fail('Runner must never read the service key from a file.');
  if (/console\.(log|error|warn)\([^)]*serviceKey/.test(src)) fail('Runner must never print the service key.');
  if (!/eq\('source_label', SEED_LABEL\)/.test(src)) fail('Reset must be limited to rows labelled with the seed source_label.');
}

// ---------------------------------------------------------------------
// 6. Repo hygiene: no secrets committed, key can't be stashed in a tracked file
// ---------------------------------------------------------------------
{
  const gi = read('.gitignore');
  if (!/^\.env\.seed\*/m.test(gi)) fail('.gitignore must ignore .env.seed* files.');
  const secretRe = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9]{8,}|SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"]?[A-Za-z0-9._-]{20,}/;
  const scan = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : scan(rel);
    return /\.(mjs|js|ts|tsx|json|md|sql|csv|toml|example)$/.test(e.name) && e.name !== 'audit-seed.mjs' ? [rel] : [];
  });
  for (const f of [...scan('supabase'), ...scan('scripts'), ...scan('src'), '.env.example', 'package.json']) {
    if (secretRe.test(read(f))) fail(`${f} appears to contain a service-role/secret key.`);
  }
}

// ---------------------------------------------------------------------
// 7. App: fake-data fallbacks are gone; honest states exist
// ---------------------------------------------------------------------
{
  const srcFiles = (function walk(d) {
    return fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => {
      const rel = path.join(d, e.name);
      return e.isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(e.name) ? [rel] : [];
    });
  })('src');
  const banned = [/DEMO_JOBS/, /demoJobs/, /DEMO_MEDIA/, /application_method\s*===\s*'demo'/, /startsWith\('demo-'\)/, /demoMode/, /Preview mode/, /Second Chance Logistics/, /FairPath Demo/, /core\/demo\//];
  for (const f of srcFiles) { const t = read(f); for (const re of banned) if (re.test(t)) fail(`${f} still contains fake-data path ${re}.`); }
  if (exists('src/core/demo')) fail('src/core/demo must not exist anymore.');
  const home = read('src/app/home.tsx');
  if (!/NO OPEN JOBS RIGHT NOW/.test(home)) fail('Home is missing its honest empty state.');
  if (!/TRY AGAIN/.test(home) || !/setReloadKey/.test(home)) fail('Home is missing its error/retry state.');
  if (/catch\(\(\)=>\{if\(active\)setFeatured/.test(home)) fail('Home must not replace a failed jobs query with fake jobs.');
  const cp = read('src/app/complete-profile.tsx');
  if (!/Couldn't load your profile/.test(cp) || !/setLoadFailed\(true\)/.test(cp)) fail('complete-profile is missing its real load-failure state.');
  const jd = read('src/app/job/[id].tsx');
  if (/demo/i.test(jd)) fail('job/[id].tsx still references demo data.');
}

// ---------------------------------------------------------------------
// 8. Docs + scripts
// ---------------------------------------------------------------------
if (!exists('supabase/seed/README.md')) fail('supabase/seed/README.md (runbook) is missing.');
const pkg = JSON.parse(read('package.json'));
for (const k of ['seed:dev:dry', 'seed:dev', 'seed:dev:reset', 'test:seed']) if (!pkg.scripts?.[k]) fail(`package.json is missing script "${k}".`);

if (failures.length) {
  console.error('Seed/inventory audit failed:\n- ' + failures.slice(0, 40).join('\n- ') + (failures.length > 40 ? `\n... and ${failures.length - 40} more` : ''));
  process.exit(1);
}
console.log(`Seed/inventory audit passed: ${s.jobs} jobs, ${s.listings} listings, ${s.media} photos, ${s.offenses} test offenses, ${s.users} accounts across ${s.markets} markets; schema-validated against production CHECKs; 14 guard cases + 4 runner invocations; fake-data fallbacks removed.`);
