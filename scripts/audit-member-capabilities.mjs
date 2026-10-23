// Static contract: canonical capability gates on primary member surfaces.
// `node scripts/audit-member-capabilities.mjs` — wired in npm run test:all
import fs from 'node:fs';

const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const explore = read('src/app/explore.tsx');
const me = read('src/app/me.tsx');
const fairpathAi = read('src/app/fairpath-ai.tsx');
const homeStatus = read('src/components/HomeStatus.tsx');
const justiceRecords = read('src/app/justice-records/index.tsx');
const signalSuggestions = read('src/core/signal/signal-suggestions.ts');

check(/loadMemberCapabilities/.test(explore), 'explore.tsx must load member capabilities');
check(/justiceToolsEnabled/.test(explore) && /veteranToolsEnabled/.test(explore), 'explore.tsx must gate justice and veteran destinations');
check(/record-relief/.test(explore) && /item\.id === 'record-relief'/.test(explore), 'explore.tsx must filter Record Relief by capability');

check(/loadMemberCapabilities/.test(me), 'me.tsx must load member capabilities');
check(/justiceToolsEnabled/.test(me), 'me.tsx must gate justice links (readiness, records, relief)');
check(/filterNextStepsForCapabilities/.test(me), 'me.tsx must filter next steps by capabilities');

check(/loadSignalSuggestions/.test(fairpathAi), 'fairpath-ai.tsx must load Signal suggestions (capability-aware starters)');
check(/loadMemberCapabilities/.test(signalSuggestions), 'signal-suggestions must load member capabilities');
check(/filterNextStepsForCapabilities/.test(signalSuggestions), 'signal-suggestions must filter next-step prompts by capabilities');

check(/loadMemberCapabilities/.test(homeStatus), 'HomeStatus must load member capabilities');
check(/filterNextStepsForCapabilities/.test(homeStatus), 'HomeStatus must filter next steps by capabilities');

check(/JusticeToolsGate/.test(justiceRecords), 'justice-records must wrap content in JusticeToolsGate');
check(!/loadMemberCapabilities/.test(justiceRecords), 'justice-records must rely on JusticeToolsGate, not duplicate loadMemberCapabilities');

const gate = read('src/components/JusticeToolsGate.tsx');
check(/loadMemberCapabilities/.test(gate) && /justiceToolsEnabled/.test(gate), 'JusticeToolsGate must load capabilities and block when justice not opted in');

if (failures.length) {
  console.error('Member capabilities audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Member capabilities audit passed: Explore, Me, Signal, HomeStatus, and justice-records gates wired.');
