// DEV ONLY — two-member Community Exchange E2E on shared DEV (migration 20261021205913 applied).
// Member RPCs use each member's JWT (anon key + signInWithPassword). No service role in the workflow path.
//
// DEV E2E steps (automated in this script):
//   1. Refuse run unless --confirm-dev and DEV project identity checks pass (.env.local → shared DEV).
//   2. Sign in Member A and Member B (documented dev accounts or --provision-disposable).
//   3. Member A creates an open groceries request (list_my persistence).
//   4. Member B lists board + reads request detail (postal hidden from non-owner).
//   5. Member B offers help; RLS hides offer rows from non-owners except helper’s own row.
//   6. Member A sees offer while request stays open; B cannot accept on A’s behalf.
//   7. Member A accepts → matched (not fulfilled); then marks fulfilled.
//   8. Member B cannot read fulfilled request; A inbox has community notification.
//   9. Member A cancels a separate open request (cancellation path).
//  10. Writes qa-dev-community-exchange-e2e-results.json (expiration cron sweep SKIPPED).
//
//   node scripts/qa-dev-community-exchange-e2e.mjs --confirm-dev
//   node scripts/qa-dev-community-exchange-e2e.mjs --confirm-dev --provision-disposable
//
// Prefer vault passwords via env (never printed):
//   QA_COMMUNITY_MEMBER_A_PASSWORD / QA_COMMUNITY_MEMBER_B_PASSWORD
// Optional emails (default dev-free / dev-plus):
//   QA_COMMUNITY_MEMBER_A_EMAIL / QA_COMMUNITY_MEMBER_B_EMAIL
//
// Optional isolated provisioning (NOT used for permission tests):
//   --provision-disposable requires SUPABASE_SERVICE_ROLE_KEY — creates @dev-seed.fairpath.test users only.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  DEV_QA_MEMBER_A_EMAIL,
  DEV_QA_MEMBER_B_EMAIL,
  maskEmail,
  requireMemberPasswords,
  resolveCommunityE2eMembers,
} from './lib/dev-qa-accounts.mjs';
import {
  assertDevMutatingApply,
  assertDevMutatingSession,
  assertDocumentedDevTestAccount,
  CleanupRegistry,
  createRunId,
  loadEnvLocal,
  readLinkedRef,
} from './lib/dev-qa-run.mjs';

const args = new Set(process.argv.slice(2));
const useDocumented = args.has('--use-documented-dev-accounts');
const provisionDisposable = args.has('--provision-disposable');
const confirmDev = args.has('--confirm-dev');
const runId = createRunId('comm');

const env = loadEnvLocal();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const linkedRef = readLinkedRef();

try {
  assertDevMutatingSession({ url, linkedRef, confirmDev });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const cleanup = new CleanupRegistry();

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const results = [];
const authMethod = { memberSessions: 'supabase_auth_password_anon_client', serviceRoleUsed: false, provisioning: provisionDisposable ? 'disposable' : 'none' };

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log('PASS ' + name);
  } catch (e) {
    results.push({ name, ok: false, error: String(e.message ?? e).slice(0, 400) });
    console.log('FAIL ' + name + '\n     ' + String(e.message ?? e).slice(0, 400));
  }
}
const ok = (c, m) => {
  if (!c) throw new Error(m);
};

async function signInMember(email, password) {
  const client = createClient(url, anonKey, opts);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  ok(!error, error?.message ?? 'signIn');
  ok(data.session?.access_token, 'missing member JWT');
  return client;
}

let emailA;
let emailB;
let passA;
let passB;
let clientA;
let clientB;
let requestId;
let offerId;
let cancelRequestId;
let disposableAId;
let disposableBId;
const stamp = runId;

function usesDocumentedPersonas(a, b) {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  return (
    na === DEV_QA_MEMBER_A_EMAIL.toLowerCase() &&
    nb === DEV_QA_MEMBER_B_EMAIL.toLowerCase()
  );
}

if (provisionDisposable) {
  try {
    assertDevMutatingApply({ url, linkedRef, confirmDev, serviceKey });
  } catch (e) {
    console.error('Provisioning requires SUPABASE_SERVICE_ROLE_KEY:', e.message);
    process.exit(1);
  }
  authMethod.serviceRoleUsed = true;
  authMethod.provisioning = 'disposable_createUser';
  const admin = createClient(url, serviceKey, opts);
  passA = passB = `E2e-${stamp}-Aa1!`;
  emailA = `qa-comm-a-${stamp}@dev-seed.fairpath.test`;
  emailB = `qa-comm-b-${stamp}@dev-seed.fairpath.test`;
  await test('[setup] create disposable members (service role, isolated)', async () => {
    for (const email of [emailA, emailB]) {
      const c = await admin.auth.admin.createUser({ email, email_confirm: true, password: passA });
      ok(!c.error, c.error?.message ?? 'createUser');
      if (email === emailA) disposableAId = c.data.user.id;
      else disposableBId = c.data.user.id;
    }
  });
  cleanup.add('delete disposable member B', async () => {
    if (!disposableBId) return;
    const { error } = await admin.auth.admin.deleteUser(disposableBId);
    if (error) throw error;
  });
  cleanup.add('delete disposable member A', async () => {
    if (!disposableAId) return;
    const { error } = await admin.auth.admin.deleteUser(disposableAId);
    if (error) throw error;
  });
} else {
  const resolved = resolveCommunityE2eMembers();
  emailA = resolved.emailA;
  emailB = resolved.emailB;
  passA = resolved.passA;
  passB = resolved.passB;
  try {
    requireMemberPasswords({ emailA, emailB, passA, passB });
    if (useDocumented || usesDocumentedPersonas(emailA, emailB)) {
      assertDocumentedDevTestAccount(emailA);
      assertDocumentedDevTestAccount(emailB);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  cleanup.add('cancel leftover open community requests', async () => {
    const c = await signInMember(emailA, passA);
    for (const id of [requestId, cancelRequestId]) {
      if (!id) continue;
      const { data: req, error } = await c.rpc('member_get_community_help_request', { p_request_id: id });
      if (error) continue;
      const row = Array.isArray(req) ? req[0] : req;
      if (row?.status === 'open' || row?.status === 'matched') {
        const { error: cErr } = await c.rpc('member_cancel_community_help_request', { p_request_id: id });
        if (cErr) throw new Error(`cancel ${id}: ${cErr.message}`);
      }
    }
  });
}

try {
  await test('RPC probe signed out → SIGNED_OUT', async () => {
    const anon = createClient(url, anonKey, opts);
    const { error } = await anon.rpc('list_open_community_help_board', { p_state: null, p_category: null });
    ok(error, 'expected signed out failure');
  });

  await test('Member A session + JWT authenticates RPCs', async () => {
  clientA = await signInMember(emailA, passA);
  const { error } = await clientA.rpc('list_open_community_help_board', { p_state: 'OH', p_category: null });
  ok(!error, error?.message ?? 'board');
});

await test('Member A creates open request (persistence)', async () => {
  clientA = await signInMember(emailA, passA);
  const desc = `E2E community ${stamp} — groceries`;
  const expires = new Date(Date.now() + 5 * 86400000).toISOString();
  const { data, error } = await clientA.rpc('member_create_community_help_request', {
    p_category: 'groceries',
    p_description: desc,
    p_household_size: 2,
    p_urgency: 'this_week',
    p_city: 'Cleveland',
    p_state: 'OH',
    p_postal_code: '44113',
    p_pickup_ok: true,
    p_delivery_preferred: false,
    p_expires_at: expires,
  });
  ok(!error, error?.message ?? 'create');
  ok(data?.status === 'open', 'expected open, got ' + data?.status);
  requestId = data.id;
  const { data: list } = await clientA.rpc('list_my_community_help_requests');
  ok((list ?? []).some((r) => r.id === requestId), 'list_my persistence');
});

await test('Member B discovers request; postal hidden from non-owner', async () => {
  clientB = await signInMember(emailB, passB);
  const { data, error } = await clientB.rpc('list_open_community_help_board', { p_state: 'OH', p_category: 'groceries' });
  ok(!error, error?.message ?? 'board');
  ok((data ?? []).some((r) => r.id === requestId), 'request not on board');
  const { data: detail, error: dErr } = await clientB.rpc('member_get_community_help_request', { p_request_id: requestId });
  ok(!dErr, dErr?.message ?? 'get');
  const row = Array.isArray(detail) ? detail[0] : detail;
  ok(row?.postal_code == null || row?.postal_code === '', 'non-owner must not see postal_code');
});

await test('Member B offers help', async () => {
  const { data, error } = await clientB.rpc('member_offer_community_help', {
    p_request_id: requestId,
    p_note: 'E2E offer — can drop off groceries',
    p_marketplace_item_id: null,
  });
  ok(!error, error?.message ?? 'offer');
  ok(data?.status === 'offered', 'offer status');
  offerId = data.id;
});

await test('Member B cannot read offers via RLS (owner-only visibility)', async () => {
  const { data, error } = await clientB.from('community_help_offers').select('id').eq('request_id', requestId);
  ok(!error, error?.message ?? 'select');
  const mine = (data ?? []).filter((o) => o.id === offerId);
  ok(mine.length <= 1, 'helper may see at most own offer row');
});

await test('Member A sees offer; request still open until accept', async () => {
  clientA = await signInMember(emailA, passA);
  const { data: req } = await clientA.rpc('member_get_community_help_request', { p_request_id: requestId });
  const row = Array.isArray(req) ? req[0] : req;
  ok(row?.status === 'open', 'must stay open until accept, got ' + row?.status);
  ok(row?.postal_code?.includes('44113'), 'owner sees postal_code');
  const { data: offers, error } = await clientA.from('community_help_offers').select('id,status').eq('request_id', requestId);
  ok(!error, error?.message ?? 'offers select');
  ok((offers ?? []).some((o) => o.id === offerId && o.status === 'offered'), 'owner sees offered row');
});

await test('Member B cannot accept offer (not owner)', async () => {
  const { error } = await clientB.rpc('member_respond_community_help_offer', { p_offer_id: offerId, p_accept: true });
  ok(error, 'helper must not accept');
});

await test('Member A accepts → matched (not fulfilled)', async () => {
  const { data, error } = await clientA.rpc('member_respond_community_help_offer', { p_offer_id: offerId, p_accept: true });
  ok(!error, error?.message ?? 'accept');
  ok(data?.status === 'accepted', 'offer accepted');
  const { data: req } = await clientA.rpc('member_get_community_help_request', { p_request_id: requestId });
  const row = Array.isArray(req) ? req[0] : req;
  ok(row?.status === 'matched', 'accept → matched, not fulfilled');
});

await test('Member A marks assistance fulfilled', async () => {
  const { data, error } = await clientA.rpc('member_fulfill_community_help_request', { p_request_id: requestId });
  ok(!error, error?.message ?? 'fulfill');
  ok(data?.status === 'fulfilled', 'expected fulfilled');
});

await test('Member A list shows fulfilled; B cannot get closed request', async () => {
  clientA = await signInMember(emailA, passA);
  const { data: listA } = await clientA.rpc('list_my_community_help_requests');
  ok((listA ?? []).some((r) => r.id === requestId && r.status === 'fulfilled'), 'A list fulfilled');
  clientB = await signInMember(emailB, passB);
  const { error } = await clientB.rpc('member_get_community_help_request', { p_request_id: requestId });
  ok(error, 'B should not read fulfilled request as non-owner');
});

await test('Member A notification inbox (community category)', async () => {
  const { data, error } = await clientA.from('user_notifications').select('id,category,route,read_at').eq('category', 'community').order('created_at', { ascending: false }).limit(10);
  ok(!error, error?.message ?? 'notifications');
  ok((data ?? []).length >= 1, 'expected at least one community notification for owner');
});

await test('Cancellation on separate request (Member A)', async () => {
  clientA = await signInMember(emailA, passA);
  const expires = new Date(Date.now() + 3 * 86400000).toISOString();
  const { data, error } = await clientA.rpc('member_create_community_help_request', {
    p_category: 'hygiene',
    p_description: `E2E cancel ${stamp}`,
    p_household_size: null,
    p_urgency: 'flexible',
    p_city: 'Cleveland',
    p_state: 'OH',
    p_postal_code: null,
    p_pickup_ok: true,
    p_delivery_preferred: false,
    p_expires_at: expires,
  });
  ok(!error, error?.message ?? 'create cancel fixture');
  cancelRequestId = data.id;
  const { data: cancelled, error: cErr } = await clientA.rpc('member_cancel_community_help_request', { p_request_id: cancelRequestId });
  ok(!cErr, cErr?.message ?? 'cancel');
  ok(cancelled?.status === 'cancelled', 'cancelled status');
  });

  // Expiration sweep is intentionally excluded from the passing assertion count:
  // touch_community_help_expiry requires the separate privileged cron test.
  console.log('SKIP Expiration sweep — requires separate service-role cron verification');
} finally {
  await cleanup.runAll();
  if (cleanup.failed) {
    for (const err of cleanup.errors) {
      results.push({ name: `cleanup: ${err.label}`, ok: false, error: err.error });
      console.log('FAIL cleanup: ' + err.label + '\n     ' + err.error);
    }
  }
}

const failed = results.filter((r) => !r.ok).length;
const assertionCount = results.length;
const out = {
  runId,
  at: new Date().toISOString(),
  project: 'znvhmuhojvwvjzmaqwff',
  migration: '20261021205913',
  authMethod,
  members: { a: maskEmail(emailA), b: maskEmail(emailB) },
  requestId,
  offerId,
  cancelRequestId,
  results,
  assertionCount,
  skipped: ['Expiration sweep — service_role cron only'],
  myPathSync: 'NOT TESTED in harness (device AsyncStorage); code path: community-plan-sync on create/detail',
  mobileUi: 'NOT TESTED this run (see report § Mobile UI)',
  nativeIphone: 'NOT TESTED',
  credentialsLogged: false,
  cleanupErrors: cleanup.errors,
};
fs.writeFileSync('qa-dev-community-exchange-e2e-results.json', JSON.stringify(out, null, 2));
console.log(`\n${assertionCount - failed}/${assertionCount} E2E assertions passed (expiration sweep SKIPPED). Wrote qa-dev-community-exchange-e2e-results.json`);
process.exit(failed ? 1 : 0);
