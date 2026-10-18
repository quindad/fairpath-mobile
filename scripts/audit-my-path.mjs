// My Path tab invariants (086–091). `npm run test:my-path`
import fs from 'node:fs';

const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const myPath = read('src/app/my-path.tsx');
const nextStep = read('src/core/profile/next-step.ts');

check(/getFocusGuidance/.test(myPath) && /member-focus-guidance/.test(read('src/core/ai/signal.ts')), 'My Path must use Signal focus guidance Edge Function.');
check(/saved on this device|device for now/i.test(myPath), 'My Path must be honest about local-only veteran plan storage.');
check(/PLANNED/.test(myPath), 'Future My Path capabilities must be labeled planned, not shipped.');
check(/returnTo=.*encodeURIComponent\('\/my-path'\)/.test(myPath), 'Signed-out Signal must preserve returnTo.');
check(/nextSteps|primaryNextStep/.test(nextStep), 'Deterministic next-step rules must exist for assistant/home alignment.');
check(/\/academy'|\/my-assignment'|\/veterans\/profile'/.test(myPath), 'My Path must link to Academy, assignment demo, and veteran profile.');

if (failures.length) {
  console.error('My Path audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('My Path audit passed: honest local plan, Signal focus, links to member workflows.');
