// DEV ONLY. Creates ONE disposable, pre-populated test member on the DEV project so the signed-in UI can be QA'd
// (Home bell, inbox, Housing Activity, FairPath+, Payments, Marketplace mirror, Jobs, Housing) without anyone
// typing a password. Prints a one-time local sign-in URL for the Expo web preview (http://localhost:8090).
//
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<DEV service-role key>"
//   node scripts/qa-dev-ui-session.mjs --confirm-dev            create + print the sign-in URL
//   node scripts/qa-dev-ui-session.mjs --cleanup --confirm-dev  delete everything this script created
//   Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
//
// Safety: DEV guards (same as the seed runner); users are passwordless @dev-seed.fairpath.test; the printed URL carries
// short-lived tokens for that disposable identity ONLY; nothing touches production, Stripe or a payment method.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { assertDevTarget } from '../supabase/seed/lib/guards.mjs';

const args = new Set(process.argv.slice(2));
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
try { assertDevTarget({ url, serviceKey, linkedRef: fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim(), confirmDev: args.has('--confirm-dev'), apply: true }); }
catch (e) { console.error(e.message); process.exit(1); }
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, opts);
const PREFIX = 'qa-ui-';
const DOMAIN = '@dev-seed.fairpath.test';

async function listQaUsers() {
  const out = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    out.push(...data.users.filter((u) => (u.email ?? '').startsWith(PREFIX) && (u.email ?? '').endsWith(DOMAIN)));
    if (data.users.length < 200) break;
  }
  return out;
}

if (args.has('--cleanup')) {
  await admin.from('payment_events').delete().like('provider_event_id', 'evt_qa_ui_%');
  await admin.from('corrections_migration_events').delete().like('identity_key', 'qa-ui-%');
  await admin.from('housing_listings').delete().like('title', 'QA UI %');
  let n = 0;
  for (const u of await listQaUsers()) { await admin.auth.admin.deleteUser(u.id); n++; }
  console.log(`Removed ${n} QA UI user(s) and their data.`);
  process.exit(0);
}

const stamp = Date.now().toString(36);
async function makeUser(label) {
  const email = `${PREFIX}${label}-${stamp}${DOMAIN}`;
  const c = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (c.error) throw new Error(c.error.message);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw new Error(link.error.message);
  const client = createClient(url, anonKey, opts);
  const v = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
  if (v.error) throw new Error(v.error.message);
  return { id: c.data.user.id, email, client, session: v.data.session };
}
const must = (r, label) => { if (r.error) throw new Error(label + ': ' + JSON.stringify(r.error)); return r.data; };

const tenant = await makeUser('member');
const owner = await makeUser('owner');
const now = new Date().toISOString();
must(await admin.from('profiles').update({ first_name: 'QA', last_name: 'Tester', onboarding_completed: true, zip_code: '43228', search_radius_miles: 25, terms_accepted_version: 'v1', terms_accepted_at: now, privacy_accepted_version: 'v1', privacy_accepted_at: now }).eq('id', tenant.id), 'profile');

const base = { owner_id: owner.id, description: 'QA UI listing for signed-in QA.', property_type: 'apartment', city: 'Columbus', state: 'OH', postal_code: '43228', latitude: 39.96, longitude: -83.0, rent_monthly: 1200, status: 'published', source_label: 'FairPath DEV QA', fasttrack_enabled: true };
const home = must(await admin.from('housing_listings').insert({ ...base, title: 'QA UI FastTrack Home' }).select('id').single(), 'listing');
const home2 = must(await admin.from('housing_listings').insert({ ...base, title: 'QA UI Second Home', fasttrack_enabled: false }).select('id').single(), 'listing2');

// inquiry 1: replied and UNREAD (bell +1, NEW REPLY); inquiry 2: SENT only
const i1 = must(await tenant.client.rpc('send_housing_inquiry', { p_listing_id: home.id, p_subject: 'QA reply demo', p_message: 'Is this home still available for a February move-in?' }), 'inquiry1');
await owner.client.rpc('partner_acknowledge_housing_inquiry', { p_inquiry_id: i1, p_state: 'received' });
await owner.client.rpc('partner_acknowledge_housing_inquiry', { p_inquiry_id: i1, p_state: 'seen' });
must(await owner.client.rpc('partner_reply_housing_inquiry', { p_inquiry_id: i1, p_message: 'Yes, it is available. You can request a tour any time.' }), 'reply');
must(await tenant.client.rpc('send_housing_inquiry', { p_listing_id: home2.id, p_subject: 'QA sent-only demo', p_message: 'Do you allow small dogs in this building?' }), 'inquiry2');

// correctional transition grant (90 days, no payment objects) for the Plus / Marketplace / expiry UI
must(await admin.rpc('claim_correctional_transition', { p_user: tenant.id, p_identity_key: `qa-ui-${stamp}`, p_deployment: 'QA Facility', p_verified_at: now, p_verified_by: 'qa-ui-session' }), 'claim');

// a FastTrack draft priced with the Plus discount + a server-settled test payment record for Payments history (DB boundary; NOT Stripe)
const FORM = { first_name: 'QA', last_name: 'Tester', email: tenant.email, phone: '(614) 555-0100', date_of_birth: '01/05/1985', current_address: '1 Test St, Columbus OH', monthly_income: '2000', employer: 'QA Co', employment_status: 'Employed', move_in_date: '12/31/2099', occupants: '1', pets: 'None', housing_history: 'None', references: 'None' };
const app = must(await tenant.client.rpc('save_housing_application_draft', { p_listing_id: home.id, p_type: 'fasttrack', p_answers: FORM, p_step: 5 }), 'draft')[0].id;
const quote = must(await tenant.client.rpc('quote_housing_fasttrack', { p_application_id: app }), 'quote')[0];
const tx = must(await admin.rpc('create_payment_transaction', { p_user: tenant.id, p_purpose: 'housing_fasttrack', p_purpose_ref: app, p_product_code: 'fasttrack_application', p_amount_cents: quote.amount_due_cents, p_currency: 'usd', p_idempotency_key: `qa-ui:${stamp}`, p_intent_id: `pi_qa_ui_${stamp}`, p_customer_id: 'cus_qa_ui' }), 'tx');
must(await admin.rpc('apply_payment_event', { p_event_id: `evt_qa_ui_${stamp}`, p_type: 'payment_intent.succeeded', p_intent_id: `pi_qa_ui_${stamp}`, p_amount_received: quote.amount_due_cents, p_currency: 'usd', p_amount_refunded: null, p_refund_id: null, p_failure_code: null, p_failure_message: null, p_payload: {} }), 'settle');
void tx;
await tenant.client.from('saved_housing').insert({ user_id: tenant.id, listing_id: home.id });

const s = tenant.session;
console.log(`\nDisposable DEV member created: ${tenant.email}`);
console.log('Seeded: 1 unread inquiry reply (bell), 1 SENT-only inquiry, correctional FairPath+ (90 days), FastTrack draft, one test payment record, 1 saved home.\n');
console.log('Open this URL in the Expo web preview (http://localhost:8090 must be running) to sign in as that member:\n');
console.log(`http://localhost:8090/auth/callback#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=${s.expires_in}&token_type=bearer&type=magiclink\n`);
console.log('When finished:  node scripts/qa-dev-ui-session.mjs --cleanup --confirm-dev');
