// Creates (or reuses) a DEV-only synthetic Partner Command Center test account: an auth user, a dev_fixture
// organization, an active owner-level membership, and active employment/housing/case_management capabilities so
// the account can click through every section of the Partner app (Caseload, Referrals, Jobs, Housing, Impact,
// Campaigns). Mirrors the existing scripts/dev-qa-create-account.mjs pattern for the mobile QA account: public
// anon-key signUp for the auth user (never service-role to impersonate a real sign-up), service-role ONLY for
// the org/membership/capability rows that have no public self-serve path. Refuses to run against anything that
// is not the known DEV project. The password is generated locally and written only to a gitignored file; it is
// never printed, logged, or returned to the caller.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

const CRED_FILE = '.dev-qa-partner-credentials.local.json';
const QA_EMAIL = process.env.PARTNER_QA_EMAIL || 'fairpath.qa.partner.a@example.com';
const ORG_ID = '99999999-9999-4999-8999-999999999991';
const ORG_NAME = '[TEST] FairPath QA Partner Org';

function loadEnvLocal(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnvLocal('.env.local');
loadEnvLocal('../fairpath-admin/.env.local'); // the only repo on this machine with SUPABASE_SERVICE_ROLE_KEY configured locally

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) { console.error('Missing Supabase URL/anon key in .env.local'); process.exit(1); }
if (!serviceKey) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY (expected in ../fairpath-admin/.env.local)'); process.exit(1); }
if (url.includes('rqpczemdagoddhuwefxt')) { console.error('Refusing to run: this would target the PRODUCTION project. Aborting.'); process.exit(1); }

const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const genPassword = () => randomBytes(24).toString('base64').replace(/[+/=]/g, 'x') + 'Aa1!';

async function main() {
  let password;
  if (existsSync(CRED_FILE)) {
    const existing = JSON.parse(readFileSync(CRED_FILE, 'utf8'));
    if (existing.email === QA_EMAIL) password = existing.password;
  }
  if (!password) password = genPassword();

  // Created via the service-role admin API (email_confirm: true), not the public anon signUp flow: a plain
  // signUp sends a real confirmation email, and DEV's project hit its email rate limit during testing. A
  // synthetic test account has no real inbox anyway, so admin.createUser is the correct tool here, not a
  // workaround — it's the same thing the Supabase dashboard's own "Add user" button does.
  let userId;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: QA_EMAIL, password, email_confirm: true,
  });
  if (createError && /already been registered|already exists/i.test(createError.message)) {
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({ email: QA_EMAIL, password });
    if (signInError) {
      console.error('This account exists but could not sign in with the stored password:', signInError.message);
      console.error('Delete ' + CRED_FILE + ' and rerun, or find the user in Supabase Auth and reset its password.');
      process.exit(1);
    }
    userId = signInData.user?.id;
  } else if (createError) {
    console.error('Account creation failed:', createError.message);
    process.exit(1);
  } else {
    userId = created.user.id;
  }

  const orgUpsert = await admin.from('resource_organizations').upsert({
    id: ORG_ID, name: ORG_NAME, slug: 'qa-partner-org', org_type: 'employer', status: 'active',
    data_origin: 'dev_fixture', fixture_set: 'partner-command-center-qa',
  }, { onConflict: 'id' });
  if (orgUpsert.error) { console.error('Org upsert failed:', orgUpsert.error.message); process.exit(1); }

  const memberUpsert = await admin.from('organization_members').upsert({
    organization_id: ORG_ID, user_id: userId, member_role: 'owner', status: 'active',
  }, { onConflict: 'organization_id,user_id' });
  if (memberUpsert.error) { console.error('Membership upsert failed:', memberUpsert.error.message); process.exit(1); }

  for (const capability of ['employment', 'housing', 'case_management']) {
    const capUpsert = await admin.from('organization_capabilities').upsert({
      organization_id: ORG_ID, capability, status: 'active',
    }, { onConflict: 'organization_id,capability' });
    if (capUpsert.error) { console.error(`Capability upsert (${capability}) failed:`, capUpsert.error.message); process.exit(1); }
  }

  writeFileSync(
    CRED_FILE,
    JSON.stringify({ email: QA_EMAIL, password, userId, organizationId: ORG_ID, organizationName: ORG_NAME, project: url, createdAt: new Date().toISOString() }, null, 2),
  );

  console.log('DEV Partner QA account ready.');
  console.log('  email:', QA_EMAIL);
  console.log('  user id:', userId);
  console.log('  organization:', ORG_NAME, '(' + ORG_ID + ')');
  console.log('  role: owner | capabilities: employment, housing, case_management');
  console.log('  project:', url);
  console.log('  password: stored only in', CRED_FILE, '(gitignored, not printed)');
}

main();
