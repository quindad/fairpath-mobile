import assert from 'node:assert/strict';
import { createLocalDb, addUser, tryAs } from './lib/local-db.mjs';

const { db, errors } = await createLocalDb();
assert.equal(errors.length, 0);
const user = await addUser(db, 'notification-delivery-qa@test.local');
const other = await addUser(db, 'notification-delivery-other@test.local');

const signedOut = await tryAs(db, 'anon', 'select * from public.get_notification_preferences()');
assert.match(signedOut.error, /permission denied/i);

const defaults = await tryAs(db, user, 'select * from public.get_notification_preferences()');
assert.equal(defaults.error, undefined);
assert.deepEqual(defaults.rows[0], { push_enabled: false, marketing_enabled: false });

await tryAs(db, user, 'select public.set_notification_preferences(true, false)');
const enabled = await tryAs(db, user, 'select * from public.get_notification_preferences()');
assert.equal(enabled.rows[0].push_enabled, true);

await tryAs(db, user, "select public.register_push_token('ExponentPushToken[synthetic-not-real]', 'android', 'expo')");
const otherTokens = await tryAs(db, other, 'select token from public.push_tokens');
assert.deepEqual(otherTokens.rows, []);
const forgedPreference = await tryAs(db, other, 'select * from public.notification_preferences where user_id=$1', [user]);
assert.deepEqual(forgedPreference.rows, []);
const note = (await db.query("select public.create_notification($1,'housing_application','Application update','A decision is ready.','/notifications','qa:delivery') id", [user])).rows[0].id;
const claimed = await db.query('select * from public.claim_notification_deliveries(10)');
assert.equal(claimed.rows.length, 1);
assert.equal(claimed.rows[0].notification_id, note);
assert.deepEqual(claimed.rows[0].tokens, ['ExponentPushToken[synthetic-not-real]']);
assert.equal((await db.query('select * from public.claim_notification_deliveries(10)')).rows.length, 0, 'a second worker must not claim the same delivery');

await db.query("select public.complete_notification_delivery($1,'failed',null,'provider unavailable')", [claimed.rows[0].delivery_id]);
let delivery = (await db.query('select status,attempts,error from public.notification_deliveries where id=$1', [claimed.rows[0].delivery_id])).rows[0];
assert.equal(delivery.status, 'pending');
assert.equal(delivery.attempts, 1);
assert.match(delivery.error, /provider unavailable/);
await db.query('update public.notification_deliveries set next_attempt_at=now(), attempts=4 where id=$1', [claimed.rows[0].delivery_id]);
const finalClaim = (await db.query('select * from public.claim_notification_deliveries(10)')).rows[0];
await db.query("select public.complete_notification_delivery($1,'failed',null,'fifth failure')", [finalClaim.delivery_id]);
delivery = (await db.query('select status,attempts from public.notification_deliveries where id=$1', [finalClaim.delivery_id])).rows[0];
assert.deepEqual(delivery, { status: 'failed', attempts: 5 });

// Token retry scheduling must take precedence over the delivery-level attempt cap.
await db.query(`insert into public.notification_token_attempts(delivery_id,token,status,attempts,next_attempt_at)
 values($1,'ExponentPushToken[synthetic-not-real]','pending',2,now()+interval '8 minutes')`, [finalClaim.delivery_id]);
await db.query("select public.complete_notification_delivery($1,'failed',null,'token retry pending')", [finalClaim.delivery_id]);
let coordinated = (await db.query('select status,next_attempt_at from public.notification_deliveries where id=$1', [finalClaim.delivery_id])).rows[0];
assert.equal(coordinated.status, 'pending', 'pending token retries survive delivery attempt exhaustion');
const due = (await db.query('select next_attempt_at from public.notification_token_attempts where delivery_id=$1', [finalClaim.delivery_id])).rows[0].next_attempt_at;
assert.equal(new Date(coordinated.next_attempt_at).getTime(), new Date(due).getTime());
await db.query("update public.notification_token_attempts set status='failed' where delivery_id=$1", [finalClaim.delivery_id]);
await db.query("select public.complete_notification_delivery($1,'failed',null,'token retry exhausted')", [finalClaim.delivery_id]);
coordinated = (await db.query('select status from public.notification_deliveries where id=$1', [finalClaim.delivery_id])).rows[0];
assert.equal(coordinated.status, 'failed', 'exhausted tokens terminate the delivery');

const sentNote = (await db.query("select public.create_notification($1,'housing_application','Another update','Ready.','/notifications','qa:delivery:sent') id", [user])).rows[0].id;
const sentClaim = (await db.query('select * from public.claim_notification_deliveries(10)')).rows.find(row => row.notification_id === sentNote);
await db.query("select public.complete_notification_delivery($1,'sent','synthetic-ticket',null)", [sentClaim.delivery_id]);
assert.equal((await db.query('select status from public.notification_deliveries where id=$1', [sentClaim.delivery_id])).rows[0].status, 'sent');

// Preference changes must stop a queued delivery until the member explicitly opts back in.
await tryAs(db, user, 'select public.set_notification_preferences(false, false)');
const pushBlocked = (await db.query("select public.create_notification($1,'housing_application','Blocked update','No push.','/notifications','qa:delivery:push-blocked') id", [user])).rows[0].id;
const blockedClaims = (await db.query('select * from public.claim_notification_deliveries(10)')).rows;
assert.equal(blockedClaims.some(row => row.notification_id === pushBlocked), false, 'push opt-out did not block queued delivery');

await tryAs(db, user, 'select public.set_notification_preferences(true, false)');
const marketingBlocked = (await db.query("select public.create_notification($1,'marketing','Marketing update','No marketing push.','/notifications','qa:delivery:marketing-blocked') id", [user])).rows[0].id;
const noMarketingClaims = (await db.query('select * from public.claim_notification_deliveries(10)')).rows;
assert.equal(noMarketingClaims.some(row => row.notification_id === marketingBlocked), false, 'marketing opt-out did not block queued delivery');

await tryAs(db, user, 'select public.set_notification_preferences(true, true)');
const marketingClaims = (await db.query('select * from public.claim_notification_deliveries(10)')).rows;
assert.equal(marketingClaims.some(row => row.notification_id === marketingBlocked), true, 'marketing opt-in did not allow queued delivery');

// A physical device can change accounts; one token must follow the current account without duplication.
await tryAs(db, other, "select public.register_push_token('ExponentPushToken[synthetic-not-real]', 'android', 'expo')");
assert.equal((await db.query('select count(*)::int n from public.push_tokens where user_id=$1 and disabled_at is null', [user])).rows[0].n, 0, 'token remained active on the previous account');
assert.equal((await db.query('select count(*)::int n from public.push_tokens where user_id=$1 and disabled_at is null', [other])).rows[0].n, 1, 'token handoff created duplicate active records');

await tryAs(db, user, 'select public.unregister_push_token(null)');
assert.equal((await db.query('select count(*)::int n from public.push_tokens where user_id=$1 and disabled_at is null', [user])).rows[0].n, 0);

const denied = await tryAs(db, user, 'select * from public.claim_notification_deliveries(10)');
assert.match(denied.error, /permission denied/i);
console.log('PASS notification preferences, token lifecycle and service-only delivery claims');
await db.close();
