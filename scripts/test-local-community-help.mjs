// Local PGlite suite for community help RPCs (applies DRAFT migration after baseline).
// `node scripts/test-local-community-help.mjs`
import fs from 'node:fs';
import path from 'node:path';
import { addUser, tryAs, createLocalDb } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) {
  console.error('Baseline migrations failed:', errors);
  process.exit(1);
}

const draftSql = fs.readFileSync(
  path.join('docs/proposed-migrations/20261021180000_community_help_exchange_DRAFT.sql'),
  'utf8',
);
try {
  await db.exec(draftSql);
} catch (e) {
  console.error('Draft community help migration failed locally:', e.message);
  process.exit(1);
}

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, code, what) => ok(r.error && r.error.includes(code), `${what}: expected ${code}, got ${JSON.stringify(r.error ?? r.rows).slice(0, 120)}`);
const rpc = (who, fn, ...args) => tryAs(db, who, `select * from public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(', ')})`, args);

const MEMBER = await addUser(db, 'need-help@test.local');
const HELPER = await addUser(db, 'helper@test.local');
const OTHER = await addUser(db, 'other@test.local');

const expires = new Date(Date.now() + 86400000 * 2).toISOString();

await test('invalid category is rejected at RPC boundary', async () => {
  const B = await addUser(db, 'category-guard@test.local');
  denied(await rpc(B, 'member_create_community_help_request',
    'not_a_category', 'Valid description here.', null, 'flexible', 'Columbus', 'OH', null, true, false, expires
  ), 'INVALID_CATEGORY', 'bad category');
});

await test('member creates a community help request', async () => {
  const rows = must(await rpc(MEMBER, 'member_create_community_help_request',
    'groceries', 'My family needs groceries tonight.', null, 'today', 'Columbus', 'OH', '43215', true, false, expires
  ), 'create');
  ok(rows[0].status === 'open', 'expected open status');
});

await test('third open request is rejected', async () => {
  const exp = new Date(Date.now() + 86400000 * 3).toISOString();
  must(await rpc(MEMBER, 'member_create_community_help_request', 'clothing', 'Need winter coats for kids.', 3, 'this_week', 'Columbus', 'OH', null, true, false, exp), 'create 2');
  must(await rpc(MEMBER, 'member_create_community_help_request', 'hygiene', 'Need soap and toothpaste.', null, 'flexible', 'Columbus', 'OH', null, true, false, exp), 'create 3');
  denied(await rpc(MEMBER, 'member_create_community_help_request', 'other', 'Need blankets for family.', null, 'flexible', 'Columbus', 'OH', null, true, false, exp), 'TOO_MANY_OPEN', 'fourth open');
});

await test('helper can offer; member accepts; other member cannot read offers', async () => {
  const board = must(await rpc(HELPER, 'list_open_community_help_board', 'OH', null), 'board');
  ok(board.length >= 1, 'board should list open requests');
  const requestId = board[0].id;
  must(await rpc(HELPER, 'member_offer_community_help', requestId, 'I can drop off groceries.', null), 'offer');
  const offers = must(await tryAs(db, MEMBER, `select id, status from public.community_help_offers where request_id=$1`, [requestId]), 'member sees offers');
  ok(offers.length === 1, 'owner should see one offer');
  const peek = await tryAs(db, OTHER, `select id from public.community_help_offers where request_id=$1`, [requestId]);
  ok(!peek.error && (peek.rows?.length ?? 0) === 0, 'non-participant must not see offers via RLS');
  must(await rpc(MEMBER, 'member_respond_community_help_offer', offers[0].id, true), 'accept');
  const req = must(await rpc(MEMBER, 'member_get_community_help_request', requestId), 'get');
  ok(req[0].status === 'matched', 'request should be matched');
});

await test('touch_community_help_expiry is not callable by authenticated members', async () => {
  denied(await rpc(MEMBER, 'touch_community_help_expiry'), 'permission denied', 'touch expiry');
});

await test('direct insert into community_help_requests is denied for authenticated', async () => {
  denied(await tryAs(db, HELPER,
    `insert into public.community_help_requests (member_id, category, description, city, state, expires_at) values ($1,'other','Should not work','A','OH',now()+interval '1 day')`,
    [HELPER]
  ), 'permission denied', 'direct insert');
});

done();
