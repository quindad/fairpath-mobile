// Jobs production-pass audit: server-side search, secure application RPCs, audit trail, privacy.
import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

const mig = read('supabase/migrations/20260926130000_jobs_search_and_applications.sql');
const code = mig.replace(/--.*$/gm, '');
const fn = (name) => {
  const m = code.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`));
  return m ? m[0] : '';
};

// ---- database ----
const search = fn('search_jobs');
check(search, 'search_jobs is not defined');
check(/security invoker/.test(search), 'search_jobs must be SECURITY INVOKER so jobs RLS still applies');
check(/least\(greatest\(coalesce\(p_limit/.test(search), 'search_jobs must clamp the page size');
check(/count\(\*\) over \(\)/.test(search), 'search_jobs must return total counts for pagination');
check(!/employer_id/.test(search), 'search_jobs must not return employer_id');
check(/grant execute on function public\.search_jobs[\s\S]*?to anon, authenticated/.test(code), 'search_jobs must be executable by anon (guest browsing) and authenticated');

const submit = fn('submit_job_application');
check(submit, 'submit_job_application is not defined');
check(/security definer/.test(submit) && /set search_path = public/.test(submit), 'submit_job_application must be SECURITY DEFINER with a fixed search_path');
check(/auth\.uid\(\)/.test(submit), 'submit_job_application must derive the user from auth.uid()');
check(/ALREADY_APPLIED/.test(submit) && /JOB_UNAVAILABLE/.test(submit), 'submit_job_application must reject duplicates and unavailable jobs');
check(/'submitted'/.test(submit) && !/p_status|p_answers ->> 'status'/.test(submit), 'submit_job_application must force status=submitted (never client-set)');
check(!/date_of_birth|address|conviction|offense|supervision|registration/i.test(submit), 'submit_job_application must not accept DOB, address or justice-history fields');
check(/revoke all on function public\.submit_job_application[\s\S]*?from public, anon/.test(code), 'submit_job_application must not be executable by anon');
check(/revoke insert, delete on table public\.job_applications from authenticated/.test(code), 'direct INSERT on job_applications must be revoked from authenticated');
check(/drop policy if exists "Applicants create own applications"/.test(code), 'the direct-insert RLS policy must be dropped');
check(/create or replace function public\.withdraw_job_application/.test(code), 'withdraw_job_application is not defined');
check(/create table if not exists public\.job_application_events/.test(code) && /log_job_application_event/.test(code), 'application event table/trigger missing');
check(/grant select on table public\.job_application_events to authenticated/.test(code) && !/grant [a-z, ]*(insert|update|delete)[a-z, ]* on table public\.job_application_events to authenticated/.test(code), 'events must be read-only for authenticated');

// ---- client ----
const svc = read('src/core/jobs/jobs-service.ts');
check(/rpc\('search_jobs'/.test(svc), 'jobs-service must search through the search_jobs RPC');
check(/rpc\('submit_job_application'/.test(svc) && /rpc\('withdraw_job_application'/.test(svc), 'jobs-service must use the application RPCs');
check(!/from\('job_applications'\)\s*\.insert/.test(svc) && !/from\('job_applications'\)\s*\.update/.test(svc), 'client must not insert/update job_applications directly');
check(!/limit\(100\)/.test(svc), 'jobs must not be capped with a client-side limit(100)');

const find = read('src/app/find-jobs.tsx');
check(/searchJobs\(/.test(find) && /onEndReached/.test(find) && /FlatList/.test(find), 'find-jobs must page through searchJobs with an infinite FlatList');
check(!/filter\(\s*j\s*=>\s*j\.eligibility_rules/.test(find), 'second-chance filtering must be server-side');
check(/loadLocationSettings/.test(find) && /radius/.test(find), 'find-jobs must apply the saved ZIP + radius');
check(/JobMap/.test(find) && /saveJob/.test(find) && /openAccountArea\('\/saved-jobs'\)/.test(find), 'list/map view and saved jobs must be preserved');

for (const f of ['src/app/job-apply/[id].tsx', 'src/app/job/[id].tsx']) {
  const src = read(f);
  check(!/loadFairPathReadiness|overallPercentage/.test(src), `${f} must not gate on 100% profile readiness`);
}
const apply = read('src/app/job-apply/[id].tsx');
check(!/date_of_birth|HOME ADDRESS|form\.address/.test(apply), 'Easy Apply must not collect DOB or home address');
check(/\['first_name','last_name','email','phone'\]/.test(apply), 'Easy Apply must require only name, email and phone (plus employer-required questions)');

if (failures.length) {
  console.error('Jobs audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Jobs audit passed: server-side ZIP/radius search + pagination, RPC-only applications, event trail, minimum-field apply gate, no DOB/address/justice data to employers.');
