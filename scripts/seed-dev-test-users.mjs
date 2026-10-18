/**
 * DEV only: create two test auth users + grant AI credits via service role.
 * Requires in .env.local (gitignored):
 *   EXPO_PUBLIC_SUPABASE_URL=https://znvhmuhojvwvjzmaqwff.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEV_REF = 'znvhmuhojvwvjzmaqwff';

function loadEnvLocal() {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

const env = { ...process.env, ...loadEnvLocal() };
const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url.includes(DEV_REF)) {
  console.error(`Refusing: EXPO_PUBLIC_SUPABASE_URL must contain DEV ref ${DEV_REF}`);
  process.exit(1);
}
if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const USERS = [
  { email: 'dev-free@fairpath.test', password: 'FairPath-Dev-Free-2026!', credits: 10 },
  { email: 'dev-plus@fairpath.test', password: 'FairPath-Dev-Plus-2026!', credits: 50 },
];

async function ensureUser(email, password) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function grant(userId, amount) {
  const { error } = await admin.rpc('grant_ai_credits', { p_user: userId, p_amount: amount, p_reason: 'admin_adjustment' });
  if (error) throw error;
}

console.log('Seeding DEV test users on', url);
for (const u of USERS) {
  const id = await ensureUser(u.email, u.password);
  await grant(id, u.credits);
  console.log('OK', u.email, id, `+${u.credits} credits`);
}
console.log('\nPasswords printed once here — store in your vault, then change if you prefer:');
for (const u of USERS) console.log(`  ${u.email}  →  ${u.password}`);
