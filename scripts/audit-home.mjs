// Home tab production invariants (Tasks 031–038). `npm run test:home`
import fs from 'node:fs';

const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const home = read('src/app/home.tsx');
const pers = read('src/core/profile/home-personalization.ts');
const summary = read('src/core/profile/member-summary.ts');
const status = read('src/components/HomeStatus.tsx');

check(/HomeStatus/.test(home), 'Home must render HomeStatus.');
check(/loadHomePersonalization/.test(home) && /homeQuickLinks/.test(home) && /homeFocusLine/.test(home), 'Home must use goal-based personalization helpers.');
check(/greetingName/.test(home) && /HELLO,/.test(home), 'Home must greet signed-in members by first name when available.');
check(/loadMemberSummary/.test(home) && /jobAppCount/.test(home) && /savedJobCount/.test(home), 'Home must show application/saved counts from member summary.');
check(/memberStrip/.test(home) && /\/job-applications/.test(home) && /\/saved-jobs/.test(home) && /\/my-path/.test(home), 'Home must link to applications, saved jobs, and My Path.');
check(/jobsState==='loading'/.test(home) && /jobsState==='error'/.test(home) && /jobsState==='ready'/.test(home), 'Featured jobs need loading, error, and empty states.');
check(/setReloadKey/.test(home), 'Home job error state must offer retry.');
check(/loadJobs\(/.test(home), 'Featured jobs must load through jobs service (not fake fixtures).');
check(!/DEMO_|lorem|placeholder card/i.test(home), 'Home must not ship demo placeholder content.');
check(/loadFairPathReadiness/.test(home) && /complete-profile/.test(home), 'Readiness panel must link to complete-profile.');
check(/fairpath-ai/.test(home) && /SIGNAL_TAGLINE/.test(home), 'Signal panel must use shared member-facing copy.');
check(/experienceSummary/.test(home) && /opportunity-profile\/contact/.test(home), 'Signal CTA nudges contact when experience summary is missing.');

check(/GOAL_ROUTES/.test(pers) && /homeQuickLinks/.test(pers), 'Personalization must map onboarding goals to routes.');
check(/get_member_home_summary/.test(summary), 'Member summary must come from server RPC.');

check(fs.existsSync('src/components/HomeStatus.tsx'), 'HomeStatus component must exist.');
check(!/fetch\(|anthropic|openai/i.test(status + home), 'Home must not call AI providers directly.');

if (failures.length) {
  console.error('Home audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Home audit passed: personalization, counts, featured jobs states, Signal/readiness panels.');
