// Profile hub + baseline a11y wiring. Deep forms: test:profile; theme contrast: test:theme; keyboard: test:keyboard.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};

const me = read('src/app/me.tsx');
const appearance = read('src/app/appearance.tsx');
const location = read('src/app/location-setup.tsx');
const opp = read('src/app/opportunity-profile/index.tsx');

check(/loadMemberSummary/.test(me) && /\/opportunity-profile/.test(me), '/me must use server summary and link Opportunity Profile.');
check(/\/appearance'/.test(me) && /\/notifications'/.test(me), '/me must link appearance and notifications inbox.');
check(/accessibilityRole="button"/.test(me) && /accessibilityLabel=/.test(me), '/me hub tiles must expose button labels.');

check(/accessibilityRole="radio"/.test(appearance) && /setMode/.test(appearance), 'Appearance must use radio semantics for theme mode.');
check(/still being updated and stay dark/.test(appearance), 'Appearance must be honest about partial light-mode migration.');

check(/FormScrollView/.test(location) && /search_radius|location/i.test(location), 'Location setup must be keyboard-safe and capture location/radius.');
check(/nextProfileStep/.test(opp) && /SECTION_ROUTES/.test(opp), 'Opportunity Profile hub must use server sections and next-step routing.');

if (failures.length) {
  console.error('Profile/a11y audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Profile/a11y audit passed: /me hub, appearance radios, location setup, honest theme migration note.');
