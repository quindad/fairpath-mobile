#!/usr/bin/env node
/**
 * DEV only: top up documented QA personas to starter AI credit targets (idempotent).
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local or session env.
 *
 *   node scripts/grant-dev-qa-ai-credits.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { DEV_QA_MEMBER_A_EMAIL, DEV_QA_MEMBER_B_EMAIL } from './lib/dev-qa-accounts.mjs';
import { loadEnvLocal, readLinkedRef } from './lib/dev-qa-run.mjs';

const DEV_REF = 'znvhmuhojvwvjzmaqwff';
const TARGETS = [
  { email: DEV_QA_MEMBER_A_EMAIL, floor: 3, target: 10 },
  { email: DEV_QA_MEMBER_B_EMAIL, floor: 15, target: 50 },
];

const env = { ...process.env, ...loadEnvLocal() };
const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const linkedRef = readLinkedRef();

if (!url.includes(DEV_REF) || linkedRef !== DEV_REF) {
  console.error('Refusing: linked DEV project required.');
  process.exit(1);
}
if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY (session or .env.local).');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function userIdForEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) throw new Error(`DEV user not found: ${email}`);
  return u.id;
}

async function readBalance(userId) {
  const { data, error } = await admin.from('ai_credit_balances').select('balance').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.balance ?? 0;
}

async function topUp(userId, delta) {
  if (delta <= 0) return null;
  const { data, error } = await admin.rpc('grant_ai_credits', {
    p_user: userId,
    p_amount: delta,
    p_reason: 'admin_adjustment',
  });
  if (error) throw error;
  return data?.balance ?? null;
}

for (const { email, floor, target } of TARGETS) {
  const userId = await userIdForEmail(email);
  const before = await readBalance(userId);
  if (before >= floor) {
    console.log(`SKIP ${email} balance=${before} (>= floor ${floor})`);
    continue;
  }
  const delta = target - before;
  const after = await topUp(userId, delta);
  console.log(`GRANT ${email} +${delta} -> balance=${after ?? '?'}`);
}

console.log('Done (no passwords logged).');
