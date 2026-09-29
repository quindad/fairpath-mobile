// Local (PGlite) SQL suite for coverage markets / Early Access waitlist. `npm run test:sql:coverage`
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }
const M = await addUser(db, 'm@test.local');
const N = await addUser(db, 'n@test.local');
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, text, what) => ok(r.error && r.error.includes(text), `${what}: expected "${text}", got ${JSON.stringify(r.error ?? r.rows).slice(0, 220)}`);

await test('an unconfigured ZIP honestly reports coming_soon, never a fabricated full/growing status', async () => {
  const r = must(await tryAs(db, 'anon', 'select public.get_market_coverage($1) as c', ['00001']), 'guest coverage read')[0];
  ok(r.c.status === 'coming_soon' && r.c.market_code === null, 'unconfigured ZIP defaults honestly');
});

await test('an invalid ZIP is rejected, not silently accepted', async () => {
  denied(await tryAs(db, 'anon', 'select public.get_market_coverage($1)', ['abc']), 'INVALID_ZIP', 'garbage zip rejected');
  denied(await tryAs(db, 'anon', 'select public.get_market_coverage($1)', ['123']), 'INVALID_ZIP', 'short zip rejected');
});

await test('a configured market with longest-prefix-wins resolves correctly', async () => {
  await must(await tryAs(db, 'service', `select public.upsert_coverage_market('columbus-oh','Columbus, OH area', array['43'], 'waitlist', 60, null)`), 'seed wide market');
  await must(await tryAs(db, 'service', `select public.upsert_coverage_market('columbus-downtown','Downtown Columbus', array['43215'], 'limited', 30, 'Just launched downtown')`), 'seed narrow market');
  const wide = must(await tryAs(db, 'anon', 'select public.get_market_coverage($1) as c', ['43081']), 'wide read')[0].c;
  ok(wide.market_code === 'columbus-oh' && wide.status === 'waitlist', 'falls back to the wider market when no narrower one matches');
  const narrow = must(await tryAs(db, 'anon', 'select public.get_market_coverage($1) as c', ['43215']), 'narrow read')[0].c;
  ok(narrow.market_code === 'columbus-downtown' && narrow.status === 'limited', 'longest matching prefix wins over the wider market');
});

await test('a signed-in member can join Early Access; joining twice for the same ZIP is idempotent', async () => {
  const j1 = must(await tryAs(db, M, `select public.join_early_access($1, true, 'referral_link') as r`, ['43081']), 'first join')[0].r;
  ok(j1.already_enrolled === false && j1.status === 'waitlisted', 'first enrollment created');
  const j2 = must(await tryAs(db, M, `select public.join_early_access($1, true, null) as r`, ['43081']), 'second join')[0].r;
  ok(j2.already_enrolled === true && j2.id === j1.id, 'second join for same zip returns the existing enrollment, not a duplicate');
  const count = (await one('select count(*)::int as n from public.market_waitlist_enrollments where user_id = $1', [M])).n;
  ok(count === 1, 'exactly one row exists despite two join calls');
});

await test('a signed-out user cannot join Early Access', async () => {
  const r = await tryAs(db, 'anon', `select public.join_early_access($1, true, null)`, ['43081']);
  ok(r.error, 'guest join is rejected');
});

await test('members only see their own enrollments, never each other\'s', async () => {
  await must(await tryAs(db, N, `select public.join_early_access($1, true, null)`, ['90210']), 'N joins');
  const mineM = must(await tryAs(db, M, 'select * from public.my_early_access_enrollments()'), 'M reads own')[0];
  ok(mineM === undefined || true, 'sanity');
  const allM = must(await tryAs(db, M, 'select * from public.my_early_access_enrollments()'), 'M reads own list');
  ok(allM.every((e) => e.user_id === M), "M's list contains only M's rows");
  const directRead = must(await tryAs(db, M, 'select * from public.market_waitlist_enrollments where user_id = $1', [N]), 'M tries direct read of N');
  ok(directRead.length === 0, "RLS blocks M from reading N's enrollment directly");
});

await test('activating a market is idempotent: one grant per member even if run twice, notifications sent once', async () => {
  const before = (await one(`select count(*)::int as n from public.entitlement_grants where source_type = 'early_access_market'`)).n;
  const first = must(await tryAs(db, 'service', `select public.activate_coverage_market('columbus-oh', 'full', 'test-admin') as r`), 'first activation')[0].r;
  ok(first.grants_issued === 1 && first.members_notified === 1, 'exactly one member (M, still waitlisted on the wide market) got a grant and a notification');
  const second = must(await tryAs(db, 'service', `select public.activate_coverage_market('columbus-oh', 'full', 'test-admin') as r`), 'second activation')[0].r;
  ok(second.grants_issued === 0, 're-running activation issues zero additional grants: the enrollment already converted');
  const after = (await one(`select count(*)::int as n from public.entitlement_grants where source_type = 'early_access_market'`)).n;
  ok(after === before + 1, 'exactly one early_access_market grant exists in total');

  const status = must(await tryAs(db, M, `select (public.my_fairpath_plus_status()->>'active')::boolean as active, my_fairpath_plus_status()->>'source' as src`), "M's FairPath+ status")[0];
  ok(status.active === true && status.src === 'early_access_market', "M's grant is live and correctly sourced");

  const enrollment = (await one('select status, entitlement_grant_id from public.market_waitlist_enrollments where user_id = $1 and zip = $2', [M, '43081']));
  ok(enrollment.status === 'converted' && enrollment.entitlement_grant_id !== null, 'enrollment marked converted with the grant id attached');
});

await test('a market with no benefit configured activates without issuing any grant', async () => {
  await must(await tryAs(db, 'service', `select public.upsert_coverage_market('no-benefit-market','No Benefit Market', array['77'], 'waitlist', null, null)`), 'seed no-benefit market');
  await must(await tryAs(db, N, `select public.join_early_access($1, true, null)`, ['77001']), 'N joins no-benefit market');
  const r = must(await tryAs(db, 'service', `select public.activate_coverage_market('no-benefit-market', 'growing', 'test-admin') as r`), 'activate no-benefit')[0].r;
  ok(r.grants_issued === 0, 'no grant issued when the market has no benefit configured');
  const status = must(await tryAs(db, N, `select (public.my_fairpath_plus_status()->>'active')::boolean as active`), "N's status")[0];
  ok(status.active === false, 'N has no FairPath+ from a benefit-less market activation');
});

await test('activating an unknown market code fails loudly, not silently', async () => {
  denied(await tryAs(db, 'service', `select public.activate_coverage_market('does-not-exist', 'full', 'test-admin')`), 'MARKET_NOT_FOUND', 'unknown market rejected');
});

await test('a member who enrolled BEFORE any market existed for their ZIP still gets the grant once one is configured and activated', async () => {
  // real-world sequence: member joins a ZIP with zero configured markets (market_id resolves to null), and only
  // LATER does FairPath configure + activate a market for that ZIP. Found as a real bug via a live DEV lifecycle
  // test: the original activate_coverage_market only matched enrollments already stamped with market_id = this
  // market, so a late-bound market never picked up an enrollment created before it existed.
  const late = await addUser(db, 'late@test.local');
  const before = must(await tryAs(db, 'anon', 'select public.get_market_coverage($1) as c', ['54321']), 'coverage before market exists')[0].c;
  ok(before.market_code === null && before.status === 'coming_soon', 'no market exists yet for this zip');
  const join = must(await tryAs(db, late, `select public.join_early_access($1, true, null) as r`, ['54321']), 'late joins before any market exists')[0].r;
  ok(join.status === 'waitlisted', 'enrollment created with no market to link');
  const stored = await one('select market_id from public.market_waitlist_enrollments where user_id = $1 and zip = $2', [late, '54321']);
  ok(stored.market_id === null, "the enrollment's market_id is null, exactly as it would be in production before this market is configured");

  await must(await tryAs(db, 'service', `select public.upsert_coverage_market('late-bound-market','Late-Bound Market', array['543'], 'waitlist', 45, null)`), 'configure the market AFTER the member already joined');
  const activation = must(await tryAs(db, 'service', `select public.activate_coverage_market('late-bound-market', 'full', 'test-admin') as r`), 'activate the late-bound market')[0].r;
  ok(activation.grants_issued === 1, 'the pre-existing, previously-unmatched enrollment gets picked up and granted');

  const status = must(await tryAs(db, late, `select (public.my_fairpath_plus_status()->>'active')::boolean as active, my_fairpath_plus_status()->>'source' as src`), "late's FairPath+ status")[0];
  ok(status.active === true && status.src === 'early_access_market', 'the member now genuinely has the benefit, not just a converted-looking row');

  const rerun = must(await tryAs(db, 'service', `select public.activate_coverage_market('late-bound-market', 'full', 'test-admin') as r`), 're-run activation')[0].r;
  ok(rerun.grants_issued === 0, 're-running the now-fixed activation still issues zero duplicate grants');
});

await test('deleting a member cascades their waitlist enrollments', async () => {
  const del = await addUser(db, 'del@test.local');
  await must(await tryAs(db, del, `select public.join_early_access($1, true, null)`, ['55555']), 'del joins');
  await db.query('delete from auth.users where id = $1', [del]);
  ok((await one('select count(*)::int as n from public.market_waitlist_enrollments where user_id = $1', [del])).n === 0, 'cascaded');
});

done('Coverage markets / Early Access');
