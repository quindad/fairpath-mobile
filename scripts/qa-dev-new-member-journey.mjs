// DEV ONLY — proves new-member consent + onboarding profile fields against live DEV (Oct 17 migrations).
// Requires: .env.local (DEV URL + anon), SUPABASE_SERVICE_ROLE_KEY in env, --confirm-dev
//
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<DEV service role>"
//   node scripts/qa-dev-new-member-journey.mjs --confirm-dev
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  assertDevMutatingApply,
  CleanupRegistry,
  createRunId,
  loadEnvLocal,
  readLinkedRef,
} from './lib/dev-qa-run.mjs';
import { maskEmail } from './lib/dev-qa-accounts.mjs';

const args = new Set(process.argv.slice(2));
const runId = createRunId('journey');
const REPORT_PATH = 'qa-dev-new-member-journey-results.json';

const env = loadEnvLocal();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const linkedRef = readLinkedRef();

try {
  assertDevMutatingApply({ url, linkedRef, confirmDev: args.has('--confirm-dev'), serviceKey });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, opts);
const email = `qa-journey-${runId}@dev-seed.fairpath.test`;
let userId = null;

const cleanup = new CleanupRegistry();
cleanup.add('delete disposable journey member', async () => {
  if (!userId) return;
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
});

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log('PASS ' + name);
  } catch (e) {
    results.push({ name, ok: false, error: String(e.message ?? e).slice(0, 500) });
    console.log('FAIL ' + name + '\n     ' + String(e.message ?? e).slice(0, 500));
  }
}
const ok = (c, m) => {
  if (!c) throw new Error(m);
};

try {
  await test('create disposable DEV member', async () => {
    const c = await admin.auth.admin.createUser({ email, email_confirm: true });
    ok(!c.error, c.error?.message ?? 'createUser');
    userId = c.data.user.id;
    ok(userId, 'no user id');
  });

  let client;
  await test('sign in as new member', async () => {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    ok(!link.error, link.error?.message ?? 'generateLink');
    client = createClient(url, anonKey, opts);
    const v = await client.auth.verifyOtp({
      email,
      token: link.data.properties.email_otp,
      type: 'email',
    });
    ok(!v.error, v.error?.message ?? 'verifyOtp');
  });

  await test('record_document_consent updates profile (terms + privacy)', async () => {
    ok(
      (await client.rpc('record_document_consent', { p_event_type: 'terms_accepted', p_document_version: 'v1', p_granted: true })).error === null,
      'terms rpc failed',
    );
    ok(
      (await client.rpc('record_document_consent', { p_event_type: 'privacy_accepted', p_document_version: 'v1', p_granted: true })).error === null,
      'privacy rpc failed',
    );
    const { data, error } = await client
      .from('profiles')
      .select('terms_accepted_at,terms_accepted_version,privacy_accepted_at,privacy_accepted_version,onboarding_completed')
      .eq('id', userId)
      .single();
    ok(!error, error?.message ?? 'profile read');
    ok(data.terms_accepted_at && data.privacy_accepted_at, 'profile pointers missing after Oct 17 RPC');
    ok(data.terms_accepted_version === 'v1' && data.privacy_accepted_version === 'v1', 'wrong versions');
  });

  await test('onboarding profile save including experience_summary', async () => {
    const { error } = await client
      .from('profiles')
      .update({
        goals: ['Work & income'],
        location_text: 'Columbus, OH',
        experience_summary: 'QA journey test summary',
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', userId);
    ok(!error, error?.message ?? 'profile update');
    const { data, error: e2 } = await client.from('profiles').select('experience_summary,onboarding_completed').eq('id', userId).single();
    ok(!e2, e2?.message ?? 're-read');
    ok(data.experience_summary === 'QA journey test summary', 'experience_summary not saved');
    ok(data.onboarding_completed === true, 'onboarding flag not saved');
  });
} finally {
  await cleanup.runAll();
  if (cleanup.failed) {
    for (const err of cleanup.errors) {
      results.push({ name: `cleanup: ${err.label}`, ok: false, error: err.error });
      console.log('FAIL cleanup: ' + err.label + '\n     ' + err.error);
    }
  }
}

const failed = results.filter((r) => !r.ok);
const payload = {
  runId,
  at: new Date().toISOString(),
  member: maskEmail(email),
  userId: userId ?? undefined,
  results,
  cleanupErrors: cleanup.errors,
  credentialsLogged: false,
};
fs.writeFileSync(REPORT_PATH, JSON.stringify(payload, null, 2));

console.log(`\n${results.length - failed.length}/${results.length} DEV journey checks passed. Wrote ${REPORT_PATH}`);
process.exit(failed.length ? 1 : 0);
