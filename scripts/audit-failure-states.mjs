// Regression coverage for the stale-data-under-error bug class already found and fixed (in order) in
// find-jobs/find-housing/resources/marketplace, and now Meetings/Credit/Resume Studio/Documents/Record
// Relief/Home/Me: a failed refetch must never leave the PRIOR successful data rendered as though it belongs to
// the failed request. Each entry names the screen, the state setter that gates its main content render, and the
// exact catch-block fragment that must appear (proving the setter is cleared before/alongside setError).
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const checks = [
  ['src/app/meetings/index.tsx', /catch \(e\) \{[\s\S]{0,200}?setMeetings\(null\)[\s\S]{0,80}?setError\(/],
  ['src/app/credit/index.tsx', /catch \(e\) \{[\s\S]{0,200}?setLoaded\(false\)[\s\S]{0,80}?setError\(/],
  ['src/app/resume-studio/index.tsx', /catch \(e\) \{[\s\S]{0,200}?setResumes\(null\)[\s\S]{0,80}?setError\(/],
  ['src/app/documents/index.tsx', /catch \(e\) \{[\s\S]{0,300}?setItems\(null\)[\s\S]{0,80}?setError\(/],
  ['src/app/record-relief/index.tsx', /catch \(err\) \{[\s\S]{0,200}?setCases\(null\)[\s\S]{0,80}?setError\(/],
  ['src/app/home.tsx', /catch\(\(\)=>\{if\(active\)\{setFeatured\(\[\]\);setJobsState\('error'\)\}\}\)/],
  ['src/app/me.tsx', /catch\(\(\) => \{ setSummary\(null\); setError\(/],
];

const failures = [];
for (const [file, pattern] of checks) {
  if (!fs.existsSync(path.join(root, file))) { failures.push('Missing file: ' + file); continue; }
  const src = read(file);
  if (!pattern.test(src)) failures.push(file + ': a failed refetch must clear the prior successful data before/alongside setting the error, not leave it rendered underneath (or, for Home, silently stale with no error shown at all)');
}

if (failures.length) { console.error('Failure-state audit failed:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('Failure-state audit passed: ' + checks.length + ' screens checked for stale-data-under-error regressions.');
