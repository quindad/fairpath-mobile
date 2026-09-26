// FairPath DEV inventory seed runner.
//
//   node scripts/seed-dev.mjs                          DRY RUN (default): validates + prints the plan. No network.
//   node scripts/seed-dev.mjs --apply --confirm-dev    creates seed accounts + upserts inventory in the DEV project
//   node scripts/seed-dev.mjs --reset --confirm-dev    deletes ONLY rows labelled "FairPath DEV Seed" (jobs, listings, test offenses)
//   node scripts/seed-dev.mjs --reset --reset-users --confirm-dev   ... and the seed Auth accounts (cascades their inventory)
//
// SAFETY: this script can only ever target the fairpath-mobile-dev project (see supabase/seed/lib/guards.mjs).
// The service-role key is read ONLY from the SUPABASE_SERVICE_ROLE_KEY environment variable — never from a file,
// never printed. Re-running --apply is idempotent (upserts on deterministic ids).

import fs from 'node:fs';
import path from 'node:path';
import { assertDevTarget, DEV_PROJECT_REF, projectRefFromUrl } from '../supabase/seed/lib/guards.mjs';
import { buildInventory, summarize, materializeJob, materializeListing, SEED_LABEL } from '../supabase/seed/build-inventory.mjs';
import { validateInventory } from '../supabase/seed/validate.mjs';
import { OFFENSE_SOURCE_AGENCY } from '../supabase/seed/data/offenses.mjs';
import { SEED_EMAIL_DOMAIN } from '../supabase/seed/data/accounts.mjs';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const reset = args.has('--reset');
const resetUsers = args.has('--reset-users');
const confirmDev = args.has('--confirm-dev');
const writing = apply || reset;

function readEnvLocalUrl() {
  const file = path.join(root, '.env.local');
  if (!fs.existsSync(file)) return null;
  const m = /^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m.exec(fs.readFileSync(file, 'utf8'));
  return m ? m[1].trim() : null;
}
function readLinkedRef() {
  const file = path.join(root, 'supabase/.temp/project-ref');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
}

const url = process.env.SEED_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || readEnvLocalUrl();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg) { console.error('\n' + msg + '\n'); process.exit(1); }

// ---- 1. safety guards (always run, even for dry runs, so misconfiguration is visible early) ----------
let target;
try {
  target = assertDevTarget({ url, serviceKey, linkedRef: readLinkedRef(), confirmDev, apply: writing });
} catch (e) {
  if (writing) fail(e.message);
  // Dry run: report the problem but keep going (a dry run never touches the network).
  console.warn('NOTE (dry run continues): ' + e.message.split('\n').slice(1).join('; ').trim());
}

// ---- 2. build + validate ----------------------------------------------------------------------------
const inv = buildInventory();
const problems = validateInventory(inv);
if (problems.length) fail('Inventory failed validation against the production schema:\n - ' + problems.slice(0, 30).join('\n - '));

const s = summarize(inv);
console.log('FairPath DEV seed inventory (validated against production schema, deterministic)');
console.log(`  seed accounts : ${s.users}  (${inv.users.filter((u) => u.kind === 'employer').length} employers, ${inv.users.filter((u) => u.kind === 'owner').length} property managers) — created WITHOUT passwords`);
console.log(`  jobs          : ${s.jobs}   across ${Object.keys(s.jobsByState).length} states, ${s.jobZips} ZIPs   (${JSON.stringify(s.jobsByRegion)})`);
console.log(`  housing       : ${s.listings}   across ${Object.keys(s.listingsByState).length} states, ${s.listingZips} ZIPs   (${JSON.stringify(s.listingsByRegion)})   FastTrack: ${s.listingsFastTrack}`);
console.log(`  housing media : ${s.media} photos`);
console.log(`  offense_catalog: ${s.offenses} TEST entries (DEV- codes, never verified)`);
console.log(`  feature_flags : ${inv.flags.length} ensured (insert-if-missing; existing values never overwritten; engine flag stays false)`);
console.log(`  target project: ${target ? target.ref : projectRefFromUrl(url) || 'unresolved'}  (DEV ref = ${DEV_PROJECT_REF})`);

if (!writing) {
  console.log('\nDRY RUN — nothing was written and no network calls were made.');
  console.log('To apply (DEV only):  set SUPABASE_SERVICE_ROLE_KEY for this shell, then  npm run seed:dev');
  process.exit(0);
}

// ---- 3. writes (DEV only; guards above already passed) ----------------------------------------------
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function must(label, promise) {
  const { data, error, count } = await promise;
  if (error) fail(`${label} failed: ${error.message}`);
  return { data, count };
}
async function chunked(table, rows, options) {
  for (let i = 0; i < rows.length; i += 50) await must(`${table} upsert`, sb.from(table).upsert(rows.slice(i, i + 50), options));
  console.log(`  ✓ ${table}: ${rows.length} rows upserted`);
}
async function listSeedUsers() {
  const map = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail('listUsers failed: ' + error.message);
    for (const u of data.users) map.set((u.email || '').toLowerCase(), u.id);
    if (data.users.length < 200) break;
  }
  return map;
}

// preflight: confirm the DEV database has been migrated
{
  const { error } = await sb.from('feature_flags').select('key').limit(1);
  if (error) fail(`Preflight failed — is DEV migrated? (feature_flags: ${error.message}). Run supabase db push against DEV first.`);
}

if (reset) {
  console.log('\nRESET (only rows labelled "' + SEED_LABEL + '")');
  await must('delete housing_listings', sb.from('housing_listings').delete().eq('source_label', SEED_LABEL)); // housing_media cascades
  await must('delete jobs', sb.from('jobs').delete().eq('source_label', SEED_LABEL));
  await must('delete offense_catalog', sb.from('offense_catalog').delete().eq('source_agency', OFFENSE_SOURCE_AGENCY));
  console.log('  ✓ seed jobs, listings (+media) and test offenses removed');
  if (resetUsers) {
    const seedRe = new RegExp(`^seed-(employer|owner)-[a-z0-9-]+@${SEED_EMAIL_DOMAIN.replace(/\./g, '\\.')}$`);
    const existing = await listSeedUsers();
    let n = 0;
    for (const [email, id] of existing) {
      if (!seedRe.test(email)) continue;
      const { error } = await sb.auth.admin.deleteUser(id);
      if (error) fail(`deleteUser ${email} failed: ${error.message}`);
      n++;
    }
    console.log(`  ✓ ${n} seed accounts deleted`);
  }
  if (!apply) { console.log('\nReset complete.'); process.exit(0); }
}

console.log('\nAPPLY');
// accounts (real Auth users: jobs.employer_id / housing_listings.owner_id are FKs to auth.users)
const existing = await listSeedUsers();
const ids = new Map();
let created = 0;
for (const u of inv.users) {
  const email = u.email.toLowerCase();
  if (existing.has(email)) { ids.set(`${u.kind}:${u.key}`, existing.get(email)); continue; }
  const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: u.user_metadata });
  if (error) fail(`createUser ${email} failed: ${error.message}`);
  ids.set(`${u.kind}:${u.key}`, data.user.id);
  created++;
}
console.log(`  ✓ accounts: ${inv.users.length} (${created} created, ${inv.users.length - created} already existed)`);
{
  const { data } = await must('profiles check', sb.from('profiles').select('id, account_type').in('id', [...ids.values()]));
  const have = new Set((data || []).map((p) => p.id));
  const missing = [...ids.values()].filter((id) => !have.has(id)).length;
  if (missing) console.warn(`  ! ${missing} seed accounts have no profiles row (handle_new_user trigger did not run?)`);
}

const now = Date.now();
await chunked('jobs', inv.jobs.map((j) => materializeJob(j, ids.get(`employer:${j._employerKey}`), now)), { onConflict: 'id' });
await chunked('housing_listings', inv.listings.map((l) => materializeListing(l, ids.get(`owner:${l._ownerKey}`), now)), { onConflict: 'id' });
await chunked('housing_media', inv.media, { onConflict: 'id' });
await chunked('offense_catalog', inv.offenses, { onConflict: 'jurisdiction_name,offense_code,effective_start' });
await chunked('feature_flags', inv.flags, { onConflict: 'key', ignoreDuplicates: true });

console.log('\nDone. Posting dates/expirations are relative to now — re-run `npm run seed:dev` to refresh them (jobs expire hourly via pg_cron).');
