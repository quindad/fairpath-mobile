/**
 * Read-only: check whether documented DEV QA personas exist in Supabase Auth.
 * Never prints secrets. Service role: process.env first, then .env.local (probe only).
 *
 *   node scripts/probe-dev-auth-personas.mjs
 */
import { createClient } from '@supabase/supabase-js';
import {
  DEV_QA_MEMBER_A_EMAIL,
  DEV_QA_MEMBER_B_EMAIL,
} from './lib/dev-qa-accounts.mjs';
import { loadEnvLocal, DEV_PROJECT_REF } from './lib/dev-qa-run.mjs';
import { projectRefFromUrl } from '../supabase/seed/lib/guards.mjs';

const TARGETS = [DEV_QA_MEMBER_A_EMAIL, DEV_QA_MEMBER_B_EMAIL];

const local = loadEnvLocal();
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? local.EXPO_PUBLIC_SUPABASE_URL ?? '';
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || local.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

const ref = projectRefFromUrl(url);
if (ref !== DEV_PROJECT_REF) {
  console.error(`Refusing: Supabase URL must be DEV project ${DEV_PROJECT_REF}.`);
  process.exit(1);
}
if (!serviceKey) {
  console.log(
    JSON.stringify(
      {
        status: 'BLOCKED',
        reason: 'SUPABASE_SERVICE_ROLE_KEY not in process env or .env.local — cannot list Auth users.',
        personas: TARGETS.map((email) => ({ email, authExists: null })),
      },
      null,
      2,
    ),
  );
  process.exit(2);
}
if (serviceKey.startsWith('sb_publishable_')) {
  console.error('Refusing: publishable/anon key cannot be used for Auth admin list.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) {
  console.log(JSON.stringify({ status: 'FAIL', error: error.message?.slice(0, 200) }, null, 2));
  process.exit(1);
}

const users = data?.users ?? [];
const personas = TARGETS.map((email) => {
  const row = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return {
    email,
    authExists: Boolean(row),
    userId: row?.id ?? null,
    emailConfirmed: row?.email_confirmed_at ? true : row ? false : null,
    lastSignInAt: row?.last_sign_in_at ?? null,
  };
});

console.log(
  JSON.stringify(
    {
      status: 'OK',
      projectRef: DEV_PROJECT_REF,
      at: new Date().toISOString(),
      personas,
      credentialsLogged: false,
    },
    null,
    2,
  ),
);
