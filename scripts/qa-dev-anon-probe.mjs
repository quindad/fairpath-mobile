// DEV-only probe using ONLY the public anon/publishable key (the same one the app ships).
// It needs no account and no secret: it proves what an unauthenticated caller can and cannot do on DEV.
// Refuses to run against any project other than DEV. Writes nothing (every write attempt is expected to be rejected).
import fs from 'node:fs';

const DEV_REF = 'znvhmuhojvwvjzmaqwff';
const PROD_REF = 'rqpczemdagoddhuwefxt';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const linked = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (!url?.includes(DEV_REF) || url.includes(PROD_REF) || linked !== DEV_REF || !key || key.startsWith('<')) {
  console.error('REFUSING: this probe only runs against the DEV project.');
  process.exit(1);
}

const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  -> ' + detail : '')); };

async function rest(pathAndQuery, init = {}) {
  const r = await fetch(url + '/rest/v1/' + pathAndQuery, { headers: H, ...init });
  let body = null; try { body = await r.json(); } catch { /* empty */ }
  return { status: r.status, body };
}
const rpc = (name, args = {}) => rest('rpc/' + name, { method: 'POST', body: JSON.stringify(args) });
const denied = (r) => r.status === 401 || r.status === 403 || r.body?.code === '42501';
const missing = (r) => r.body?.code === 'PGRST202' || r.status === 404;

// ---- 1. new functions exist and are NOT callable by anon (service-only / member-only) ----
const notAnon = [
  ['create_notification', { p_user_id: '00000000-0000-0000-0000-000000000000', p_category: 'x', p_title: 'x', p_body: 'x' }],
  ['unread_notification_count', {}],
  ['register_push_token', { p_token: 'x'.repeat(20), p_platform: 'ios' }],
  ['partner_acknowledge_housing_inquiry', { p_inquiry_id: '00000000-0000-0000-0000-000000000000', p_state: 'seen' }],
  ['partner_reply_housing_inquiry', { p_inquiry_id: '00000000-0000-0000-0000-000000000000', p_message: 'x' }],
  ['mark_housing_inquiry_reply_read', { p_inquiry_id: '00000000-0000-0000-0000-000000000000' }],
  ['my_fairpath_plus_status', {}],
  ['fairpath_plus_status', { p_user: '00000000-0000-0000-0000-000000000000' }],
  ['has_fairpath_plus', { p_user: '00000000-0000-0000-0000-000000000000' }],
  ['issue_entitlement_grant', { p_user: '00000000-0000-0000-0000-000000000000', p_source_type: 'promo', p_source_ref: null, p_dedupe_key: null, p_days: 90 }],
  ['claim_correctional_transition', { p_user: '00000000-0000-0000-0000-000000000000', p_identity_key: 'x', p_deployment: 'x', p_verified_at: new Date().toISOString(), p_verified_by: 'x' }],
  ['revoke_entitlement_grant', { p_grant_id: '00000000-0000-0000-0000-000000000000', p_actor: 'x', p_reason: 'x' }],
  ['extend_entitlement_grant', { p_grant_id: '00000000-0000-0000-0000-000000000000', p_extra_days: 1, p_actor: 'x', p_reason: 'x' }],
  ['apply_subscription_event', { p_user: '00000000-0000-0000-0000-000000000000', p_provider: 'apple', p_external_id: 'x', p_product_id: 'x', p_status: 'active', p_period_start: null, p_period_end: null, p_auto_renew: false, p_environment: 'sandbox' }],
  ['send_entitlement_reminders', {}],
  ['sync_legacy_fairpath_plus', { p_user: '00000000-0000-0000-0000-000000000000' }],
  ['create_payment_transaction', { p_user: '00000000-0000-0000-0000-000000000000', p_purpose: 'housing_fasttrack', p_purpose_ref: '00000000-0000-0000-0000-000000000000', p_product_code: 'fasttrack_application', p_amount_cents: 1, p_currency: 'usd', p_idempotency_key: 'x', p_intent_id: 'x', p_customer_id: 'x' }],
  ['apply_payment_event', { p_event_id: 'x', p_type: 'payment_intent.succeeded', p_intent_id: 'x', p_amount_received: 1, p_currency: 'usd', p_amount_refunded: null, p_refund_id: null, p_failure_code: null, p_failure_message: null, p_payload: {} }],
  ['quote_housing_fasttrack', { p_application_id: '00000000-0000-0000-0000-000000000000' }],
  ['submit_housing_application', { p_application_id: '00000000-0000-0000-0000-000000000000', p_answers: {}, p_consent: {} }],
  ['save_housing_application_draft', { p_listing_id: '00000000-0000-0000-0000-000000000000', p_type: 'standard', p_answers: {}, p_step: 2 }],
  ['withdraw_housing_application', { p_application_id: '00000000-0000-0000-0000-000000000000' }],
  ['send_housing_inquiry', { p_listing_id: '00000000-0000-0000-0000-000000000000', p_subject: 'x', p_message: 'xxxxxxxxxxxx' }],
  ['submit_job_application', { p_job_id: '00000000-0000-0000-0000-000000000000', p_answers: {} }],
  ['withdraw_job_application', { p_application_id: '00000000-0000-0000-0000-000000000000' }],
];
for (const [name, args] of notAnon) {
  const r = await rpc(name, args);
  if (missing(r)) record(`function ${name} exists (anon hidden/denied)`, false, 'NOT FOUND for anon: migration missing or not exposed to anon (' + r.status + ')');
  else record(`anon cannot execute ${name}`, denied(r), denied(r) ? 'denied' : `status ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
}

// ---- 2. tables: anon has no access to sensitive/new tables ----
const closedTables = ['user_notifications', 'push_tokens', 'notification_deliveries', 'entitlement_grants', 'billing_subscriptions', 'corrections_migration_events', 'entitlement_audit_log',
  'payment_products', 'payment_transactions', 'payment_refunds', 'payment_events', 'stripe_customers', 'housing_inquiries', 'housing_applications', 'housing_application_events',
  'housing_application_documents', 'housing_fasttrack_orders', 'job_applications', 'job_application_events', 'fairpath_subscriptions', 'profiles', 'addresses', 'convictions', 'consent_events'];
for (const t of closedTables) {
  const r = await rest(t + '?select=*&limit=1');
  const ok = denied(r) || (r.status === 200 && Array.isArray(r.body) && r.body.length === 0);
  record(`anon reads nothing from ${t}`, ok, denied(r) ? 'permission denied' : r.status === 200 ? `${r.body?.length ?? '?'} rows (RLS)` : `status ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
}

// ---- 3. anon writes are rejected ----
for (const [t, row] of [['user_notifications', { user_id: '00000000-0000-0000-0000-000000000000', category: 'x', title: 'x', body: 'x' }],
  ['entitlement_grants', { user_id: '00000000-0000-0000-0000-000000000000', source_type: 'promo', expires_at: new Date(Date.now() + 864e5).toISOString() }],
  ['payment_transactions', { user_id: '00000000-0000-0000-0000-000000000000', purpose: 'housing_fasttrack', purpose_ref: '00000000-0000-0000-0000-000000000000', product_code: 'fasttrack_application', amount_cents: 1, idempotency_key: 'x' }],
  ['housing_fasttrack_orders', { application_id: '00000000-0000-0000-0000-000000000000', user_id: '00000000-0000-0000-0000-000000000000', amount_due_cents: 1, status: 'paid' }],
  ['housing_applications', { user_id: '00000000-0000-0000-0000-000000000000', listing_id: '00000000-0000-0000-0000-000000000000', status: 'approved' }]]) {
  const r = await rest(t, { method: 'POST', body: JSON.stringify(row) });
  record(`anon cannot insert into ${t}`, denied(r) || r.status >= 400, `status ${r.status} ${r.body?.code ?? ''}`);
}

// ---- 4. public functionality still works (Jobs/Housing regression at the data layer) ----
const jobs = await rpc('search_jobs', { p_zip: '43228', p_radius_miles: 25, p_limit: 5 });
record('search_jobs (ZIP 43228, 25mi) returns rows', jobs.status === 200 && Array.isArray(jobs.body) && jobs.body.length > 0, `status ${jobs.status}, ${Array.isArray(jobs.body) ? jobs.body.length : 0} rows`);
const homes = await rpc('search_housing', { p_zip: '43228', p_radius_miles: 25, p_limit: 5, p_filters: { fastTrack: true } });
record('search_housing (ZIP 43228, FastTrack) returns rows', homes.status === 200 && Array.isArray(homes.body) && homes.body.length > 0, `status ${homes.status}, ${Array.isArray(homes.body) ? homes.body.length : 0} rows`);
const zip = await rpc('resolve_postal_center', { p_zip: '43228' });
record('resolve_postal_center resolves 43228', zip.status === 200 && zip.body?.length === 1, JSON.stringify(zip.body).slice(0, 80));
const listings = await rest('housing_listings?select=id,title,fasttrack_enabled&status=eq.published&limit=3');
record('published housing listings readable by guests', listings.status === 200 && listings.body?.length > 0, `${listings.body?.length ?? 0} rows`);

// ---- 5. Edge Functions (deployed? correct refusals?) ----
async function fn(name, init) {
  try { const r = await fetch(`${url}/functions/v1/${name}`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, body: init?.body ?? '{}' }); let b = null; try { b = await r.json(); } catch { /* empty */ } return { status: r.status, body: b }; }
  catch (e) { return { status: 0, body: String(e) }; }
}
const hook = await fn('stripe-webhook', { headers: { 'stripe-signature': 't=1,v1=deadbeef' }, body: '{"id":"evt_fake","type":"payment_intent.succeeded"}' });
record('stripe-webhook rejects an invalid signature (or is unconfigured, never accepts)', [400, 501].includes(hook.status), `status ${hook.status} ${JSON.stringify(hook.body).slice(0, 90)}`);
const nosig = await fn('stripe-webhook', { body: '{}' });
record('stripe-webhook rejects a request with no signature', [400, 501].includes(nosig.status), `status ${nosig.status}`);
const pay = await fn('create-fasttrack-payment', { body: '{"application_id":"00000000-0000-0000-0000-000000000000","amount_cents":1}' });
record('create-fasttrack-payment refuses unauthenticated callers', [401, 501].includes(pay.status), `status ${pay.status} ${JSON.stringify(pay.body).slice(0, 90)}`);
const claim = await fn('claim-correctional-transition', { body: '{"user_id":"00000000-0000-0000-0000-000000000000"}' });
record('claim-correctional-transition refuses callers without the integration secret', [401, 501].includes(claim.status), `status ${claim.status} ${JSON.stringify(claim.body).slice(0, 90)}`);
const store = await fn('store-subscription-webhook', {});
record('store-subscription-webhook refuses (501) until store verification exists', store.status === 501, `status ${store.status}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) { console.log('FAILED:\n' + failed.map((f) => ' - ' + f.name + ' :: ' + f.detail).join('\n')); process.exit(1); }
