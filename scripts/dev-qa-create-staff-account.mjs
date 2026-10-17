// Creates (or reuses) a DEV-only synthetic FairPath Admin staff test account (super_admin role), so the Admin
// app can be logged into and click-tested live. Same safe pattern as the Partner QA account scripts:
// admin.createUser (no real email sent), DEV-only, service-role used only for the staff_users row.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

const CRED_FILE = '.dev-qa-staff-credentials.local.json';
const QA_EMAIL = process.env.STAFF_QA_EMAIL || 'fairpath.qa.staff.a@example.com';

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

  const staffUpsert = await admin.from('staff_users').upsert({
    user_id: userId, role: 'super_admin', status: 'active', display_name: '[TEST] QA Staff Account',
  }, { onConflict: 'user_id' });
  if (staffUpsert.error) { console.error('staff_users upsert failed:', staffUpsert.error.message); process.exit(1); }

  writeFileSync(CRED_FILE, JSON.stringify({ email: QA_EMAIL, password, userId, role: 'super_admin', project: url, createdAt: new Date().toISOString() }, null, 2));
  console.log('DEV Admin staff QA account ready.');
  console.log('  email:', QA_EMAIL);
  console.log('  role: super_admin');
}
main();
