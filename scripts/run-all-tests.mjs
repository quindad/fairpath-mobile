// Runs every offline check: TypeScript, all audits, the Node test suites and the local-Postgres SQL suites.
//   npm run test:all
// Nothing here touches Supabase (no network, no keys). DEV harnesses (qa:*) are run separately from Sterling's terminal.
import { spawnSync } from 'node:child_process';

const NODE = process.execPath;
const steps = [
  ['TypeScript', 'npx', ['tsc', '--noEmit']],
  ...['baseline', 'canonical-profile', 'seed', 'navigation', 'housing', 'marketplace', 'jobs', 'keyboard', 'dates', 'notifications', 'auth', 'payments', 'entitlements',
    'theme', 'resources', 'profile', 'member', 'credit', 'relief', 'ai', 'security', 'notification-events', 'observability', 'failure-states'].map((n) => [`audit: ${n}`, NODE, [`scripts/audit-${n}.mjs`]]),
  ['documents render', NODE, ['scripts/test-documents-render.mjs']],
  ['client user_id checks', NODE, ['scripts/test-client-user-id.mjs']],
  ['resource availability contract', NODE, ['scripts/test-resource-availability-contract.mjs']],
  ['QA harness column checks', NODE, ['scripts/test-qa-harness-columns.mjs']],
  ['credit extraction boundary', NODE, ['scripts/test-credit-extraction.mjs']],
  ['render-document handler', NODE, ['scripts/test-render-handler.mjs']],
  ['SQL: all migrations apply', NODE, ['scripts/local-sql-check.mjs']],
  ['SQL: resources', NODE, ['scripts/test-local-resources.mjs']],
  ['SQL: opportunity profile', NODE, ['scripts/test-local-profile.mjs']],
  ['SQL: documents', NODE, ['scripts/test-local-documents.mjs']],
  ['SQL: member summary + privacy', NODE, ['scripts/test-local-member.mjs']],
  ['SQL: credit', NODE, ['scripts/test-local-credit.mjs']],
  ['SQL: record relief', NODE, ['scripts/test-local-relief.mjs']],
  ['SQL: record relief fixtures', NODE, ['scripts/test-relief-fixtures.mjs']],
  ['SQL: AI provenance + reminders', NODE, ['scripts/test-local-ai-reminders.mjs']],
  ['SQL: resume studio', NODE, ['scripts/test-local-resume.mjs']],
  ['SQL: meetings', NODE, ['scripts/test-local-meetings.mjs']],
  ['SQL: org ownership', NODE, ['scripts/test-local-org-ownership.mjs']],
  ['SQL: marketplace', NODE, ['scripts/test-local-marketplace.mjs']],
  ['SQL: coverage markets', NODE, ['scripts/test-local-coverage.mjs']],
];

const only = process.argv[2];
let failed = 0;
const rows = [];
for (const [name, cmd, args] of steps) {
  if (only && !name.toLowerCase().includes(only.toLowerCase())) continue;
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: cmd === 'npx', timeout: 600000 });
  const ok = r.status === 0;
  const out = (r.stdout + r.stderr).split('\n').filter((l) => l.trim() && !/MODULE_TYPELESS|Reparsing|To eliminate|--trace-warnings|^\(Use/.test(l));
  const last = out.filter((l) => /passed|PASS|failed|FAIL|error|Error/.test(l)).slice(-1)[0] ?? out.slice(-1)[0] ?? '';
  rows.push({ name, ok, secs: ((Date.now() - t0) / 1000).toFixed(1), last: last.slice(0, 130) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(34)} ${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s  ${ok ? '' : last.slice(0, 160)}`);
  if (!ok) { failed++; console.log(out.slice(-12).map((l) => '      ' + l.slice(0, 200)).join('\n')); }
}
console.log(`\n${rows.length - failed}/${rows.length} checks passed.`);
process.exit(failed ? 1 : 0);
