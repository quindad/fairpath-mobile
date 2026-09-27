// FairPath DEV Record Relief fixture seed. DEV ONLY.
//
//   node scripts/seed-dev-record-relief.mjs                         DRY RUN (default)
//   node scripts/seed-dev-record-relief.mjs --apply --confirm-dev   loads fictional TEST jurisdictions/rules/forms/pathways
//   node scripts/seed-dev-record-relief.mjs --reset --confirm-dev   removes ONLY fixture_set = 'record-relief-v1' rows
//
// Same guards as the other seeds: DEV project only, key only from SUPABASE_SERVICE_ROLE_KEY. It sets
// app_config.environment = 'dev' (already set by the resources seed), which the database requires before it accepts
// dev_fixture rows. None of this is real law. Production legal data must come from a verified official source.
import fs from 'node:fs';
import path from 'node:path';
import { assertDevTarget, DEV_PROJECT_REF, projectRefFromUrl } from '../supabase/seed/lib/guards.mjs';
import { RR_FIXTURE_SET, buildRecordReliefFixtures } from '../supabase/seed/data/record-relief-fixtures.mjs';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const reset = args.has('--reset');
const confirmDev = args.has('--confirm-dev');
const writing = apply || reset;

const envFile = path.join(root, '.env.local');
const url = process.env.SEED_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || (fs.existsSync(envFile) ? (/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m.exec(fs.readFileSync(envFile, 'utf8')) ?? [])[1]?.trim() : null);
const linkedFile = path.join(root, 'supabase/.temp/project-ref');
const linkedRef = fs.existsSync(linkedFile) ? fs.readFileSync(linkedFile, 'utf8').trim() : null;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg) { console.error('\n' + msg + '\n'); process.exit(1); }
let target;
try { target = assertDevTarget({ url, serviceKey, linkedRef, confirmDev, apply: writing }); }
catch (e) { if (writing) fail(e.message); console.warn('NOTE (dry run continues): ' + e.message.split('\n').slice(1).join('; ').trim()); }

const fx = buildRecordReliefFixtures(new Date());
console.log('FairPath DEV Record Relief fixtures (fictional, provenance-marked, NOT real law)');
console.log(`  jurisdictions ${fx.jurisdictions.length} · rules ${fx.rules.length} · forms ${fx.forms.length} · federal pathways ${fx.pathways.length}   fixture_set ${RR_FIXTURE_SET}`);
console.log(`  target project: ${target ? target.ref : projectRefFromUrl(url) || 'unresolved'}  (DEV ref = ${DEV_PROJECT_REF})`);

if (!writing) {
  console.log('\nDRY RUN: nothing was written and no network calls were made.');
  console.log('To apply (DEV only): set SUPABASE_SERVICE_ROLE_KEY for this shell, then  npm run seed:dev:relief');
  process.exit(0);
}

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
async function must(label, promise) { const { data, error } = await promise; if (error) fail(`${label} failed: ${error.message}`); return data; }

async function removeFixtures() {
  // Order matters: cases reference jurisdictions, rules reference jurisdictions, evaluations reference rules (set null).
  const jur = fx.jurisdictions.map((j) => j.code);
  await must('delete cases in TEST jurisdictions', sb.from('record_relief_cases').delete().in('jurisdiction_code', jur));
  await must('delete forms', sb.from('record_relief_forms').delete().eq('fixture_set', RR_FIXTURE_SET));
  await must('delete rules', sb.from('record_relief_rules').delete().eq('fixture_set', RR_FIXTURE_SET));
  await must('delete pathways', sb.from('record_relief_federal_pathways').delete().eq('fixture_set', RR_FIXTURE_SET));
  await must('delete jurisdictions', sb.from('record_relief_jurisdictions').delete().eq('fixture_set', RR_FIXTURE_SET));
  console.log('  removed fixture rows (and any member cases in TEST jurisdictions)');
}

if (reset) { await removeFixtures(); console.log('Done.'); process.exit(0); }

await must('app_config environment', sb.from('app_config').upsert({ key: 'environment', value: 'dev' }, { onConflict: 'key' }));
await removeFixtures();
await must('jurisdictions', sb.from('record_relief_jurisdictions').upsert(fx.jurisdictions, { onConflict: 'code' }));
await must('rules', sb.from('record_relief_rules').upsert(fx.rules, { onConflict: 'rule_key,rule_version' }));
await must('forms', sb.from('record_relief_forms').upsert(fx.forms, { onConflict: 'form_key,jurisdiction_code' }));
await must('pathways', sb.from('record_relief_federal_pathways').upsert(fx.pathways, { onConflict: 'pathway_key,pathway_version' }));
console.log('Done. Record Relief TEST fixtures are loaded in DEV.');
