import { buildResourceFixtures } from '../../supabase/seed/data/resources-fixtures.mjs';
import { buildRecordReliefFixtures } from '../../supabase/seed/data/record-relief-fixtures.mjs';

/** Generic bulk insert of plain objects into `table` (as the local superuser, i.e. like the service role seed). */
export async function insertRows(db, table, rows) {
  if (!rows.length) return;
  // Rows are grouped by which keys they provide, and only those columns are inserted, so column defaults still apply.
  const groups = new Map();
  for (const r of rows) {
    const key = Object.keys(r).sort().join(',');
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const [key, list] of groups) {
    const cols = key.split(',');
    const names = cols.map((c) => '"' + c + '"').join(', ');
    await db.query('insert into ' + table + ' (' + names + ') select ' + names + ' from jsonb_populate_recordset(null::' + table + ', $1::jsonb)', [JSON.stringify(list)]);
  }
}

/** Loads the DEV Resources fixtures the same way seed-dev-resources.mjs does (environment flag first). */
export async function loadResourceFixtures(db, now = new Date()) {
  await db.query(`insert into public.app_config (key, value) values ('environment', '"dev"'::jsonb) on conflict (key) do update set value = excluded.value`);
  const rows = buildResourceFixtures(now);
  await insertRows(db, 'public.postal_codes', rows.postalCodes.map((p) => ({ ...p })));
  await insertRows(db, 'public.resource_organizations', rows.orgs);
  await insertRows(db, 'public.resources', rows.resources);
  await insertRows(db, 'public.resource_category_links', rows.links);
  await insertRows(db, 'public.resource_locations', rows.locations);
  await insertRows(db, 'public.resource_service_areas', rows.areas);
  await insertRows(db, 'public.resource_hours', rows.hours);
  await insertRows(db, 'public.resource_eligibility', rows.eligibility);
  await insertRows(db, 'public.resource_contacts', rows.contacts);
  await insertRows(db, 'public.resource_required_documents', rows.docs);
  await insertRows(db, 'public.resource_verification_events', rows.events);
  return rows;
}

/** Tiny test runner shared by the local SQL suites. */
export function makeRunner() {
  const results = [];
  return {
    async test(name, fn) {
      try { await fn(); results.push(true); console.log('PASS ' + name); }
      catch (e) { results.push(false); console.log('FAIL ' + name + '\n     ' + e.message); }
    },
    ok(c, m) { if (!c) throw new Error(m); },
    done(label) {
      const failed = results.filter((r) => !r).length;
      console.log(`\n${results.length - failed}/${results.length} passed (${label}).`);
      process.exit(failed ? 1 : 0);
    },
  };
}

/** Loads the DEV Record Relief fixtures (fictional TEST jurisdictions, rules, forms, federal pathways). */
export async function loadRecordReliefFixtures(db, now = new Date()) {
  await db.query(`insert into public.app_config (key, value) values ('environment', '"dev"'::jsonb) on conflict (key) do update set value = excluded.value`);
  const fx = buildRecordReliefFixtures(now);
  await insertRows(db, 'public.record_relief_jurisdictions', fx.jurisdictions);
  await insertRows(db, 'public.record_relief_rules', fx.rules);
  await insertRows(db, 'public.record_relief_forms', fx.forms);
  await insertRows(db, 'public.record_relief_federal_pathways', fx.pathways);
  return fx;
}
