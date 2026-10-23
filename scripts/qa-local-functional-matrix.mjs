// Aggregates local-only functional QA (no network, no DEV mutations). Writes qa-local-functional-matrix-results.json
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const NODE = process.execPath;
const steps = [
  ['member capabilities static', NODE, ['scripts/qa-dev-member-capabilities-matrix.mjs']],
  ['jobs housing static', NODE, ['scripts/qa-dev-jobs-housing-smoke.mjs']],
  ['signal static', NODE, ['scripts/qa-dev-signal-smoke.mjs']],
  ['community help SQL', NODE, ['scripts/test-local-community-help.mjs']],
  ['record relief SQL', NODE, ['scripts/test-local-relief.mjs']],
  ['opportunity audit', NODE, ['scripts/audit-opportunity.mjs']],
  ['v1 pathways unit', NODE, ['--test', '--experimental-strip-types', 'tests/v1-pathways.test.ts']],
  ['registration flow unit', NODE, ['--test', '--experimental-strip-types', 'tests/registration-flow.test.ts']],
  ['consent contract', NODE, ['--test', '--experimental-strip-types', 'tests/consent-client-contract.test.ts']],
];

const results = [];
let failed = 0;
for (const [name, cmd, args] of steps) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const ok = r.status === 0;
  if (!ok) failed++;
  const tail = (r.stdout + r.stderr).trim().split('\n').slice(-2).join(' | ');
  results.push({ name, ok, exit: r.status, tail });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (tail ? ' — ' + tail.slice(0, 120) : ''));
}

const summary = {
  generatedAt: new Date().toISOString(),
  branch: 'development/mobile-v1-completion',
  passed: results.filter((x) => x.ok).length,
  total: results.length,
  results,
};
fs.writeFileSync('qa-local-functional-matrix-results.json', JSON.stringify(summary, null, 2));
console.log(`\n${summary.passed}/${summary.total} local functional checks passed.`);
process.exit(failed ? 1 : 0);
