// Runs every offline check: TypeScript, all audits, the Node test suites and the local-Postgres SQL suites.
//   npm run test:all
// Nothing here touches Supabase (no network, no keys). DEV harnesses (qa:*) are run separately from Sterling's terminal.
import { spawnSync } from 'node:child_process';

const NODE = process.execPath;
const steps = [
  ['TypeScript', 'npx', ['tsc', '--noEmit']],
  ...['baseline', 'canonical-profile', 'seed', 'navigation', 'housing', 'marketplace', 'jobs', 'home', 'explore', 'my-path', 'keyboard', 'dates', 'notifications', 'auth', 'auth-boundaries', 'onboarding', 'signal-deploy', 'payments', 'entitlements',
    'theme', 'resources', 'community', 'opportunity', 'education', 'profile', 'profile-a11y', 'member', 'member-capabilities', 'credit', 'relief', 'ai', 'security', 'notification-events', 'observability', 'failure-states'].map((n) => [`audit: ${n}`, NODE, [`scripts/audit-${n}.mjs`]]),
  ['audit: scroll', NODE, ['scripts/audit-scroll.mjs']],
  ['documents render', NODE, ['scripts/test-documents-render.mjs']],
  ['credit studio workspace', NODE, ['--test', '--experimental-strip-types', 'tests/credit-studio-workspace.test.ts']],
  ['housing application validation', NODE, ['--test', '--experimental-strip-types', 'tests/housing-application-form.test.ts']],
  ['intro screen layout', NODE, ['--test', '--experimental-strip-types', 'tests/intro-screen-layout.test.ts']],
  ['registration draft persistence', NODE, ['--test', '--experimental-strip-types', 'tests/registration-draft.test.ts']],
  ['legal review session', NODE, ['--test', '--experimental-strip-types', 'tests/legal-review-session.test.ts']],
  ['consent client contract', NODE, ['--test', '--experimental-strip-types', 'tests/consent-client-contract.test.ts']],
  ['justice unified model', NODE, ['--test', '--experimental-strip-types', 'tests/justice-unified-model.test.ts']],
  ['job conviction match contract', NODE, ['--test', '--experimental-strip-types', 'tests/job-conviction-match.test.ts']],
  ['justice contract parity', NODE, ['scripts/audit-justice-contract.mjs']],
  ['proposed justice schema static', NODE, ['scripts/test-proposed-justice-schema.mjs']],
  ['SQL: canonical justice reconciliation', NODE, ['scripts/test-local-justice-canonical.mjs']],
  ['multi-charge mixed disposition', NODE, ['--test', '--experimental-strip-types', 'tests/multi-charge-mixed-disposition.test.ts']],
  ['professional profile preview model', NODE, ['--test', '--experimental-strip-types', 'tests/professional-profile-model.test.ts']],
  ['job profile fit hints', NODE, ['--test', '--experimental-strip-types', 'tests/job-profile-fit.test.ts']],
  ['application share preview', NODE, ['--test', '--experimental-strip-types', 'tests/application-share-preview.test.ts']],
  ['professional profile layout contract', NODE, ['--test', '--experimental-strip-types', 'tests/professional-profile-layout.test.ts']],
  ['community smart help', NODE, ['--test', '--experimental-strip-types', 'tests/community-smart-help.test.ts']],
  ['community privacy boundaries', NODE, ['--test', '--experimental-strip-types', 'tests/community-privacy.test.ts']],
  ['community status copy', NODE, ['--test', '--experimental-strip-types', 'tests/community-status-copy.test.ts']],
  ['screen scroll contract', NODE, ['--test', '--experimental-strip-types', 'tests/screen-scroll-contract.test.ts']],
  ['signal UI contract', NODE, ['--test', '--experimental-strip-types', 'tests/signal-ui-contract.test.ts']],
  ['signal orchestrator', NODE, ['--test', '--experimental-strip-types', 'tests/signal-orchestrator.test.ts']],
  ['signal eval suite', NODE, ['--test', '--experimental-strip-types', 'tests/signal-eval.test.ts']],
  ['member capabilities', NODE, ['--test', '--experimental-strip-types', 'tests/member-capabilities.test.ts']],
  ['member capabilities matrix', NODE, ['--test', '--experimental-strip-types', 'tests/member-capabilities-matrix.test.ts']],
  ['opportunity intent parser', NODE, ['--test', '--experimental-strip-types', 'tests/opportunity-intent-parser.test.ts']],
  ['opportunity orchestrator helpers', NODE, ['--test', '--experimental-strip-types', 'tests/opportunity-orchestrator.test.ts']],
  ['V1 opportunity pathways', NODE, ['--test', '--experimental-strip-types', 'tests/v1-pathways.test.ts']],
  ['V1 pathway connections audit', NODE, ['scripts/audit-v1-pathways.mjs']],
  ['opportunity alert prefs', NODE, ['--test', '--experimental-strip-types', 'tests/opportunity-alert-prefs.test.ts']],
  ['client user_id checks', NODE, ['scripts/test-client-user-id.mjs']],
  ['resource availability contract', NODE, ['scripts/test-resource-availability-contract.mjs']],
  ['QA harness column checks', NODE, ['scripts/test-qa-harness-columns.mjs']],
  ['credit extraction boundary', NODE, ['scripts/test-credit-extraction.mjs']],
  ['audit: credit-member', NODE, ['scripts/audit-credit-member.mjs']],
  ['render-document handler', NODE, ['scripts/test-render-handler.mjs']],
  ['SQL: all migrations apply', NODE, ['scripts/local-sql-check.mjs']],
  ['SQL: resources', NODE, ['scripts/test-local-resources.mjs']],
  ['SQL: opportunity profile', NODE, ['scripts/test-local-profile.mjs']],
  ['SQL: documents', NODE, ['scripts/test-local-documents.mjs']],
  ['SQL: document consent', NODE, ['scripts/test-local-document-consent.mjs']],
  ['SQL: housing document gate', NODE, ['scripts/test-local-housing-documents.mjs']],
  ['SQL: notification delivery', NODE, ['scripts/test-local-notification-delivery.mjs']],
  ['notification worker mocks', NODE, ['scripts/test-notification-worker.mjs']],
  ['notification receipt mocks', NODE, ['scripts/test-notification-receipt-worker.mjs']],
  ['SQL: jobs end to end', NODE, ['scripts/test-local-jobs-e2e.mjs']],
  ['SQL: placement evidence security', NODE, ['scripts/test-local-placement-security.mjs']],
  ['SQL: member summary + privacy', NODE, ['scripts/test-local-member.mjs']],
  ['SQL: credit', NODE, ['scripts/test-local-credit.mjs']],
  ['SQL: record relief', NODE, ['scripts/test-local-relief.mjs']],
  ['SQL: record relief fixtures', NODE, ['scripts/test-relief-fixtures.mjs']],
  ['SQL: AI provenance + reminders', NODE, ['scripts/test-local-ai-reminders.mjs']],
  ['SQL: resume studio', NODE, ['scripts/test-local-resume.mjs']],
  ['SQL: meetings', NODE, ['scripts/test-local-meetings.mjs']],
  ['SQL: org ownership', NODE, ['scripts/test-local-org-ownership.mjs']],
  ['SQL: marketplace', NODE, ['scripts/test-local-marketplace.mjs']],
  ['SQL: community help (draft)', NODE, ['scripts/test-local-community-help.mjs']],
  ['SQL: member resource referral (draft)', NODE, ['scripts/test-local-member-referral.mjs']],
  ['SQL: record relief importer', NODE, ['scripts/test-local-relief-importer.mjs']],
  ['SQL: cross-member isolation', NODE, ['scripts/test-local-cross-member-isolation.mjs']],
  ['SQL: legal source monitoring', NODE, ['scripts/test-local-legal-monitoring.mjs']],
  ['SQL: federal candidate import', NODE, ['scripts/test-local-federal-candidate-import.mjs']],
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
