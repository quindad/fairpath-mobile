// Post-apply smoke for Community Exchange on SHARED DEV only.
// Does NOT apply migrations. Uses the same RPC contract as the mobile client.
// Usage:
//   node scripts/qa-dev-community-exchange-post-apply.mjs
// Optional: QA_MEMBER_EMAIL / QA_MEMBER_PASSWORD, or uses disposable users with service role + --confirm-dev
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { assertDevTarget } from '../supabase/seed/lib/guards.mjs';

const args = new Set(process.argv.slice(2));
const env = fs.existsSync('.env.local')
  ? Object.fromEntries(
      fs.readFileSync('.env.local', 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  : {};

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const linkedRef = fs.existsSync('supabase/.temp/project-ref') ? fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim() : '';

function missingRpc(error) {
  const msg = (error?.message ?? '').toLowerCase();
  return error?.code === 'PGRST202' || msg.includes('could not find the function');
}

function expiresInDays(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

const steps = [];
async function step(name, fn) {
  try {
    await fn();
    steps.push([name, true]);
    console.log('PASS', name);
  } catch (e) {
    steps.push([name, false]);
    console.log('FAIL', name, e.message);
  }
}

if (!url || !anonKey) {
  console.error('Missing Supabase URL / anon key (.env.local or env).');
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
let client;

if (process.env.QA_MEMBER_EMAIL && process.env.QA_MEMBER_PASSWORD) {
  client = createClient(url, anonKey, opts);
  const { error: signErr } = await client.auth.signInWithPassword({
    email: process.env.QA_MEMBER_EMAIL,
    password: process.env.QA_MEMBER_PASSWORD,
  });
  if (signErr) {
    console.error('Sign-in failed:', signErr.message);
    process.exit(1);
  }
} else {
  try {
    assertDevTarget({ url, serviceKey, linkedRef, confirmDev: args.has('--confirm-dev'), apply: true });
  } catch (e) {
    console.error(e.message);
    console.error('Set QA_MEMBER_EMAIL/PASSWORD or run with SUPABASE_SERVICE_ROLE_KEY and --confirm-dev');
    process.exit(1);
  }
  const admin = createClient(url, serviceKey, opts);
  const stamp = Date.now().toString(36);
  const email = `qa-community-smoke-${stamp}@dev-seed.fairpath.test`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, password: `Smoke-${stamp}-Aa1!` });
  if (created.error) {
    console.error('createUser:', created.error.message);
    process.exit(1);
  }
  client = createClient(url, anonKey, opts);
  const sign = await client.auth.signInWithPassword({ email, password: `Smoke-${stamp}-Aa1!` });
  if (sign.error) {
    console.error('signIn:', sign.error.message);
    process.exit(1);
  }
}

const { error: probe } = await client.rpc('list_open_community_help_board', { p_state: null, p_category: null });
if (missingRpc(probe)) {
  console.log('Community Exchange RPCs not present — smoke skipped (not a failure).');
  process.exit(0);
}
if (probe) {
  console.error('Board probe failed:', probe.message);
  process.exit(1);
}

await step('create community help request (mobile contract)', async () => {
  const desc = `QA smoke ${Date.now()}`;
  const { data, error } = await client.rpc('member_create_community_help_request', {
    p_category: 'groceries',
    p_description: desc,
    p_household_size: null,
    p_urgency: 'flexible',
    p_city: 'Cleveland',
    p_state: 'OH',
    p_postal_code: '44113',
    p_pickup_ok: true,
    p_delivery_preferred: false,
    p_expires_at: expiresInDays(3),
  });
  if (error) throw error;
  if (!data?.id) throw new Error('no row returned');
});

await step('list my community requests', async () => {
  const { error } = await client.rpc('list_my_community_help_requests');
  if (error) throw error;
});

await step('list open board', async () => {
  const { error } = await client.rpc('list_open_community_help_board', { p_state: 'OH', p_category: null });
  if (error) throw error;
});

const failed = steps.filter(([, ok]) => !ok).length;
console.log(`\n${steps.length - failed}/${steps.length} post-apply smoke steps passed.`);
process.exit(failed ? 1 : 0);
