// Date + back-control audit: one shared date system, one back control.
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk('src').filter((f) => /\.tsx?$/.test(f)).map((f) => f.replace(/\\/g, '/'));
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

// ---- executable rules ----
const d = await import('../src/core/forms/dates.ts');
const now = new Date(2026, 8, 28); // 2026-09-28
const ok = (t, k) => d.isValidDateForKind(t, k, now);
// DOB: any past year is directly selectable, future is blocked
check(ok('01/05/1961', 'dob'), 'DOB in 1961 must be valid.');
check(!ok('09/29/2026', 'dob'), 'A future DOB must be rejected.');
check(ok('09/28/2026', 'dob'), "Today is a valid DOB boundary.");
check(!ok('12/31/1899', 'dob'), 'DOB before 1900 must be rejected.');
check(!ok('02/30/2000', 'dob'), 'Impossible dates (02/30) must be rejected.');
check(!ok('1/5/1990', 'dob'), 'Only zero-padded MM/DD/YYYY is accepted.');
// future-only fields
check(!ok('09/27/2026', 'future'), 'A past move-in/tour date must be rejected.');
check(ok('09/28/2026', 'future') && ok('01/01/2030', 'future'), 'Today and later dates must be valid for future fields.');
check(!ok('01/01/2040', 'future'), 'Future fields are limited to 10 years out.');
// past fields (conviction/release dates)
check(ok('03/03/2015', 'past') && !ok('01/01/2030', 'past'), 'Past fields must reject future dates.');
// year list: DOB shows newest first and spans the full range; future starts at this year
const dobYears = d.yearsFor(d.boundsForKind('dob', now), 'dob');
check(dobYears[0] === 2026 && dobYears[dobYears.length - 1] === 1900 && dobYears.length === 127, 'DOB year list must span 2026..1900 (choose a year directly).');
const futureYears = d.yearsFor(d.boundsForKind('future', now), 'future');
check(futureYears[0] === 2026 && futureYears[futureYears.length - 1] === 2036, 'Future year list must be 2026..2036.');
// month limits inside the boundary years
check(d.monthsAllowed(2026, d.boundsForKind('dob', now)).join() === '0,1,2,3,4,5,6,7,8', 'DOB months in the current year must stop at the current month.');
check(d.monthsAllowed(2026, d.boundsForKind('future', now)).join() === '8,9,10,11', 'Future months in the current year must start at the current month.');
check(d.defaultYearFor('dob', d.boundsForKind('dob', now), now) === 1996, 'DOB picker should open near a plausible birth year, not the current year.');

// ---- component wiring ----
const picker = read('src/components/FairPathDatePicker.tsx');
check(/'year'/.test(picker) && /'month'/.test(picker) && /'day'/.test(picker) && /chooseYear/.test(picker), 'The picker must let users choose year, month and day directly.');
check(!/setMonth\(.*-\s*1\)|chevron-left.*Month|prevMonth|nextMonth/.test(picker), 'The picker must not rely on month-by-month arrow stepping.');
check(/boundsForKind/.test(picker) && /isDateWithin/.test(picker), 'The picker must enforce bounds through the shared date rules.');
// The year list must open already positioned on the selected year. A programmatic scrollToOffset after layout left the
// list blank (rows never rendered) when editing an existing date of birth.
check(/initialScrollIndex=/.test(picker) && /getItemLayout=/.test(picker) && !/scrollToOffset|scrollToIndex/.test(picker), 'The year list must use initialScrollIndex (with getItemLayout), not a post-layout scroll.');
check(!fs.existsSync('src/components/SimpleDatePicker.tsx'), 'The old month-arrow SimpleDatePicker must stay removed.');

const users = files.filter((f) => f.startsWith('src/app/') && /FairPathDatePicker/.test(read(f)));
for (const need of ['src/app/housing-apply/[id].tsx', 'src/app/housing-tour/[id].tsx', 'src/app/complete-profile.tsx']) check(users.includes(need), `${need} must use the shared FairPathDatePicker.`);
const apply = read('src/app/housing-apply/[id].tsx');
check(/kind="dob"/.test(apply) && /kind="future"/.test(apply), 'Housing apply must use dob for DOB and future for move-in.');
check(/kind="future"/.test(read('src/app/housing-tour/[id].tsx')), 'Tour date must be future-only.');
check(/isValidDateForKind\(form\.date_of_birth,'dob'\)/.test(read('src/core/housing/housing-service.ts')) && /isValidDateForKind\(form\.move_in_date,'future'\)/.test(read('src/core/housing/housing-service.ts')), 'Housing validation must use the shared date rules.');
// no screen re-implements calendar logic or free-text date entry
for (const f of files) {
  if (f === 'src/components/FairPathDatePicker.tsx' || f === 'src/core/forms/dates.ts' || f === 'src/core/forms/formatters.ts') continue;
  const src = read(f);
  if (f.startsWith('src/app/') && /daysInMonth|new Date\([^)]*,\s*[^)]*\+\s*1,\s*0\)|getDay\(\)/.test(src)) failures.push(`${f}: calendar math belongs in core/forms/dates.ts / FairPathDatePicker.`);
  if (f.startsWith('src/app/') && /placeholder="MM\/DD\/YYYY"|placeholder=\{[^}]*MM\/DD\/YYYY/.test(src)) failures.push(`${f}: free-text date entry; use FairPathDatePicker.`);
}

// ---- back control ----
const chrome = read('src/components/ProductChrome.tsx');
check(/export function FairBackButton/.test(chrome) && /<FairBackButton onPress=\{goBack\}\/>/.test(chrome), 'PageHeader must use the shared FairBackButton.');
check(/accessibilityLabel=\{label\}/.test(chrome) && /hitSlop/.test(chrome), 'FairBackButton needs an accessibility label and an enlarged tap target.');
check(!/borderRadius:\s*(1[4-9]|[2-9]\d)/.test((chrome.match(/back:\{[^}]*\}/) || [''])[0]), 'The back button must not be a big rounded pill.');
for (const f of ['src/app/sign-in.tsx', 'src/app/sign-up.tsx', 'src/app/forgot-password.tsx', 'src/app/onboarding.tsx', 'src/app/complete-profile.tsx']) {
  const src = read(f);
  check(/<FairBackButton/.test(src), `${f} must use FairBackButton.`);
  check(!/<Text[^>]*>←<\/Text>/.test(src), `${f} still draws a custom text-arrow back button.`);
}
check(!files.filter((f) => f.startsWith('src/app/')).some((f) => /<Pressable[^>]*>\s*<Text[^>]*>←<\/Text>/.test(read(f))), 'No screen may draw its own arrow back button.');

if (failures.length) {
  console.error('Dates/back-control audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Dates/back-control audit passed: shared year/month/day picker with enforced DOB/past/future rules, no month-arrow stepping, one back control.');
