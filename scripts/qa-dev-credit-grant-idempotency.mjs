#!/usr/bin/env node
/** DEV: assert QA credit top-up is idempotent and balances reflect real spend (read-only + one grant script dry run). */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { DEV_QA_MEMBER_A_EMAIL } from './lib/dev-qa-accounts.mjs';
import { loadEnvLocal, readLinkedRef } from './lib/dev-qa-run.mjs';

const DEV_REF = 'znvhmuhojvwvjzmaqwff';
const env = loadEnvLocal();
if (!env.EXPO_PUBLIC_SUPABASE_URL?.includes(DEV_REF) || readLinkedRef() !== DEV_REF) {
  console.error('REFUSING: linked DEV only');
  process.exit(1);
}

function queryBalances() {
  const r = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '-f', 'scripts/dev-query-qa-credit-balances.sql'], {
    encoding: 'utf8',
    shell: true,
  });
  const out = `${r.stdout}\n${r.stderr}`.replace(/^Initialising login role\.\.\.\s*/m, '').trim();
  const start = out.indexOf('{');
  if (start < 0) throw new Error('balance query failed');
  const end = out.lastIndexOf('}');
  const parsed = JSON.parse(out.slice(start, end + 1));
  const rows = parsed.rows ?? [];
  return Object.fromEntries(rows.map((row) => [row.email, row.balance]));
}

const before = queryBalances();
const r2 = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '-f', 'scripts/dev-grant-qa-ai-credits.sql'], {
  encoding: 'utf8',
  shell: true,
});
if (r2.status !== 0) {
  console.error(r2.stderr || r2.stdout);
  process.exit(1);
}
const after = queryBalances();

let ok = true;
for (const email of [DEV_QA_MEMBER_A_EMAIL, 'dev-plus2@fairpath.test']) {
  if (before[email] !== after[email]) {
    console.error(`FAIL idempotency: ${email} ${before[email]} -> ${after[email]}`);
    ok = false;
  } else {
    console.log(`PASS idempotency ${email} balance=${after[email]}`);
  }
}

const freeBal = after[DEV_QA_MEMBER_A_EMAIL];
if (typeof freeBal !== 'number' || freeBal < 0 || freeBal > 10) {
  console.error(`FAIL dev-free1 balance out of expected range after QA spend: ${freeBal}`);
  ok = false;
} else {
  console.log(`PASS dev-free1 balance in sane QA range (0–10): ${freeBal}`);
}

fs.writeFileSync(
  'qa-dev-credit-idempotency-results.json',
  JSON.stringify({ at: new Date().toISOString(), before, after, ok }, null, 2),
);
process.exit(ok ? 0 : 1);
