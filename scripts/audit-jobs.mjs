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

// The LATEST definition of submit_job_application (forward fix): duplicate detection first, validation intact.
{
  const fixed = read('supabase/migrations/20260930140000_claim_and_apply_ordering_fixes.sql').replace(/--.*$/gm, '');
  const latest = (fixed.match(/create or replace function public\.submit_job_application\([\s\S]*?\n\$\$;/) || [''])[0];
  const dup = latest.indexOf("raise exception 'ALREADY_APPLIED'");
  const firstValidation = latest.indexOf("raise exception 'INVALID_APPLICATION:first_name'");
  check(latest && dup > -1 && dup < firstValidation, 'A repeat submission must report ALREADY_APPLIED before field validation runs.');
  for (const need of ['INVALID_APPLICATION:first_name', 'INVALID_APPLICATION:phone', 'INVALID_APPLICATION:question:%', 'JOB_UNAVAILABLE', 'on conflict (user_id, job_id) do nothing']) check(latest.includes(need), `The latest submit_job_application must keep: ${need}`);
  check(!/date_of_birth|address|conviction|offense/i.test(latest), 'The latest submit_job_application must not accept DOB/address/justice fields.');
  check(/security definer/.test(latest) && /auth\.uid\(\)/.test(latest) && /'submitted'/.test(latest), 'The latest submit_job_application must stay server-controlled.');
}

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

// ---- iPhone QA regressions ----
// ZIP detection was silently broken by a mangled regex: execute the real helper.
const { isZip, normalizePlace } = await import('../src/core/jobs/location-utils.ts');
check(isZip('43228') && isZip(' 43228 ') && !isZip('4322') && !isZip('432289') && !isZip('4322a') && !isZip('Columbus'), 'isZip must accept exactly five digits');
check(normalizePlace('Columbus OH') === 'Columbus, OH' && normalizePlace('columbus, oh') === 'columbus, OH' && normalizePlace('Columbus') === 'Columbus', 'normalizePlace must format "City, ST"');
check(/export \{ isZip/.test(svc), 'jobs-service must re-export the tested isZip helper');

// WHERE prefill + manual override
check(/loadLocationSettings\(\)[\s\S]*?setWhere\(next\)/.test(find), 'WHERE must prefill from the saved ZIP');
check(/whereTouched\.current=true/.test(find) && /if\(!whereTouched\.current\)/.test(find), 'typing in WHERE must never be overwritten by the saved ZIP');
check(/DEFAULT_SEARCH_RADIUS_MILES/.test(find) && /setRadius\(s\.search_radius_miles\)/.test(find), 'saved radius must prefill, defaulting to 25');
check(/USE MY SAVED ZIP/.test(find) && /clearWhere/.test(find), 'member must be able to switch away from / back to the saved ZIP');
check(/RADIUS_CHOICES=\[10,25,50,100\]/.test(find), 'radius choices 10/25/50/100 must be available in the search UI');

// Filters
check(/<Modal visible=\{filtersOpen\}/.test(find) && /FILTERS/.test(find) && /openFilters/.test(find), 'a FILTERS control must open a full filter modal');
for (const [needle, label] of [['DISTANCE', 'distance'], ['JOB TYPE', 'job type'], ['Remote only', 'remote'], ['Verified second-chance only', 'second chance']]) {
  check(find.includes(needle), `filter modal must include ${label}`);
}

// One map affordance, functional map
check(!/mapBtn/.test(find) && (find.match(/accessibilityLabel="Map view"/g) || []).length === 1, 'exactly one MAP control (the LIST/MAP toggle) must exist');
check(/if\(viewMode==='map'\)return/.test(find) && /<JobMap[^>]*fill/.test(find), 'map mode must render a full-height map');
const nativeMap = read('src/components/JobMap.native.tsx');
check(/onPress=\{e=>\{e\.stopPropagation/.test(nativeMap) && /JobMapCard/.test(nativeMap) && /fitToCoordinates/.test(nativeMap), 'native map must support pin selection, a job card and fit-to-pins');
check(/onOpen=\{onOpenJob\}/.test(nativeMap) && /onOpen=\{onOpenJob\}/.test(read('src/components/JobMap.web.tsx')), 'selected pin must be able to open Job Details on native and web');
check(/setViewMode\('list'\)/.test(find) && !/setJobs\(\[\]\)/.test(find), 'LIST/MAP switching must not reset search results');

// Job details CTA must sit above the global nav
const detail = read('src/app/job/[id].tsx');
check(!/position:\s*'absolute'/.test(detail), 'job details CTA must be in normal flow above the global nav, not absolutely positioned');

if (failures.length) {
  console.error('Jobs audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Jobs audit passed: server-side ZIP/radius search + pagination, RPC-only applications, event trail, minimum-field apply gate, no DOB/address/justice data to employers.');
