// Regression: "published + verified" is NOT the full save_resource() contract. It also requires the organization to
// be active and the row's freshness to be fresh/stale (not expired), enforced by resource_is_visible(). A harness (or
// any future caller) that infers availability from a subset of base-table columns can pick a row that is published
// and verified but still fails save_resource() with RESOURCE_UNAVAILABLE. `npm run test:resource-availability`
import { createLocalDb, addUser, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }
const M = await addUser(db, 'm@test.local');
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];

async function org(status) {
  return (await one(`insert into public.resource_organizations (name, slug, org_type, status) values ($1, $2, 'nonprofit', $3) returning id`,
    ['Org ' + status + Math.random(), 'org-' + status + '-' + Math.random().toString(36).slice(2), status])).id;
}
/** last_verified_days_ago: 0 = now (fresh); omit for null (never verified). */
async function resource(orgId, { publish_status = 'published', verification_state = 'verified', last_verified_days_ago = 0, verify_by = null }) {
  return (await one(`insert into public.resources (organization_id, title, summary, publish_status, verification_state, last_verified_at, verify_by)
    values ($1, 'Test Resource ' || floor(random()*1e6), 'A summary long enough to pass validation.', $2, $3, now() - ($4 || ' days')::interval, $5)
    returning id`, [orgId, publish_status, verification_state, String(last_verified_days_ago), verify_by])).id;
}

await test('published + verified is not sufficient on its own: an expired row is published+verified but NOT saveable', async () => {
  const o = await org('active');
  const expired = await resource(o, { last_verified_days_ago: 400 });
  const row = await one('select publish_status, verification_state from public.resources where id = $1', [expired]);
  ok(row.publish_status === 'published' && row.verification_state === 'verified', 'row looks available by those two columns alone');
  const visible = await one('select public.resource_is_visible($1) as v', [expired]);
  ok(visible.v === false, 'but resource_is_visible() correctly says no (expired)');
  const r = await tryAs(db, M, 'select public.save_resource($1)', [expired]);
  ok(r.error && r.error.includes('RESOURCE_UNAVAILABLE'), 'and save_resource() correctly refuses it: ' + JSON.stringify(r.error));
});

await test('published + verified is not sufficient: a suspended organization makes it NOT saveable', async () => {
  const o = await org('suspended');
  const id = await resource(o, {});
  const row = await one('select publish_status, verification_state from public.resources where id = $1', [id]);
  ok(row.publish_status === 'published' && row.verification_state === 'verified', 'row looks available by those two columns alone');
  ok((await one('select public.resource_is_visible($1) as v', [id])).v === false, 'resource_is_visible() correctly says no (org suspended)');
  const r = await tryAs(db, M, 'select public.save_resource($1)', [id]);
  ok(r.error && r.error.includes('RESOURCE_UNAVAILABLE'), 'save_resource() correctly refuses it');
});

await test('a genuinely available resource (published + verified + active org + fresh) IS saveable', async () => {
  const o = await org('active');
  const id = await resource(o, {});
  ok((await one('select public.resource_is_visible($1) as v', [id])).v === true, 'resource_is_visible() says yes');
  const r = await tryAs(db, M, 'select public.save_resource($1)', [id]);
  ok(!r.error, 'save_resource() succeeds: ' + JSON.stringify(r.error));
});

await test('a stale (not yet expired) row is still saveable, matching resource_is_visible\'s fresh/stale allowance', async () => {
  const o = await org('active');
  const id = await resource(o, { last_verified_days_ago: 200 }); // > 180-day fresh window, inside the stale grace period
  ok((await one('select public.resource_is_visible($1) as v', [id])).v === true, 'stale is still visible/saveable');
  const r = await tryAs(db, M, 'select public.save_resource($1)', [id]);
  ok(!r.error, 'save_resource() succeeds for a stale row');
});

await test('the DEV harness pattern (filter candidates through resource_is_visible, not raw columns) finds only real matches', async () => {
  const oGood = await org('active'); const oBad = await org('suspended');
  const good = await resource(oGood, {});
  const badOrg = await resource(oBad, {});
  const badFresh = await resource(oGood, { last_verified_days_ago: 400 });
  const candidates = (await db.query('select id from public.resources where publish_status = $1 and verification_state = $2', ['published', 'verified'])).rows;
  ok(candidates.some((c) => c.id === good) && candidates.some((c) => c.id === badOrg) && candidates.some((c) => c.id === badFresh), 'all three look like candidates by the raw columns');
  const visible = [];
  for (const c of candidates) { const v = await one('select public.resource_is_visible($1) as v', [c.id]); if (v.v) visible.push(c.id); }
  ok(visible.includes(good) && !visible.includes(badOrg) && !visible.includes(badFresh), 'filtering through resource_is_visible keeps only the truly saveable one(s)');
});

done('resource availability contract');
