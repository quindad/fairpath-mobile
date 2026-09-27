// Opportunity Profile audit: form rules (executed), boundaries, and wiring. `npm run test:profile`
import fs from 'node:fs';
import path from 'node:path';
import * as f from '../src/core/profile/opportunity-forms.ts';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const NOW = new Date(2026, 9, 4);

// ---- dates ----
check(f.isoFromText('03/01/2019') === '2019-03-01' && f.isoFromText('02/30/2020') === null && f.isoFromText('3/1/2019') === null && f.isoFromText('') === null, 'iso conversion');
check(f.textFromIso('2019-03-01') === '03/01/2019' && f.textFromIso(null) === '', 'text conversion');

// ---- work ----
const w = { job_title: 'Forklift Operator', employer_name: 'Acme', location_text: '', start_text: '03/01/2019', end_text: '06/30/2021', is_current: false, description: '' };
check(Object.keys(f.validateWork(w, NOW)).length === 0, 'valid work');
check(f.validateWork({ ...w, job_title: 'X' }, NOW).job_title, 'short title rejected');
check(f.validateWork({ ...w, end_text: '01/01/2019' }, NOW).end_text?.includes('after'), 'end before start rejected');
check(f.validateWork({ ...w, start_text: '01/01/2030', end_text: '01/01/2031' }, NOW).start_text?.includes('future'), 'future start rejected');
check(f.validateWork({ ...w, is_current: true, end_text: '' }, NOW).end_text === undefined, 'current job needs no end date');
check(f.validateWork({ ...w, end_text: '' }, NOW).end_text, 'past job needs an end date');
check(f.validateWork({ ...w, description: 'x'.repeat(1001) }, NOW).description, 'long description rejected');

// ---- education / credentials / skills ----
const e = { school_name: 'Lincoln High', credential: 'ged', field_of_study: '', start_year: '', end_year: '2015', status: 'completed' };
check(Object.keys(f.validateEducation(e, NOW)).length === 0, 'valid education');
check(f.validateEducation({ ...e, credential: 'wizard' }, NOW).credential, 'bad credential');
check(f.validateEducation({ ...e, start_year: '2016' }, NOW).end_year, 'year order');
check(f.validateEducation({ ...e, end_year: '15' }, NOW).end_year, 'two-digit year');
const c = { credential_type: 'certification', name: 'OSHA 10', issuer: '', issued_text: '05/01/2023', expires_text: '' };
check(Object.keys(f.validateCredential(c, NOW)).length === 0, 'valid credential');
check(f.validateCredential({ ...c, expires_text: '01/01/2023' }, NOW).expires_text, 'expiry before issue');
check(f.validateCredential({ ...c, issued_text: '01/01/2030' }, NOW).issued_text, 'future issue');
check(f.validateSkill('Forklift', []) === null && f.validateSkill('a', []) && f.validateSkill('Forklift', ['forklift ']) && f.validateSkill('x'.repeat(61), []), 'skill rules');

// ---- preferences ----
check(f.parseTitles('Cook, cook ,Warehouse\nDriver').join('|') === 'Cook|cook|Warehouse|Driver', 'titles parse: ' + f.parseTitles('Cook, cook ,Warehouse\nDriver'));
check(f.validateTitles([], 'a,b,c,d,e,f') === 'List up to 5 roles.', 'more than 5 roles rejected (not silently truncated)');
check(f.parsePay('$18.5').value === 18.5 && f.parsePay('').value === null && f.parsePay('abc').error && f.parsePay('5000').error, 'pay parsing');

// ---- deterministic next step ----
const secs = [
  { section_key: 'skills', is_complete: false, label: 'Skills', sort_order: 5 },
  { section_key: 'contact', is_complete: true, label: 'Contact', sort_order: 1 },
  { section_key: 'location', is_complete: false, label: 'Where you want to work', sort_order: 2 },
];
check(f.nextProfileStep(secs)?.key === 'location' && f.nextProfileStep(secs)?.route === '/location-setup', 'next step is the first incomplete section by fixed order');
check(f.nextProfileStep(secs.map((s) => ({ ...s, is_complete: true }))) === null, 'no next step when complete');
check(JSON.stringify(f.nextProfileStep(secs)) === JSON.stringify(f.nextProfileStep([...secs].reverse())), 'next step must not depend on input order');

// ---- wiring & boundaries ----
const svc = read('src/core/profile/opportunity-service.ts');
const tables = [...svc.matchAll(/\.from\('(\w+)'\)/g)].map((m) => m[1]);
check(tables.every((t) => ['member_work_experience', 'member_education', 'member_credentials', 'member_skills', 'member_job_preferences', 'profiles'].includes(t)), 'service touches only opportunity tables + profiles: ' + [...new Set(tables)]);
check(!/convictions|user_convictions|supervision|registration_records|profile_answers|offense/i.test(svc), 'the Opportunity Profile service must not touch justice-history tables or the readiness questionnaire');
check(/get_opportunity_completion/.test(svc), 'completion comes from the database function');
check(!/percent|Math\.round\(.*\/.*\*\s*100/.test(read('src/app/opportunity-profile/index.tsx')), 'no fake completion percentage in the hub');
const jobsApply = fs.existsSync('src/app/job-apply') ? fs.readdirSync('src/app/job-apply').map((n) => read(path.join('src/app/job-apply', n))).join('\n') : '';
check(!/opportunity_snapshot/.test(jobsApply), 'the client never builds a snapshot (the server does)');
check(/share_opportunity_profile/.test(jobsApply) || jobsApply === '', 'job apply sends only the opt-in flag + section names');

const mig = read('supabase/migrations/20261001130000_opportunity_profile.sql');
for (const t of ['member_work_experience', 'member_education', 'member_credentials', 'member_skills', 'member_job_preferences']) {
  check(new RegExp(`alter table public\\.${t} enable row level security`).test(mig), `${t}: RLS`);
}
check(!/to authenticated[^;]*employer|is_fairpath_admin|account_type/.test(mig.replace(/--[^\n]*/g, '')), 'no employer/admin policy on member profile tables');
check(/date_of_birth|home_address/.test(mig.replace(/--[^\n]*/g, '')) === false, 'snapshot builder must never reference DOB or address columns');
check(!/convictions|supervision_records|registration_records|user_convictions/.test(mig.replace(/--[^\n]*/g, '')), 'the profile migration must not read justice tables');

if (failures.length) { console.error('Profile audit FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('Profile audit passed: form rules, deterministic next step, service/table boundaries, no DOB/address/justice data in profile or snapshot.');
