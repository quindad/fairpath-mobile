// Regression suite for the Record Relief DEV fixtures. `npm run test:relief-fixtures`
// Reproduces how the DEV seed really writes (PostgREST bulk upsert: union of keys, omitted keys become NULL, defaults NOT
// applied) against the real migrated schema, and derives the required columns from the schema itself, so a fixture
// missing any required column fails here, locally, before it can reach DEV.
import { createLocalDb } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';
import { buildRecordReliefFixtures, RR_FIXTURE_SET } from '../supabase/seed/data/record-relief-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }
const fx = buildRecordReliefFixtures(new Date());
const TABLES = { jurisdictions: 'record_relief_jurisdictions', rules: 'record_relief_rules', forms: 'record_relief_forms', pathways: 'record_relief_federal_pathways' };

async function requiredColumns(table) {
  const r = await db.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 and is_nullable = 'NO' and column_name not in ('id', 'created_at')",
    [table],
  );
  return r.rows.map((x) => x.column_name);
}

/** Faithful PostgREST simulation: every row gets every key seen in the batch; missing keys are NULL. */
async function postgrestBulkInsert(table, rows) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const names = cols.map((c) => '"' + c + '"').join(', ');
  const padded = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
  await db.query('insert into public.' + table + ' (' + names + ') select ' + names + ' from jsonb_populate_recordset(null::public.' + table + ', $1::jsonb)', [JSON.stringify(padded)]);
}

await test('every fixture row supplies every NOT NULL column explicitly (none rely on a database default)', async () => {
  for (const [key, table] of Object.entries(TABLES)) {
    const cols = await requiredColumns(table);
    for (const row of fx[key]) for (const c of cols) {
      ok(row[c] !== undefined && row[c] !== null, table + ' row ' + (row.rule_key ?? row.form_key ?? row.pathway_key ?? row.code) + ' omits required column "' + c + '"');
    }
  }
});

await test('rows in one batch all carry the same column set (no NULL padding possible)', async () => {
  for (const key of Object.keys(TABLES)) {
    const sets = new Set(fx[key].map((r) => Object.keys(r).sort().join(',')));
    ok(sets.size === 1, key + ': rows have ' + sets.size + ' different key sets');
  }
});

await test('the DEV seed write path (PostgREST-style bulk insert) succeeds for all four tables', async () => {
  await db.query("insert into public.app_config (key, value) values ('environment', '\"dev\"'::jsonb) on conflict (key) do update set value = excluded.value");
  for (const key of ['jurisdictions', 'rules', 'forms', 'pathways']) await postgrestBulkInsert(TABLES[key], fx[key]);
  const n = await db.query('select count(*)::int as r from public.record_relief_rules where fixture_set = $1', [RR_FIXTURE_SET]);
  ok(n.rows[0].r === fx.rules.length, 'all rules loaded');
});

await test('the original bug is caught: a row omitting a required column is rejected (NOT NULL is never weakened)', async () => {
  const first = fx.rules[0];
  const { requires_restitution_paid, ...missing } = first;
  let message = '';
  try { await postgrestBulkInsert('record_relief_rules', [{ ...missing, rule_key: 'regress-missing-col' }, { ...first, rule_key: 'regress-full-row' }]); } catch (e) { message = String(e.message); }
  ok(/requires_restitution_paid|not-null|null value/i.test(message), 'a NULL requires_restitution_paid must be rejected by the schema, got: ' + message.slice(0, 120));
  ok(typeof requires_restitution_paid === 'boolean', 'fixture rows carry the boolean explicitly');
});

await test('rerun after a partial failure is safe: delete by fixture_set then re-insert is idempotent', async () => {
  const wipe = async () => {
    await db.query('delete from public.record_relief_forms where fixture_set = $1', [RR_FIXTURE_SET]);
    await db.query('delete from public.record_relief_rules where fixture_set = $1', [RR_FIXTURE_SET]);
    await db.query('delete from public.record_relief_federal_pathways where fixture_set = $1', [RR_FIXTURE_SET]);
    await db.query('delete from public.record_relief_jurisdictions where fixture_set = $1', [RR_FIXTURE_SET]);
  };
  const reseed = async () => { await wipe(); for (const key of ['jurisdictions', 'rules', 'forms', 'pathways']) await postgrestBulkInsert(TABLES[key], fx[key]); };
  await reseed(); await reseed();
  // The failed DEV run left jurisdictions only (rules failed); rerunning from that state must converge.
  await db.query('delete from public.record_relief_forms where fixture_set = $1', [RR_FIXTURE_SET]);
  await db.query('delete from public.record_relief_rules where fixture_set = $1', [RR_FIXTURE_SET]);
  await reseed();
  const c = await db.query('select (select count(*) from public.record_relief_rules where fixture_set = $1)::int as r, (select count(*) from public.record_relief_forms where fixture_set = $1)::int as f, (select count(*) from public.record_relief_jurisdictions where fixture_set = $1)::int as j', [RR_FIXTURE_SET]);
  ok(c.rows[0].r === fx.rules.length && c.rows[0].f === fx.forms.length && c.rows[0].j === fx.jurisdictions.length, 'exact counts after reruns: ' + JSON.stringify(c.rows[0]));
});

done('Record Relief fixtures');
