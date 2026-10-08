// Local (PGlite) SQL suite for Phase 3: Marketplace claim lifecycle, against the real RPCs and RLS.
// No prior suite exercised request_marketplace_claim/approve/verify_marketplace_pickup against real Postgres -
// only static file-content checks existed (scripts/audit-marketplace.mjs). This proves the actual logic.
// `node scripts/test-local-marketplace.mjs`
import { addUser, tryAs, createLocalDb } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, code, what) => ok(r.error && r.error.includes(code), `${what}: expected "${code}", got ${JSON.stringify(r.error ?? r.rows).slice(0, 160)}`);
const rpc = (who, fn, ...args) => tryAs(db, who, `select * from public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(', ')})`, args);

const SELLER = await addUser(db, 'seller@test.local');
const PLUS = await addUser(db, 'plus-member@test.local');
let claimantN = 0;
const freshClaimant = () => addUser(db, `claimant-${++claimantN}@test.local`); // each free member is capped at 1 claim/month - tests need independent claimants

await db.query(`insert into public.fairpath_subscriptions (user_id, plan, status, current_period_end)
  values ($1, 'fairpath_plus', 'active', now() + interval '30 days')`, [PLUS]);

async function makeItem(title) {
  // guard_marketplace_owner_controlled_fields forces every authenticated insert to status='draft' - real
  // listings must then be explicitly published via the SECURITY DEFINER set_marketplace_item_availability RPC,
  // exactly like the app's create flow (audited in scripts/audit-marketplace.mjs).
  const rows = must(await tryAs(db, SELLER,
    `insert into public.marketplace_items (seller_id, title, description, category, city, state) values ($1,$2,'desc','furniture','Cleveland','OH') returning id`,
    [SELLER, title]), 'make item');
  const id = rows[0].id;
  must(await rpc(SELLER, 'set_marketplace_item_availability', id, true), 'publish item');
  return id;
}

await test('a member cannot claim their own item', async () => {
  const item = await makeItem('Own item test');
  denied(await rpc(SELLER, 'request_marketplace_claim', item, null), 'OWN_ITEM', 'own-item claim');
});

await test('requesting the same item twice is idempotent, not a duplicate row', async () => {
  const A = await freshClaimant();
  const item = await makeItem('Duplicate claim test');
  const first = must(await rpc(A, 'request_marketplace_claim', item, null), 'first claim');
  const second = must(await rpc(A, 'request_marketplace_claim', item, null), 'second claim');
  ok(first[0].id === second[0].id, 'duplicate claim created a second row instead of returning the existing one');
  const count = must(await tryAs(db, 'service', `select count(*)::int as n from public.marketplace_claims where item_id=$1`, [item]), 'count');
  ok(count[0].n === 1, `expected exactly 1 claim row, got ${count[0].n}`);
});

await test('free member is capped at 1 active claim/month; FairPath+ member gets 7', async () => {
  const B = await freshClaimant();
  const items = [];
  for (let i = 0; i < 2; i++) items.push(await makeItem('Free cap test ' + i));
  must(await rpc(B, 'request_marketplace_claim', items[0], null), 'first free claim');
  denied(await rpc(B, 'request_marketplace_claim', items[1], null), 'CLAIM_LIMIT_REACHED', 'second free claim');

  const plusItems = [];
  for (let i = 0; i < 7; i++) plusItems.push(await makeItem('Plus cap test ' + i));
  for (const it of plusItems) must(await rpc(PLUS, 'request_marketplace_claim', it, null), 'plus claim');
  const eighth = await makeItem('Plus cap test 8');
  denied(await rpc(PLUS, 'request_marketplace_claim', eighth, null), 'CLAIM_LIMIT_REACHED', '8th plus claim');
});

await test('a second claimant cannot claim an item already pending pickup', async () => {
  const A = await freshClaimant(), B = await freshClaimant();
  const item = await makeItem('Already claimed test');
  const claimRows = must(await rpc(A, 'request_marketplace_claim', item, null), 'A claims');
  must(await rpc(SELLER, 'approve_marketplace_claim', claimRows[0].id), 'seller approves');
  denied(await rpc(B, 'request_marketplace_claim', item, null), 'ITEM_UNAVAILABLE', 'B claims already-pending item');
});

await test('only the seller can verify pickup, and only with the correct code', async () => {
  const A = await freshClaimant(), B = await freshClaimant();
  const item = await makeItem('Pickup verification test');
  const claimRows = must(await rpc(A, 'request_marketplace_claim', item, null), 'A claims');
  const claimId = claimRows[0].id;
  const approved = must(await rpc(SELLER, 'approve_marketplace_claim', claimId), 'seller approves');
  const realCode = approved[0].pickup_code;

  denied(await rpc(B, 'verify_marketplace_pickup', claimId, realCode), 'CLAIM_NOT_VERIFIABLE', 'non-seller verify attempt (forged claim id use)');
  denied(await rpc(SELLER, 'verify_marketplace_pickup', claimId, 'WRONGCODE'), 'INVALID_PICKUP_CODE', 'wrong pickup code');
  must(await rpc(SELLER, 'verify_marketplace_pickup', claimId, realCode), 'correct pickup code');

  const state = must(await tryAs(db, 'service', `select status from public.marketplace_claims where id=$1`, [claimId]), 'final state');
  ok(state[0].status === 'picked_up', 'claim did not reach picked_up status');
});

await test('claimant identity stays isolated: B cannot read or act on A\'s claim by forged id', async () => {
  const A = await freshClaimant(), B = await freshClaimant();
  const item = await makeItem('Isolation test');
  const claimRows = must(await rpc(A, 'request_marketplace_claim', item, null), 'A claims');
  const claimId = claimRows[0].id;
  const bRead = must(await tryAs(db, B, `select id from public.marketplace_claims where id=$1`, [claimId]), 'B direct read');
  ok(bRead.length === 0, 'B could directly read a claim row that is not theirs and not their item');
  denied(await rpc(B, 'cancel_marketplace_claim', claimId), 'CLAIM_NOT_CANCELLABLE', 'B cancels A\'s claim');
});

await test('seller can decline a requested claim; declined claims do not count toward quota', async () => {
  const A = await freshClaimant();
  const item = await makeItem('Decline test');
  const claimRows = must(await rpc(A, 'request_marketplace_claim', item, null), 'A claims');
  must(await rpc(SELLER, 'decline_marketplace_claim', claimRows[0].id), 'seller declines');
  const row = (await db.query(`select status, counts_toward_quota from public.marketplace_claims where id=$1`, [claimRows[0].id])).rows[0];
  ok(row.status === 'declined' && row.counts_toward_quota === false, `expected declined + not counted, got ${JSON.stringify(row)}`);
});

await test('a non-seller cannot decline, mark-ready, or mark-no-show someone else\'s claim', async () => {
  const A = await freshClaimant(), OUTSIDER = await freshClaimant();
  const item = await makeItem('Non-seller action test');
  const claimRows = must(await rpc(A, 'request_marketplace_claim', item, null), 'A claims');
  const claimId = claimRows[0].id;
  denied(await rpc(OUTSIDER, 'decline_marketplace_claim', claimId), 'CLAIM_NOT_DECLINABLE', 'outsider decline');
  must(await rpc(SELLER, 'approve_marketplace_claim', claimId), 'seller approves');
  denied(await rpc(OUTSIDER, 'mark_marketplace_claim_ready', claimId), 'CLAIM_NOT_READY', 'outsider mark-ready');
  must(await rpc(SELLER, 'mark_marketplace_claim_ready', claimId), 'seller marks ready');
  const row = (await db.query(`select status from public.marketplace_claims where id=$1`, [claimId])).rows[0];
  ok(row.status === 'ready', 'seller mark-ready did not take effect');
});

await test('a claim past its pickup deadline auto-expires to no_show and the item becomes available again', async () => {
  const A = await freshClaimant(), B = await freshClaimant();
  const item = await makeItem('Expiry test');
  const claimRows = must(await rpc(A, 'request_marketplace_claim', item, null), 'A claims');
  must(await rpc(SELLER, 'approve_marketplace_claim', claimRows[0].id), 'seller approves');
  // Force the deadline into the past (service-role direct write, simulating time passing - not a client-reachable path).
  await db.query(`update public.marketplace_claims set pickup_deadline = now() - interval '1 hour' where id=$1`, [claimRows[0].id]);
  const expired = must(await tryAs(db, 'service', `select public.expire_marketplace_pickups()`), 'expire sweep');
  ok(expired[0].expire_marketplace_pickups >= 1, 'expected at least 1 claim to expire');
  const claim = (await db.query(`select status from public.marketplace_claims where id=$1`, [claimRows[0].id])).rows[0];
  ok(claim.status === 'no_show', `expected no_show after deadline passed, got ${claim.status}`);
  const itemRow = (await db.query(`select status from public.marketplace_items where id=$1`, [item])).rows[0];
  ok(itemRow.status === 'available', 'item should become available again after an expired pickup');

  // The item is available again - a different claimant should now be able to claim it.
  must(await rpc(B, 'request_marketplace_claim', item, null), 'B claims after expiry');
});

await test('members can refresh only their own expired pickups; the global sweep stays service-only', async () => {
  const A = await freshClaimant(), OUTSIDER = await freshClaimant();
  const item = await makeItem('Member-scoped expiry test');
  const claimRows = must(await rpc(A, 'request_marketplace_claim', item, null), 'A claims');
  must(await rpc(SELLER, 'approve_marketplace_claim', claimRows[0].id), 'seller approves');
  await db.query(`update public.marketplace_claims set pickup_deadline = now() - interval '1 hour' where id=$1`, [claimRows[0].id]);

  denied(await rpc(OUTSIDER, 'expire_marketplace_pickups'), 'permission denied', 'member global expiry sweep');
  const outsiderRefresh = must(await rpc(OUTSIDER, 'expire_my_marketplace_pickups'), 'outsider scoped refresh');
  ok(outsiderRefresh[0].expire_my_marketplace_pickups === 0, 'outsider expired another member\'s pickup');
  const ownerRefresh = must(await rpc(A, 'expire_my_marketplace_pickups'), 'claimant scoped refresh');
  ok(ownerRefresh[0].expire_my_marketplace_pickups === 1, 'claimant could not refresh their own expired pickup');
});

await test('a non-seller cannot view claim candidates for someone else\'s item, and identities stay anonymous to the seller', async () => {
  const A = await freshClaimant(), OUTSIDER = await freshClaimant();
  const item = await makeItem('Candidates anonymity test');
  await rpc(A, 'request_marketplace_claim', item, null);
  denied(await rpc(OUTSIDER, 'marketplace_claim_candidates', item), 'NOT_SELLER', 'outsider viewing candidates');
  const candidates = must(await rpc(SELLER, 'marketplace_claim_candidates', item), 'seller views candidates');
  ok(candidates.length === 1, 'expected 1 candidate');
  ok(candidates[0].claimant_label.startsWith('CLAIM #') && !JSON.stringify(candidates[0]).includes(A), 'claimant identity leaked to the seller - must stay anonymous (CLAIM #XXXX only)');
});

await test('cancelling a requested (not yet approved) claim frees it up without penalty', async () => {
  const A = await freshClaimant(), B = await freshClaimant();
  const item = await makeItem('Cancel-before-approval test');
  const claimRows = must(await rpc(A, 'request_marketplace_claim', item, null), 'A claims');
  must(await rpc(A, 'cancel_marketplace_claim', claimRows[0].id), 'A cancels own claim');
  const row = (await db.query(`select status, counts_toward_quota from public.marketplace_claims where id=$1`, [claimRows[0].id])).rows[0];
  ok(row.status === 'cancelled' && row.counts_toward_quota === false, `a pre-approval cancel should not count toward quota, got ${JSON.stringify(row)}`);
  must(await rpc(B, 'request_marketplace_claim', item, null), 'B claims after A cancelled');
});

done();
