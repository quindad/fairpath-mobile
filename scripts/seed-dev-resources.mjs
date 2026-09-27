// FairPath DEV Resources fixture seed. DEV ONLY.
//
//   node scripts/seed-dev-resources.mjs                         DRY RUN (default): validates + prints the plan. No network.
//   node scripts/seed-dev-resources.mjs --apply --confirm-dev   loads the fictional fixtures into the DEV project
//   node scripts/seed-dev-resources.mjs --reset --confirm-dev   deletes ONLY fixture_set = 'resources-v1' rows
//
// Safety: same guards as the inventory seed (DEV project only; key only from SUPABASE_SERVICE_ROLE_KEY).
// It sets app_config.environment = 'dev' on the DEV project, which is what lets the database accept dev_fixture rows.
// Production never has that value, so production rejects these rows even if this script were pointed there.
import fs from 'node:fs';
import path from 'node:path';
import { assertDevTarget, DEV_PROJECT_REF, projectRefFromUrl } from '../supabase/seed/lib/guards.mjs';
import { FIXTURE_SET, buildResourceFixtures, summarizeResourceFixtures } from '../supabase/seed/data/resources-fixtures.mjs';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const reset = args.has('--reset');
const confirmDev = args.has('--confirm-dev');
const writing = apply || reset;

function readEnvLocalUrl() {
  const file = path.join(root, '.env.local');
  if (!fs.existsSync(file)) return null;
  const m = /^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m.exec(fs.readFileSync(file, 'utf8'));
  return m ? m[1].trim() : null;
}
const linkedFile = path.join(root, 'supabase/.temp/project-ref');
const linkedRef = fs.existsSync(linkedFile) ? fs.readFileSync(linkedFile, 'utf8').trim() : null;
const url = process.env.SEED_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || readEnvLocalUrl();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg) { console.error('\n' + msg + '\n'); process.exit(1); }

let target;
try {
  target = assertDevTarget({ url, serviceKey, linkedRef, confirmDev, apply: writing });
} catch (e) {
  if (writing) fail(e.message);
  console.warn('NOTE (dry run continues): ' + e.message.split('\n').slice(1).join('; ').trim());
}

const rows = buildResourceFixtures(new Date());
const sum = summarizeResourceFixtures(rows);
console.log('FairPath DEV Resources fixtures (fictional, provenance-marked, deterministic)');
console.log(`  organizations : ${sum.organizations}`);
console.log(`  resources     : ${sum.resources}   ${JSON.stringify(sum.byState)}`);
console.log(`  locations ${sum.locations} · service areas ${sum.serviceAreas} · hours ${sum.hours} · contacts ${sum.contacts}`);
console.log(`  fixture_set   : ${FIXTURE_SET}`);
console.log(`  target project: ${target ? target.ref : projectRefFromUrl(url) || 'unresolved'}  (DEV ref = ${DEV_PROJECT_REF})`);

if (!writing) {
  console.log('\nDRY RUN — nothing was written and no network calls were made.');
  console.log('To apply (DEV only): set SUPABASE_SERVICE_ROLE_KEY for this shell, then  npm run seed:dev:resources');
  process.exit(0);
}

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) fail(`${label} failed: ${error.message}`);
  return data;
}
async function insertAll(table, list, options = { onConflict: 'id' }) {
  for (let i = 0; i < list.length; i += 100) await must(`${table} upsert`, sb.from(table).upsert(list.slice(i, i + 100), options));
  console.log(`  ✓ ${table}: ${list.length} rows`);
}

async function removeFixtures() {
  // Organizations cascade to resources and every child table (verification events included).
  await must('delete fixture organizations', sb.from('resource_organizations').delete().eq('fixture_set', FIXTURE_SET));
  console.log('  ✓ fixture organizations and their resources removed');
}

if (reset) {
  console.log('\nResetting fixtures...');
  await removeFixtures();
  console.log('Done.');
  process.exit(0);
}

console.log('\nApplying fixtures...');
// The guard trigger only accepts dev_fixture rows when this is set. Only ever written to the DEV project.
await must('app_config environment', sb.from('app_config').upsert({ key: 'environment', value: 'dev' }, { onConflict: 'key' }));
console.log("  ✓ app_config.environment = 'dev'");

await removeFixtures(); // deterministic ids: replace cleanly so removed/changed fixtures never linger
await insertAll('postal_codes', rows.postalCodes, { onConflict: 'postal_code', ignoreDuplicates: true });
await insertAll('resource_organizations', rows.orgs);
await insertAll('resources', rows.resources);
await insertAll('resource_category_links', rows.links, { onConflict: 'resource_id,category_slug' });
await insertAll('resource_locations', rows.locations);
await insertAll('resource_service_areas', rows.areas);
await insertAll('resource_hours', rows.hours);
await insertAll('resource_eligibility', rows.eligibility);
await insertAll('resource_contacts', rows.contacts);
await insertAll('resource_required_documents', rows.docs);
await insertAll('resource_verification_events', rows.events, { onConflict: 'id', ignoreDuplicates: true });
console.log('\nDone. Resources fixtures are loaded in DEV.');
