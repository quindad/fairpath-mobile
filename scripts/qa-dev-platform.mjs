// FairPath DEV platform QA harness. DEV ONLY. Exercises the Platform Foundation migrations against the real DEV
// database as real (temporary) signed-in test users, with real RLS/grants.
//
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<DEV service-role key>"
//   node scripts/qa-dev-platform.mjs --confirm-dev
//   Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
//
// Safety: refuses any project except DEV (same guards as the seed runner); key only from the environment; creates
// passwordless users @dev-seed.fairpath.test plus one QA listing, and deletes them all at the end (cascade). Nothing
// touches production, Stripe, or any real payment method. Payment tests call the SERVER settlement function directly
// (apply_payment_event) to prove the database boundary; they are NOT Stripe settlement and are labelled as such.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { assertDevTarget } from '../supabase/seed/lib/guards.mjs';

const args = new Set(process.argv.slice(2));
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const linkedRef = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
try { assertDevTarget({ url, serviceKey, linkedRef, confirmDev: args.has('--confirm-dev'), apply: true }); }
catch (e) { console.error(e.message); process.exit(1); }

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, opts);
const stamp = Date.now().toString(36);
const results = [];
const created = { users: [], listings: [] };

async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, ok: false, err: e.message }); console.log('FAIL ' + name + '\n     ' + e.message); }
}
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m ?? 'expected equal'}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };
const fails = (r, m) => { if (!r.error) throw new Error(m + ' (expected an error but it succeeded)'); };
const has = (r, text) => ok(r.error && (r.error.message + (r.error.code ?? '')).includes(text), `expected error containing "${text}", got ${JSON.stringify(r.error)}`);
const one = (r) => { if (r.error) throw new Error(JSON.stringify(r.error)); return Array.isArray(r.data) ? r.data[0] : r.data; };

async function makeUser(label, metadata = {}) {
  const email = `qa-${label}-${stamp}@dev-seed.fairpath.test`;
  const c = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: metadata });
  if (c.error) throw new Error('createUser: ' + c.error.message);
  const id = c.data.user.id;
  created.users.push(id);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw new Error('generateLink: ' + link.error.message);
  const client = createClient(url, anonKey, opts);
  const v = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
  if (v.error) throw new Error('verifyOtp: ' + v.error.message);
  return { id, email, client };
}
const unread = async (u) => Number((await u.client.rpc('unread_notification_count')).data);
const notes = async (u, key) => (await admin.from('user_notifications').select('id,category,dedupe_key,read_at').eq('user_id', u.id).like('dedupe_key', key + '%')).data ?? [];
const plusStatus = async (u) => one(await u.client.rpc('my_fairpath_plus_status'));
const quota = async (u) => one(await u.client.rpc('marketplace_claim_quota'));

const FORM = { first_name: 'Quinn', last_name: 'Tester', email: 'qa@example.test', phone: '(614) 555-0100', date_of_birth: '01/05/1985', current_address: '1 Test St', monthly_income: '2000', employer: 'QA Co', employment_status: 'Employed', move_in_date: '12/31/2099', occupants: '1', pets: 'None', housing_history: 'None', references: 'None' };

let tenant, owner, other, plusUser, plusUser2, listing, fastListing, inquiryId, fastApp, jobId;

console.log('DEV project confirmed. Creating QA identities (deleted at the end)…\n');

// ------------------------------------------------------------------ identities
await test('QA users can be created and sign in through server-issued OTP sessions', async () => {
  tenant = await makeUser('tenant');
  owner = await makeUser('owner');
  other = await makeUser('other');
  plusUser = await makeUser('plus');
  plusUser2 = await makeUser('plus2');
  for (const u of [tenant, owner, other, plusUser, plusUser2]) ok((await u.client.auth.getUser()).data.user?.id === u.id, 'session did not resolve to the user');
});
await test('signup trigger created exactly one member profile per user; client metadata cannot make an admin', async () => {
  const evil = await makeUser('evil', { account_type: 'admin', first_name: 'E' });
  const p = await admin.from('profiles').select('id,account_type').eq('id', evil.id);
  eq(p.data.length, 1, 'profile rows');
  eq(p.data[0].account_type, 'member', 'account_type must ignore client metadata');
});
await test('a member cannot change their own account_type', async () => {
  has(await tenant.client.from('profiles').update({ account_type: 'admin' }).eq('id', tenant.id), 'ACCOUNT_TYPE_LOCKED');
  eq((await admin.from('profiles').select('account_type').eq('id', tenant.id).single()).data.account_type, 'member');
});

// ------------------------------------------------------------------ QA listings
await test('QA listings (standard + FastTrack) created for the owner', async () => {
  const base = { owner_id: owner.id, description: 'QA listing', property_type: 'apartment', city: 'Columbus', state: 'OH', postal_code: '43228', latitude: 39.96, longitude: -83.0, rent_monthly: 1000, status: 'published', source_label: 'FairPath DEV QA' };
  const a = one(await admin.from('housing_listings').insert({ ...base, title: 'QA Standard Home ' + stamp }).select('id'));
  const b = one(await admin.from('housing_listings').insert({ ...base, title: 'QA FastTrack Home ' + stamp, fasttrack_enabled: true }).select('id'));
  listing = a.id; fastListing = b.id; created.listings.push(a.id, b.id);
});

// ------------------------------------------------------------------ notifications: direct-write protections
await test('notifications: members cannot insert, edit content, or touch other users\' rows', async () => {
  fails(await tenant.client.from('user_notifications').insert({ user_id: tenant.id, category: 'x', title: 'x', body: 'x' }), 'insert must fail');
  const seeded = one(await admin.from('user_notifications').insert({ user_id: tenant.id, category: 'qa', title: 'seed', body: 'seed' }).select('id'));
  fails(await tenant.client.from('user_notifications').update({ title: 'changed' }).eq('id', seeded.id), 'editing title must fail');
  const r = await other.client.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', seeded.id).select();
  eq(r.data ?? [], [], 'another user must not update it');
  eq(await unread(tenant), 1, 'unread count');
  ok(!(await tenant.client.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', seeded.id)).error, 'owner may set read_at');
  eq(await unread(tenant), 0, 'unread after read');
  await admin.from('user_notifications').delete().eq('id', seeded.id);
});
await test('notifications: create_notification is idempotent and not callable by members', async () => {
  has(await tenant.client.rpc('create_notification', { p_user_id: tenant.id, p_category: 'x', p_title: 'x', p_body: 'x' }), 'permission denied');
  for (let i = 0; i < 3; i++) await admin.rpc('create_notification', { p_user_id: tenant.id, p_category: 'qa', p_title: 'dup', p_body: 'dup', p_dedupe_key: 'qa:dup:' + stamp });
  eq((await notes(tenant, 'qa:dup:' + stamp)).length, 1, 'dedupe');
  eq((await admin.from('notification_deliveries').select('id', { count: 'exact' }).eq('channel', 'push').in('notification_id', (await notes(tenant, 'qa:dup:' + stamp)).map((n) => n.id))).count, 1, 'one queued delivery');
});

// ------------------------------------------------------------------ inquiry lifecycle
await test('inquiry: tenant sends; SENT initially; owner notified once; duplicate tap returns the same inquiry', async () => {
  const before = await unread(owner);
  const sent = await tenant.client.rpc('send_housing_inquiry', { p_listing_id: listing, p_subject: 'QA', p_message: 'Is this home still available?' });
  ok(!sent.error && sent.data, 'send: ' + JSON.stringify(sent.error)); inquiryId = sent.data;
  const again = await tenant.client.rpc('send_housing_inquiry', { p_listing_id: listing, p_subject: 'QA', p_message: 'Is this home still available?' });
  eq(again.data, inquiryId, 'duplicate returns same id');
  eq((await admin.from('housing_inquiries').select('id').eq('user_id', tenant.id).eq('listing_id', listing)).data.length, 1, 'only one inquiry row');
  const q = (await admin.from('housing_inquiries').select('received_at,seen_at,responded_at,reply_read_at,status').eq('id', inquiryId).single()).data;
  eq([q.received_at, q.seen_at, q.responded_at, q.reply_read_at, q.status], [null, null, null, null, 'open'], 'SENT only');
  eq((await notes(owner, 'housing_inquiry_new:' + inquiryId)).length, 1, 'exactly one owner notification');
  eq(await unread(owner), before + 1, 'owner unread +1');
});
await test('inquiry: tenants cannot forge RECEIVED/SEEN/REPLIED or write inquiries directly', async () => {
  fails(await tenant.client.from('housing_inquiries').update({ received_at: new Date().toISOString() }).eq('id', inquiryId), 'direct update must fail');
  fails(await tenant.client.from('housing_inquiries').insert({ user_id: tenant.id, listing_id: listing, message: 'direct insert here' }), 'direct insert must fail');
  has(await tenant.client.rpc('partner_acknowledge_housing_inquiry', { p_inquiry_id: inquiryId, p_state: 'seen' }), 'NOT_FOUND');
  has(await tenant.client.rpc('partner_reply_housing_inquiry', { p_inquiry_id: inquiryId, p_message: 'I reply to myself' }), 'CANNOT_REPLY');
  has(await other.client.rpc('partner_reply_housing_inquiry', { p_inquiry_id: inquiryId, p_message: 'stranger' }), 'CANNOT_REPLY');
  eq((await other.client.from('housing_inquiries').select('id').eq('id', inquiryId)).data ?? [], [], 'strangers cannot read it');
});
await test('inquiry: owner RECEIVED -> SEEN -> REPLIED; exactly one tenant notification; unread +1', async () => {
  const before = await unread(tenant);
  ok(!(await owner.client.rpc('partner_acknowledge_housing_inquiry', { p_inquiry_id: inquiryId, p_state: 'received' })).error, 'received');
  let q = (await admin.from('housing_inquiries').select('received_at,seen_at').eq('id', inquiryId).single()).data;
  ok(q.received_at && !q.seen_at, 'RECEIVED only');
  ok(!(await owner.client.rpc('partner_acknowledge_housing_inquiry', { p_inquiry_id: inquiryId, p_state: 'seen' })).error, 'seen');
  q = (await admin.from('housing_inquiries').select('seen_at').eq('id', inquiryId).single()).data;
  ok(q.seen_at, 'SEEN');
  ok(!(await owner.client.rpc('partner_reply_housing_inquiry', { p_inquiry_id: inquiryId, p_message: 'Yes — it is available.' })).error, 'reply');
  has(await owner.client.rpc('partner_reply_housing_inquiry', { p_inquiry_id: inquiryId, p_message: 'second reply' }), 'CANNOT_REPLY');
  q = (await admin.from('housing_inquiries').select('status,response_message,responded_at').eq('id', inquiryId).single()).data;
  eq([q.status, q.response_message], ['responded', 'Yes — it is available.']);
  const n = await notes(tenant, 'housing_inquiry_reply:' + inquiryId);
  eq(n.length, 1, 'exactly one reply notification');
  eq(await unread(tenant), before + 1, 'tenant unread +1');
  const row = (await admin.from('user_notifications').select('route,category').eq('id', n[0].id).single()).data;
  eq([row.route, row.category], ['/housing-activity', 'housing_inquiry'], 'deep link');
});
await test('inquiry: opening the reply marks it read server-side and decrements the count; repeat is harmless; strangers cannot mark it', async () => {
  const before = await unread(tenant);
  await other.client.rpc('mark_housing_inquiry_reply_read', { p_inquiry_id: inquiryId });
  eq((await admin.from('housing_inquiries').select('reply_read_at').eq('id', inquiryId).single()).data.reply_read_at, null, 'stranger cannot mark read');
  ok(!(await tenant.client.rpc('mark_housing_inquiry_reply_read', { p_inquiry_id: inquiryId })).error);
  const first = (await admin.from('housing_inquiries').select('reply_read_at').eq('id', inquiryId).single()).data.reply_read_at;
  ok(first, 'reply_read_at set');
  await tenant.client.rpc('mark_housing_inquiry_reply_read', { p_inquiry_id: inquiryId });
  eq((await admin.from('housing_inquiries').select('reply_read_at').eq('id', inquiryId).single()).data.reply_read_at, first, 'idempotent');
  eq(await unread(tenant), before - 1, 'unread decremented');
  eq((await notes(tenant, 'housing_inquiry_reply:' + inquiryId))[0].read_at !== null, true, 'notification read');
});
await test('inquiry: rate limit (5 per home per 24h) and validation hold', async () => {
  has(await tenant.client.rpc('send_housing_inquiry', { p_listing_id: listing, p_subject: 'x', p_message: 'short' }), 'INVALID_MESSAGE');
  let limited = false;
  for (let i = 0; i < 6; i++) { const r = await tenant.client.rpc('send_housing_inquiry', { p_listing_id: listing, p_subject: 'x', p_message: 'Another distinct question number ' + i }); if (r.error?.message.includes('RATE_LIMITED')) limited = true; }
  ok(limited, 'rate limit must trigger');
});

// ------------------------------------------------------------------ housing application security + pricing
await test('housing: draft only after meaningful input; members cannot set status; withdraw only from submitted states', async () => {
  has(await tenant.client.rpc('save_housing_application_draft', { p_listing_id: fastListing, p_type: 'fasttrack', p_answers: FORM, p_step: 1 }), 'NO_MEANINGFUL_INPUT');
  eq((await admin.from('housing_applications').select('id').eq('user_id', tenant.id)).data.length, 0, 'opening creates nothing');
  fastApp = one(await tenant.client.rpc('save_housing_application_draft', { p_listing_id: fastListing, p_type: 'fasttrack', p_answers: { ...FORM, evil: 'x' }, p_step: 2 })).id;
  const row = (await admin.from('housing_applications').select('status,answers').eq('id', fastApp).single()).data;
  eq(row.status, 'started'); ok(!('evil' in row.answers), 'answers whitelisted');
  fails(await tenant.client.from('housing_applications').update({ status: 'approved' }).eq('id', fastApp), 'self-approve must fail');
  fails(await tenant.client.from('housing_applications').insert({ user_id: tenant.id, listing_id: listing, status: 'approved' }), 'direct insert must fail');
  has(await tenant.client.rpc('withdraw_housing_application', { p_application_id: fastApp }), 'CANNOT_WITHDRAW');
  eq((await admin.from('housing_application_events').select('event_type').eq('application_id', fastApp)).data.map((e) => e.event_type), ['started'], 'started event by trigger');
  fails(await tenant.client.from('housing_application_events').insert({ application_id: fastApp, actor_user_id: tenant.id, event_type: 'approved' }), 'forged event must fail');
});
await test('payments: FastTrack quote is server-priced (non-Plus $75.00, no discount) and clients cannot pick an amount', async () => {
  const q = one(await tenant.client.rpc('quote_housing_fasttrack', { p_application_id: fastApp }));
  eq([q.base_amount_cents, q.discount_cents, q.amount_due_cents, q.status, q.payment_enforced], [7500, 0, 7500, 'requires_payment', false], 'non-plus quote / enforcement off');
  fails(await tenant.client.from('housing_fasttrack_orders').update({ status: 'paid', amount_due_cents: 1 }).eq('application_id', fastApp), 'order edit must fail');
  fails(await tenant.client.from('housing_fasttrack_orders').insert({ application_id: fastApp, user_id: tenant.id, amount_due_cents: 1, status: 'paid' }), 'order insert must fail');
  has(await other.client.rpc('quote_housing_fasttrack', { p_application_id: fastApp }), 'NOT_FASTTRACK_APPLICATION');
  has(await tenant.client.rpc('quote_housing_fasttrack', { p_application_id: '00000000-0000-0000-0000-000000000000' }), 'NOT_FASTTRACK_APPLICATION');
});

// ------------------------------------------------------------------ payments: database settlement boundary
// (calls the SERVER settlement function directly; this is NOT Stripe settlement and proves nothing about Stripe)
await test('payments (DB boundary): wrong amount rejected; duplicate event ignored; success settles the ORDER only', async () => {
  const tx = (await admin.rpc('create_payment_transaction', { p_user: tenant.id, p_purpose: 'housing_fasttrack', p_purpose_ref: fastApp, p_product_code: 'fasttrack_application', p_amount_cents: 7500, p_currency: 'usd', p_idempotency_key: 'qa:' + stamp + ':1', p_intent_id: 'pi_qa_' + stamp + '_1', p_customer_id: 'cus_qa' })).data;
  ok(tx, 'transaction created');
  eq((await admin.rpc('create_payment_transaction', { p_user: tenant.id, p_purpose: 'housing_fasttrack', p_purpose_ref: fastApp, p_product_code: 'fasttrack_application', p_amount_cents: 7500, p_currency: 'usd', p_idempotency_key: 'qa:' + stamp + ':1', p_intent_id: 'pi_qa_' + stamp + '_1', p_customer_id: 'cus_qa' })).data, tx, 'same idempotency key returns same transaction');
  const dup = await admin.rpc('create_payment_transaction', { p_user: tenant.id, p_purpose: 'housing_fasttrack', p_purpose_ref: fastApp, p_product_code: 'fasttrack_application', p_amount_cents: 7500, p_currency: 'usd', p_idempotency_key: 'qa:' + stamp + ':other', p_intent_id: 'pi_qa_' + stamp + '_x', p_customer_id: 'cus_qa' });
  fails(dup, 'a second live attempt for the same application must be refused');
  const ev = (id, type, extra = {}) => admin.rpc('apply_payment_event', { p_event_id: 'evt_qa_' + stamp + '_' + id, p_type: type, p_intent_id: 'pi_qa_' + stamp + '_1', p_amount_received: 7500, p_currency: 'usd', p_amount_refunded: null, p_refund_id: null, p_failure_code: null, p_failure_message: null, p_payload: {}, ...extra });
  eq((await ev('wrong', 'payment_intent.succeeded', { p_amount_received: 100 })).data, 'amount_mismatch');
  eq((await admin.from('payment_transactions').select('status').eq('id', tx).single()).data.status, 'requires_payment_method', 'not settled');
  eq((await admin.from('housing_fasttrack_orders').select('status').eq('application_id', fastApp).single()).data.status, 'requires_payment', 'order untouched');
  eq((await ev('unknown', 'payment_intent.succeeded', { p_intent_id: 'pi_unknown' })).data, 'unknown_transaction');
  eq((await ev('fail', 'payment_intent.payment_failed', { p_failure_code: 'card_declined', p_failure_message: 'declined' })).data, 'failed');
  eq((await admin.from('payment_transactions').select('status,failure_code').eq('id', tx).single()).data, { status: 'failed', failure_code: 'card_declined' });
  eq((await ev('ok', 'payment_intent.succeeded')).data, 'succeeded');
  eq((await ev('ok', 'payment_intent.succeeded')).data, 'duplicate', 'duplicate webhook');
  eq((await admin.from('payment_transactions').select('status').eq('id', tx).single()).data.status, 'succeeded');
  eq((await admin.from('housing_fasttrack_orders').select('status,provider').eq('application_id', fastApp).single()).data, { status: 'paid', provider: 'stripe' });
  eq((await notes(tenant, 'payment_succeeded:' + tx)).length, 1, 'one receipt notification');
  // PAYMENT != APPROVAL / SUBMISSION
  eq((await admin.from('housing_applications').select('status,submitted_at').eq('id', fastApp).single()).data, { status: 'started', submitted_at: null }, 'application untouched by payment');
});
await test('payments: history is owner-only and column-limited; members cannot write payment tables', async () => {
  const mine = await tenant.client.from('payment_transactions').select('id,purpose,purpose_ref,amount_cents,currency,status,provider_payment_intent_id,failure_code,created_at,succeeded_at').eq('user_id', tenant.id).order('created_at', { ascending: false });
  ok(!mine.error && mine.data.length >= 1, 'own history readable with the exact query the app runs: ' + JSON.stringify(mine.error));
  has(await tenant.client.from('payment_transactions').select('metadata'), 'permission denied');
  has(await tenant.client.from('payment_transactions').select('provider_customer_id'), 'permission denied');
  eq((await other.client.from('payment_transactions').select('id')).data ?? [], [], 'others see nothing');
  fails(await tenant.client.from('payment_transactions').update({ status: 'succeeded' }).eq('purpose_ref', fastApp), 'update must fail');
  fails(await tenant.client.from('payment_transactions').insert({ user_id: tenant.id, purpose: 'housing_fasttrack', purpose_ref: fastApp, product_code: 'fasttrack_application', amount_cents: 1, idempotency_key: 'x' + stamp }), 'insert must fail');
  has(await tenant.client.rpc('apply_payment_event', { p_event_id: 'e', p_type: 'payment_intent.succeeded', p_intent_id: 'x', p_amount_received: 1, p_currency: 'usd', p_amount_refunded: null, p_refund_id: null, p_failure_code: null, p_failure_message: null, p_payload: {} }), 'permission denied');
  has(await tenant.client.from('payment_events').select('*'), 'permission denied');
});
await test('payments (DB boundary): processing, requires_action, cancellation, full and partial refund events', async () => {
  const refs = []; for (let i = 0; i < 3; i++) refs.push(crypto.randomUUID());
  const mk = async (i, status) => {
    const id = (await admin.rpc('create_payment_transaction', { p_user: tenant.id, p_purpose: 'housing_fasttrack', p_purpose_ref: refs[i], p_product_code: 'fasttrack_application', p_amount_cents: 6500, p_currency: 'usd', p_idempotency_key: `qa:${stamp}:m${i}`, p_intent_id: `pi_qa_${stamp}_m${i}`, p_customer_id: 'cus_qa' })).data;
    return id;
  };
  const t0 = await mk(0), t1 = await mk(1), t2 = await mk(2);
  const ev = (i, type, extra = {}) => admin.rpc('apply_payment_event', { p_event_id: `evt_qa_${stamp}_m${i}_${type}_${Math.random()}`, p_type: type, p_intent_id: `pi_qa_${stamp}_m${i}`, p_amount_received: 6500, p_currency: 'usd', p_amount_refunded: null, p_refund_id: null, p_failure_code: null, p_failure_message: null, p_payload: {}, ...extra });
  await ev(0, 'payment_intent.processing');
  eq((await admin.from('payment_transactions').select('status').eq('id', t0).single()).data.status, 'processing');
  await ev(0, 'payment_intent.canceled');
  eq((await admin.from('payment_transactions').select('status').eq('id', t0).single()).data.status, 'canceled');
  await ev(1, 'payment_intent.requires_action');
  eq((await admin.from('payment_transactions').select('status').eq('id', t1).single()).data.status, 'requires_action');
  await ev(1, 'payment_intent.succeeded'); await ev(2, 'payment_intent.succeeded');
  await ev(1, 'charge.refunded', { p_amount_refunded: 6500, p_refund_id: 're_qa_' + stamp + '_1' });
  eq((await admin.from('payment_transactions').select('status').eq('id', t1).single()).data.status, 'refunded');
  await ev(2, 'charge.refunded', { p_amount_refunded: 1000, p_refund_id: 're_qa_' + stamp + '_2' });
  eq((await admin.from('payment_transactions').select('status').eq('id', t2).single()).data.status, 'partially_refunded');
  eq((await admin.from('payment_refunds').select('id').in('transaction_id', [t1, t2])).data.length, 2, 'refund rows');
  const refunds = await tenant.client.from('payment_refunds').select('amount_cents,status').in('transaction_id', [t1, t2]);
  eq(refunds.data.length, 2, 'member sees own refunds');
});

// ------------------------------------------------------------------ entitlements
await test('entitlements: free member is free; cannot self-award, edit grants, call issuance or claim', async () => {
  eq((await plusStatus(tenant)).active, false);
  eq((await quota(tenant)).plan, 'free');
  fails(await tenant.client.from('entitlement_grants').insert({ user_id: tenant.id, source_type: 'promo', expires_at: new Date(Date.now() + 864e5).toISOString() }), 'insert grant');
  fails(await tenant.client.from('fairpath_subscriptions').insert({ user_id: tenant.id, plan: 'fairpath_plus', status: 'active' }), 'legacy insert');
  fails(await tenant.client.from('billing_subscriptions').insert({ user_id: tenant.id, provider: 'manual', external_subscription_id: 'x', product_id: 'x', status: 'active' }), 'billing insert');
  for (const [fn, a] of [['issue_entitlement_grant', { p_user: tenant.id, p_source_type: 'promo', p_source_ref: null, p_dedupe_key: null, p_days: 90 }], ['claim_correctional_transition', { p_user: tenant.id, p_identity_key: 'k', p_deployment: 'd', p_verified_at: new Date().toISOString(), p_verified_by: 'me' }], ['sync_legacy_fairpath_plus', { p_user: tenant.id }]]) has(await tenant.client.rpc(fn, a), 'permission denied');
  eq((await plusStatus(tenant)).active, false, 'still free');
});
const identityKey = 'qa-identity-' + stamp;
await test('correctional transition: verified claim grants exactly 90 days with no payment objects; Plus active; Marketplace mirror = 7', async () => {
  const before = Date.now();
  const r = one(await admin.rpc('claim_correctional_transition', { p_user: plusUser.id, p_identity_key: identityKey, p_deployment: 'QA Facility', p_verified_at: new Date().toISOString(), p_verified_by: 'qa-harness' }));
  eq(r.result, 'granted');
  const days = (new Date(r.expires_at).getTime() - before) / 864e5;
  ok(days > 89.99 && days < 90.01, `duration must be 90 days, got ${days}`);
  const s = await plusStatus(plusUser);
  eq([s.active, s.source, s.complimentary, s.will_renew], [true, 'correctional_transition', true, false]);
  eq(s.days_remaining, 90);
  eq((await admin.from('billing_subscriptions').select('id').eq('user_id', plusUser.id)).data.length, 0, 'no subscription');
  eq((await admin.from('stripe_customers').select('user_id').eq('user_id', plusUser.id)).data.length, 0, 'no Stripe customer');
  eq((await admin.from('payment_transactions').select('id').eq('user_id', plusUser.id)).data.length, 0, 'no payment transaction');
  const legacy = (await admin.from('fairpath_subscriptions').select('status,current_period_end').eq('user_id', plusUser.id).single()).data;
  eq(legacy.status, 'active'); ok(Math.abs(new Date(legacy.current_period_end) - new Date(r.expires_at)) < 2000, 'mirror ends with the grant');
  const q = await quota(plusUser); eq([q.plan, q.monthly_limit], ['fairpath_plus', 7]);
  eq((await notes(plusUser, 'entitlement_granted:')).length, 1, 'one activation notification');
});
await test('correctional transition: repeat claim, identity reuse by another account, and a second identity for one account cannot mint more Plus', async () => {
  const again = one(await admin.rpc('claim_correctional_transition', { p_user: plusUser.id, p_identity_key: identityKey, p_deployment: 'QA Facility', p_verified_at: new Date().toISOString(), p_verified_by: 'qa-harness' }));
  eq(again.result, 'already_claimed');
  const steal = one(await admin.rpc('claim_correctional_transition', { p_user: plusUser2.id, p_identity_key: identityKey, p_deployment: 'QA Facility', p_verified_at: new Date().toISOString(), p_verified_by: 'qa-harness' }));
  eq(steal.result, 'already_claimed');
  eq((await plusStatus(plusUser2)).active, false, 'other account got nothing');
  const second = one(await admin.rpc('claim_correctional_transition', { p_user: plusUser.id, p_identity_key: identityKey + '-2', p_deployment: 'QA Facility', p_verified_at: new Date().toISOString(), p_verified_by: 'qa-harness' }));
  eq(second.result, 'account_already_has_benefit');
  eq((await admin.from('entitlement_grants').select('id').eq('user_id', plusUser.id)).data.length, 1, 'exactly one grant');
  eq((await admin.from('corrections_migration_events').select('id').eq('identity_key', identityKey + '-2')).data.length, 0, 'second identity not consumed');
});
await test('FairPath+ pricing: Plus member gets the $10 FastTrack discount ($65.00 due)', async () => {
  const app = one(await plusUser.client.rpc('save_housing_application_draft', { p_listing_id: fastListing, p_type: 'fasttrack', p_answers: FORM, p_step: 2 })).id;
  const q = one(await plusUser.client.rpc('quote_housing_fasttrack', { p_application_id: app }));
  eq([q.base_amount_cents, q.discount_cents, q.amount_due_cents], [7500, 1000, 6500]);
});
await test('expiration is time-based on the server: Plus and the Marketplace mirror end by themselves; account untouched; nothing charged; renewal boundary reported', async () => {
  const grant = (await admin.from('entitlement_grants').select('id').eq('user_id', plusUser.id).single()).data.id;
  const soon = new Date(Date.now() + 4000).toISOString();
  ok(!(await admin.from('entitlement_grants').update({ starts_at: new Date(Date.now() - 3600e3).toISOString(), expires_at: soon }).eq('id', grant)).error);
  await admin.rpc('sync_legacy_fairpath_plus', { p_user: plusUser.id });
  eq((await plusStatus(plusUser)).active, true, 'still active before the end');
  await new Promise((r) => setTimeout(r, 6000));
  const s = await plusStatus(plusUser);
  eq(s.active, false, 'expired without any job running');
  eq([s.expired_source], ['correctional_transition']);
  eq((await quota(plusUser)).plan, 'free', 'legacy mirror expired by itself');
  ok((await admin.from('profiles').select('id').eq('id', plusUser.id)).data.length === 1, 'profile remains');
  const u = (await admin.auth.admin.getUserById(plusUser.id)).data.user; ok(!u.banned_until, 'account not disabled');
  eq((await admin.from('billing_subscriptions').select('id').eq('user_id', plusUser.id)).data.length, 0, 'no subscription created');
  eq((await admin.from('payment_transactions').select('id').eq('user_id', plusUser.id)).data.length, 0, 'no charge');
  ok(!(await plusUser.client.rpc('search_jobs', { p_limit: 1 })).error, 'free features still work');
});
await test('reminders: expiring grant gets 14/7-day notices once; ended notice once; reruns create nothing', async () => {
  await admin.rpc('issue_entitlement_grant', { p_user: plusUser2.id, p_source_type: 'promo', p_source_ref: 'qa', p_dedupe_key: 'qa:' + stamp, p_days: 90, p_reason: 'qa' });
  const gid = (await admin.from('entitlement_grants').select('id').eq('user_id', plusUser2.id).single()).data.id;
  await admin.from('entitlement_grants').update({ starts_at: new Date(Date.now() - 86400e3).toISOString(), expires_at: new Date(Date.now() + 5 * 86400e3).toISOString() }).eq('id', gid);
  const first = (await admin.rpc('send_entitlement_reminders')).data;
  const again = (await admin.rpc('send_entitlement_reminders')).data;
  const mine = (await notes(plusUser2, 'entitlement_expiring:' + gid));
  eq(mine.length, 2, '14- and 7-day thresholds only (5 days left)'); ok(first >= 2, 'created'); eq(again, 0, 'idempotent rerun');
  const dupIssue = await admin.rpc('issue_entitlement_grant', { p_user: plusUser2.id, p_source_type: 'promo', p_source_ref: 'qa', p_dedupe_key: 'qa:' + stamp, p_days: 90, p_reason: 'qa' });
  eq((await admin.from('entitlement_grants').select('id').eq('user_id', plusUser2.id)).data.length, 1, 'issue is idempotent by dedupe key'); void dupIssue;
  await admin.from('entitlement_grants').update({ starts_at: new Date(Date.now() - 3 * 86400e3).toISOString(), expires_at: new Date(Date.now() - 3600e3).toISOString() }).eq('id', gid);
  await admin.rpc('send_entitlement_reminders'); const ended = await admin.rpc('send_entitlement_reminders');
  eq((await notes(plusUser2, 'entitlement_expired:' + gid)).length, 1, 'one ended notice'); eq(ended.data, 0);
});
await test('audit log: every entitlement action recorded and the log is append-only', async () => {
  const rows = (await admin.from('entitlement_audit_log').select('id,action').eq('user_id', plusUser.id)).data;
  ok(rows.some((r) => r.action === 'correctional_claim') && rows.some((r) => r.action === 'grant_issued') && rows.some((r) => r.action === 'correctional_claim_duplicate'), 'actions logged');
  ok((await admin.from('entitlement_audit_log').update({ actor: 'x' }).eq('id', rows[0].id)).error, 'update must fail');
  ok((await admin.from('entitlement_audit_log').delete().eq('id', rows[0].id)).error, 'delete must fail');
  has(await tenant.client.from('entitlement_audit_log').select('*'), 'permission denied');
});
await test('RLS: members see only their own grants; strangers see none', async () => {
  eq((await tenant.client.from('entitlement_grants').select('id')).data, []);
  ok((await plusUser2.client.from('entitlement_grants').select('id')).data.length === 1);
  eq((await other.client.from('corrections_migration_events').select('id')).error?.message.includes('permission denied'), true);
});

// ------------------------------------------------------------------ Jobs / Housing regression as a signed-in member
await test('regression: signed-in Jobs search, secure Easy Apply, history and withdraw still work', async () => {
  const s = await tenant.client.rpc('search_jobs', { p_zip: '43228', p_radius_miles: 25, p_limit: 20 });
  ok(!s.error && s.data.length > 0, 'search_jobs');
  const cand = s.data.map((r) => r.job).find((j) => j.application_method !== 'external');
  ok(cand, 'a non-external seed job exists'); jobId = cand.id;
  const applied = await tenant.client.rpc('submit_job_application', { p_job_id: jobId, p_answers: { profile: { first_name: 'Quinn', last_name: 'Tester', phone: '(614) 555-0100', date_of_birth: '01/01/1990', address: 'x' }, employer_questions: Object.fromEntries((cand.application_questions ?? []).filter((q) => q.required).map((q) => [q.id, q.type === 'yes_no' ? 'Yes' : 'ok'])) } });
  ok(!applied.error, 'submit: ' + JSON.stringify(applied.error));
  has(await tenant.client.rpc('submit_job_application', { p_job_id: jobId, p_answers: {} }), 'ALREADY_APPLIED');
  const stored = (await admin.from('job_applications').select('id,status,answers').eq('user_id', tenant.id).eq('job_id', jobId).single()).data;
  ok(!('date_of_birth' in stored.answers.profile) && !('address' in stored.answers.profile), 'DOB/address never stored');
  fails(await tenant.client.from('job_applications').insert({ user_id: tenant.id, job_id: jobId, status: 'hired' }), 'direct insert');
  fails(await tenant.client.from('job_applications').update({ status: 'hired' }).eq('id', stored.id), 'direct status update must fail');
  has(await other.client.rpc('withdraw_job_application', { p_application_id: stored.id }), 'CANNOT_WITHDRAW');
  ok(!(await tenant.client.rpc('withdraw_job_application', { p_application_id: stored.id })).error, 'withdraw');
  has(await tenant.client.rpc('withdraw_job_application', { p_application_id: stored.id }), 'CANNOT_WITHDRAW');
  eq((await tenant.client.from('job_application_events').select('event_type').eq('application_id', stored.id).order('created_at')).data.map((e) => e.event_type), ['submitted', 'withdrawn']);
});
await test('housing: standard submit -> withdraw lifecycle is server-controlled; no direct edits; no resubmit; one notification per status', async () => {
  const d = new Date(Date.now() + 30 * 864e5); const move = String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + '/' + d.getFullYear();
  const form = { ...FORM, move_in_date: move };
  const app = one(await other.client.rpc('save_housing_application_draft', { p_listing_id: listing, p_type: 'standard', p_answers: form, p_step: 4 })).id;
  has(await other.client.rpc('submit_housing_application', { p_application_id: app, p_answers: form, p_consent: { accuracy: true } }), 'CONSENT_REQUIRED');
  has(await tenant.client.rpc('submit_housing_application', { p_application_id: app, p_answers: form, p_consent: { accuracy: true, submit: true } }), 'APPLICATION_NOT_SUBMITTABLE');
  const sub = one(await other.client.rpc('submit_housing_application', { p_application_id: app, p_answers: form, p_consent: { accuracy: true, submit: true } }));
  eq(sub.status, 'submitted');
  has(await other.client.rpc('submit_housing_application', { p_application_id: app, p_answers: form, p_consent: { accuracy: true, submit: true } }), 'APPLICATION_NOT_SUBMITTABLE');
  fails(await other.client.from('housing_applications').update({ status: 'approved' }).eq('id', app), 'direct edit must fail');
  has(await tenant.client.rpc('withdraw_housing_application', { p_application_id: app }), 'CANNOT_WITHDRAW');
  ok(!(await other.client.rpc('withdraw_housing_application', { p_application_id: app })).error, 'owner withdraw');
  has(await other.client.rpc('withdraw_housing_application', { p_application_id: app }), 'CANNOT_WITHDRAW');
  has(await other.client.rpc('save_housing_application_draft', { p_listing_id: listing, p_type: 'standard', p_answers: form, p_step: 3 }), 'APPLICATION_NOT_EDITABLE');
  eq((await admin.from('housing_application_events').select('event_type').eq('application_id', app).order('created_at')).data.map((e) => e.event_type), ['started', 'submitted', 'withdrawn']);
  eq((await notes(other, 'housing_app:' + app + ':submitted')).length, 1); eq((await notes(other, 'housing_app:' + app + ':withdrawn')).length, 1);
});
await test('regression: signed-in Housing search, saved homes, application list and Marketplace RPC still work', async () => {
  const h = await tenant.client.rpc('search_housing', { p_zip: '43228', p_radius_miles: 25, p_filters: {}, p_limit: 5 });
  ok(!h.error && h.data.length > 0, 'search_housing');
  const id = h.data[0].listing.id;
  ok(!(await tenant.client.from('saved_housing').insert({ user_id: tenant.id, listing_id: id })).error, 'save home');
  eq((await tenant.client.from('saved_housing').select('listing_id').eq('listing_id', id)).data.length, 1);
  ok(!(await tenant.client.from('saved_housing').delete().eq('listing_id', id).eq('user_id', tenant.id)).error, 'unsave');
  ok(!(await tenant.client.from('housing_applications').select('id,status')).error, 'own applications readable');
  ok(!(await tenant.client.rpc('marketplace_claim_quota')).error, 'marketplace quota');
});

// ------------------------------------------------------------------ cleanup
console.log('\nCleaning up QA data…');
try {
  await admin.from('payment_events').delete().like('provider_event_id', 'evt_qa_' + stamp + '%');
  await admin.from('corrections_migration_events').delete().like('identity_key', 'qa-identity-' + stamp + '%');
  for (const id of created.listings) await admin.from('housing_listings').delete().eq('id', id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  console.log('QA users and listings removed (entitlement_audit_log rows are append-only by design and remain).');
} catch (e) { console.log('Cleanup problem: ' + e.message + ' — QA users are @dev-seed.fairpath.test and safe to delete manually.'); }

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
fs.writeFileSync('qa-dev-platform-results.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
if (failed.length) { console.log('FAILED:\n' + failed.map((f) => ' - ' + f.name + '\n     ' + f.err).join('\n')); process.exit(1); }
