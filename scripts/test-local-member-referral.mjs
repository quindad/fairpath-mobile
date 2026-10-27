// Local PGlite: member resource referral draft migration.
// `node scripts/test-local-member-referral.mjs`
import fs from 'node:fs';
import path from 'node:path';
import { addUser, tryAs, createLocalDb } from './lib/local-db.mjs';
import { loadResourceFixtures, makeRunner } from './lib/local-fixtures.mjs';
import { rid } from '../supabase/seed/data/resources-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Baseline failed:', errors); process.exit(1); }
await loadResourceFixtures(db);
const draft = fs.readFileSync(path.join('docs/proposed-migrations/20261021185000_member_resource_referral_DRAFT.sql'), 'utf8');
await db.exec(draft);

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, code, what) => ok(r.error && r.error.includes(code), `${what}: expected ${code}`);
const rpc = (who, fn, ...args) => tryAs(db, who, `select * from public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(', ')})`, args);

const MEMBER = await addUser(db, 'refer-member@test.local');
const MANAGER = await addUser(db, 'org-manager@test.local');
const PANTRY = rid('pantry-cle-44113');

await db.query(`update public.resources set source_authority = 'partner_submitted' where id = $1`, [PANTRY]);

await test('member submits referral for verified resource', async () => {
  const rows = must(await rpc(MEMBER, 'member_submit_resource_referral_request', PANTRY, 'Need food assistance this week.'), 'submit');
  ok(rows[0].status === 'submitted', 'expected submitted');
});

await test('duplicate active referral is rejected', async () => {
  denied(await rpc(MEMBER, 'member_submit_resource_referral_request', PANTRY, 'Again'), 'DUPLICATE_REFERRAL', 'dup');
});

await test('member lists own referral requests', async () => {
  const rows = must(await rpc(MEMBER, 'list_my_resource_referral_requests'), 'list');
  ok(rows.length >= 1, 'expected at least one row');
});

await test('non-participating resource is rejected', async () => {
  const OTHER = rid('kitchen-cle-meals');
  await db.query(`update public.resources set source_authority = 'community' where id = $1`, [OTHER]);
  denied(await rpc(MEMBER, 'member_submit_resource_referral_request', OTHER, 'nope'), 'RESOURCE_UNAVAILABLE', 'non-participating');
});

const orgRows = must(await db.query(`select organization_id from public.resources where id = $1`, [PANTRY]), 'org lookup');
const ORG_ID = orgRows[0].organization_id;
await db.query(
  `insert into public.organization_members (organization_id, user_id, member_role, status)
   values ($1, $2, 'manager', 'active') on conflict do nothing`,
  [ORG_ID, MANAGER],
);

const STRANGER = await addUser(db, 'other-manager@test.local');

await test('org manager lists resource referral inbox', async () => {
  const rows = must(await rpc(MANAGER, 'partner_list_resource_referral_inbox', ORG_ID), 'inbox');
  ok(rows.length >= 1, 'expected inbox rows');
});

await test('non-manager cannot list inbox', async () => {
  denied(await rpc(STRANGER, 'partner_list_resource_referral_inbox', ORG_ID), 'FORBIDDEN', 'inbox forbidden');
});

await test('org manager accepts referral request', async () => {
  const listed = must(await rpc(MANAGER, 'partner_list_resource_referral_inbox', ORG_ID), 'list');
  const submitted = listed.find((r) => r.status === 'submitted');
  ok(submitted, 'need submitted row');
  const updated = must(await rpc(MANAGER, 'partner_respond_resource_referral_request', submitted.id, true), 'accept');
  ok(updated[0].status === 'accepted', 'expected accepted');
});

await test('org manager completes accepted referral', async () => {
  const listed = must(await rpc(MANAGER, 'partner_list_resource_referral_inbox', ORG_ID), 'list');
  const accepted = listed.find((r) => r.status === 'accepted');
  ok(accepted, 'need accepted row');
  const done = must(await rpc(MANAGER, 'partner_complete_resource_referral_request', accepted.id, null), 'complete');
  ok(done[0].status === 'completed', 'expected completed');
});

done('member resource referral (draft)');
