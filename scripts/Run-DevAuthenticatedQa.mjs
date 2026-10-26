#!/usr/bin/env node
/**
 * Run all DEV QA scripts that require member passwords (env from Start-DevQaSession.ps1).
 * Never logs secrets. Exits non-zero on first failing script.
 *
 *   . .\scripts\Start-DevQaSession.ps1
 *   node scripts/Run-DevAuthenticatedQa.mjs --confirm-dev --use-documented-dev-accounts
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const needConfirm = args.includes('--confirm-dev');
if (!needConfirm) {
  console.error('Pass --confirm-dev (and --use-documented-dev-accounts for documented test members).');
  process.exit(1);
}

const scripts = [
  'scripts/grant-dev-qa-ai-credits.mjs',
  'scripts/qa-dev-credit-grant-idempotency.mjs',
  'scripts/probe-dev-auth-personas.mjs',
  'scripts/qa-dev-fairpath-ai-gateway.mjs',
  'scripts/qa-dev-my-path-sync.mjs',
  'scripts/qa-dev-signal-smoke.mjs',
  'scripts/qa-dev-jobs-housing-smoke.mjs',
];

for (const script of scripts) {
  console.log('\n=== ' + script + ' ===\n');
  const r = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    console.error('\nSTOP: ' + script + ' exited ' + r.status);
    process.exit(r.status ?? 1);
  }
}
console.log('\nAll authenticated DEV QA scripts passed.');
