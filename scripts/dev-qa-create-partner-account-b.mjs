// Second synthetic Partner Command Center test account, for a DIFFERENT organization than
// scripts/dev-qa-create-partner-account.mjs — specifically to prove org-to-org isolation live (Org A cannot
// see Org B's caseload/jobs/housing/referrals/campaigns). Same safe pattern: admin.createUser (no real email
// sent), service-role only for org/membership/capability rows. DEV-only, refuses production.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

const CRED_FILE = '.dev-qa-partner-b-credentials.local.json';
const QA_EMAIL = process.env.PARTNER_QA_B_EMAIL || 'fairpath.qa.partner.b@example.com';
const ORG_ID = '99999999-9999-4999-8999-999999999992';
const ORG_NAME = '[TEST] FairPath QA Partner Org B';

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
loadEnvLocal('../fairpath-admin/.env.local');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) { console.error('Missing Supabase config'); process.exit(1); }
if (url.includes('rqpczemdagoddhuwefxt')) { console.error('Refusing: production project.'); process.exit(1); }

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

  let userId;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email: QA_EMAIL, password, email_confirm: true });
  if (createError && /already been registered|already exists/i.test(createError.message)) {
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({ email: QA_EMAIL, password });
    if (signInError) { console.error('Exists but cannot sign in:', signInError.message); process.exit(1); }
    userId = signInData.user?.id;
  } else if (createError) {
    console.error('Account creation failed:', createError.message); process.exit(1);
  } else {
    userId = created.user.id;
  }

  const orgUpsert = await admin.from('resource_organizations').upsert({
    id: ORG_ID, name: ORG_NAME, slug: 'qa-partner-org-b', org_type: 'provider', status: 'active',
    data_origin: 'dev_fixture', fixture_set: 'partner-command-center-qa',
  }, { onConflict: 'id' });
  if (orgUpsert.error) { console.error('Org upsert failed:', orgUpsert.error.message); process.exit(1); }

  const memberUpsert = await admin.from('organization_members').upsert({
    organization_id: ORG_ID, user_id: userId, member_role: 'owner', status: 'active',
  }, { onConflict: 'organization_id,user_id' });
  if (memberUpsert.error) { console.error('Membership upsert failed:', memberUpsert.error.message); process.exit(1); }

  for (const capability of ['employment', 'housing', 'case_management']) {
    const capUpsert = await admin.from('organization_capabilities').upsert({ organization_id: ORG_ID, capability, status: 'active' }, { onConflict: 'organization_id,capability' });
    if (capUpsert.error) { console.error(`Capability upsert (${capability}) failed:`, capUpsert.error.message); process.exit(1); }
  }

  writeFileSync(CRED_FILE, JSON.stringify({ email: QA_EMAIL, password, userId, organizationId: ORG_ID, organizationName: ORG_NAME, project: url, createdAt: new Date().toISOString() }, null, 2));
  console.log('DEV Partner QA account B ready.');
  console.log('  email:', QA_EMAIL);
  console.log('  organization:', ORG_NAME, '(' + ORG_ID + ')');
}
main();
