// Creates (or reuses) a DEV-only QA auth account using the same public sign-up the app's "Create account" button uses
// (anon key, auth.signUp). Never touches production: src/lib/supabase.ts already refuses to run a dev build without
// EXPO_PUBLIC_SUPABASE_URL pointed at the dev project. The password is generated here and written only to a local,
// gitignored file (.dev-qa-credentials.local.json). It is never printed to stdout, logged, or returned to the caller.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { config } from 'node:process';

const CRED_FILE = '.dev-qa-credentials.local.json';
const QA_EMAIL = process.env.QA_EMAIL || 'mobile.qa+automated@fairpath.test';

function loadEnvLocal() {
  try {
    const raw = readFileSync('.env.local', 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnvLocal();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}
if (url.includes('rqpczemdagoddhuwefxt')) {
  console.error('Refusing to run: this would target the PRODUCTION project. Aborting.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function genPassword() {
  return randomBytes(24).toString('base64').replace(/[+/=]/g, 'x') + 'Aa1!';
}

async function main() {
  let password;
  if (existsSync(CRED_FILE)) {
    const existing = JSON.parse(readFileSync(CRED_FILE, 'utf8'));
    if (existing.email === QA_EMAIL) password = existing.password;
  }
  if (!password) password = genPassword();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email: QA_EMAIL, password });

  // Already exists is fine — we reuse the stored password and try signing in instead.
  let session = signUpData?.session ?? null;
  let userId = signUpData?.user?.id ?? null;

  if (signUpError && !/already registered|already exists/i.test(signUpError.message)) {
    console.error('Sign-up failed:', signUpError.message);
    process.exit(1);
  }

  if (!session) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: QA_EMAIL, password });
    if (signInError) {
      console.error('This QA account exists but could not sign in with the stored password:', signInError.message);
      console.error('Delete .dev-qa-credentials.local.json and rerun to issue a fresh password, or confirm the account by email if confirmation is required.');
      process.exit(1);
    }
    session = signInData.session;
    userId = signInData.user?.id ?? userId;
  }

  writeFileSync(
    CRED_FILE,
    JSON.stringify({ email: QA_EMAIL, password, userId, project: url, createdAt: new Date().toISOString() }, null, 2),
  );

  console.log('DEV QA account ready.');
  console.log('  email:', QA_EMAIL);
  console.log('  user id:', userId);
  console.log('  project:', url);
  console.log('  session acquired:', Boolean(session));
  console.log('  password: stored only in', CRED_FILE, '(gitignored, not printed)');
}

main();
