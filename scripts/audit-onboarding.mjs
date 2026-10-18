// Five-step onboarding funnel invariants. `npm run test:onboarding`
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};

const onboarding = read('src/app/onboarding.tsx');
const postAuth = read('src/core/auth/post-auth-route.ts');
const layout = read('src/app/_layout.tsx');

check(/const steps: Step\[\] = \[[\s\S]*?\];/.test(onboarding) && (onboarding.match(/eyebrow:/g) ?? []).length >= 5, 'Onboarding must define five steps.');
check(/onboarding_completed: true/.test(onboarding) && /finishOnboarding/.test(onboarding), 'Completing the last step must set onboarding_completed.');
check(/async function finishLater/.test(onboarding) && /persistProfile\(false\)/.test(onboarding), 'Finish later must save partial progress without marking onboarding complete.');
check(/finishLater[\s\S]*router\.replace\('\/find-jobs'\)/.test(onboarding), 'Finish later must return to public job browse (private /home would force onboarding again).');
check(/buildProfilePayload/.test(onboarding) && /experience_summary/.test(onboarding), 'Location step may capture experience_summary for Signal.');
check(/!profile\?\.onboarding_completed/.test(postAuth), 'Post-auth routing must send incomplete members to /onboarding.');
check(/pathname==='\/onboarding'/.test(layout) && /PUBLIC_BROWSE\(pathname\)/.test(layout), 'Root layout must allow browse routes while onboarding is incomplete.');
check(/Reentry & record relief/.test(onboarding) && /Veteran transition/.test(onboarding), 'Onboarding must offer reentry and veteran tool choices without employer labeling.');
check(/justice_impacted:/.test(onboarding) && /experience_summary/.test(onboarding), 'Profile payload must map tools to justice_impacted and optional experience_summary.');
check(/Finish later — browse jobs and housing first/.test(onboarding), 'Finish later affordance must be visible on early steps.');
check(/FormScrollView/.test(onboarding) && /progress/.test(onboarding), 'Onboarding must scroll safely with keyboard and show step progress.');
check(/router\.replace\('\/home'\)/.test(onboarding), 'Completing onboarding must land on Home.');

if (failures.length) {
  console.error('Onboarding audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Onboarding audit passed: five steps, finish-later partial save, post-auth resume.');
