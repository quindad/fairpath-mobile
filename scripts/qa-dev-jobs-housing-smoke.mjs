// JOB-101 / HOUSE-101 prep — signed-in browse smoke on shared DEV (search_jobs + search_housing).
// Local static audits always run; DEV RPC probes skipped unless --confirm-dev and member password env vars.
//
//   node scripts/qa-dev-jobs-housing-smoke.mjs
//   node scripts/qa-dev-jobs-housing-smoke.mjs --confirm-dev --use-documented-dev-accounts
//
// Passwords (never printed): QA_DEV_FREE_PASSWORD / QA_COMMUNITY_MEMBER_A_PASSWORD (member A)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { maskEmail, requireMemberPasswords, resolveCommunityE2eMembers } from './lib/dev-qa-accounts.mjs';
import {
  assertDevMutatingSession,
  assertDocumentedDevTestAccount,
  createRunId,
  loadEnvLocal,
  readLinkedRef,
} from './lib/dev-qa-run.mjs';

const args = new Set(process.argv.slice(2));
const useDocumented = args.has('--use-documented-dev-accounts');
const confirmDev = args.has('--confirm-dev');
const runId = createRunId('jobs-housing');

const REPORT_PATH = 'qa-dev-jobs-housing-smoke-results.json';

function staticRouteContract() {
  const read = (p) => fs.readFileSync(p, 'utf8');
  const failures = [];
  const check = (cond, msg) => {
    if (!cond) failures.push(msg);
  };
  check(fs.existsSync('src/app/find-jobs.tsx'), 'missing src/app/find-jobs.tsx');
  check(fs.existsSync('src/app/find-housing.tsx'), 'missing src/app/find-housing.tsx');
  const jobsSvc = read('src/core/jobs/jobs-service.ts');
  const housingSvc = read('src/core/housing/housing-service.ts');
  const findJobs = read('src/app/find-jobs.tsx');
  const findHousing = read('src/app/find-housing.tsx');
  check(/rpc\('search_jobs'/.test(jobsSvc), 'jobs-service must call search_jobs RPC');
  check(/rpc\('search_housing'/.test(housingSvc), 'housing-service must call search_housing RPC');
  check(/searchJobs\(/.test(findJobs), 'find-jobs must call searchJobs');
  check(/searchHousing\(/.test(findHousing), 'find-housing must call searchHousing');
  const explore = read('src/app/explore.tsx');
  check(/route: '\/find-jobs'/.test(explore) && /route: '\/find-housing'/.test(explore), 'explore must link jobs + housing routes');
  check(/effectiveExploreStatus/.test(explore), 'explore must use effectiveExploreStatus');
  const readiness = read('src/core/explore/explore-readiness.ts');
  check(/jobs:\s*'live'/.test(readiness) && /housing:\s*'live'/.test(readiness), 'explore-readiness must mark jobs + housing live');
  return { ok: failures.length === 0, failures };
}

const results = [];
const blocked = [];

function pushResult(name, ok, extra = {}) {
  results.push({ name, ok, ...extra });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra.detail ? '  -> ' + extra.detail : ''));
}

const routeContract = staticRouteContract();
pushResult('local jobs/housing route + RPC contract', routeContract.ok, {
  detail: routeContract.ok ? 'static OK' : routeContract.failures.join('; '),
});

const localOk = routeContract.ok;

let devStatus = 'BLOCKED';
let devReason = '';

const env = loadEnvLocal();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const linkedRef = readLinkedRef();

const { emailA, passA } = resolveCommunityE2eMembers();
const memberEmail = emailA;
const memberPassword = passA;

if (!confirmDev) {
  devReason = 'missing --confirm-dev';
  blocked.push('DEV smoke: pass --confirm-dev to hit shared DEV');
} else if (!url || !anonKey) {
  devReason = 'missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local';
  blocked.push(devReason);
} else {
  try {
    assertDevMutatingSession({ url, linkedRef, confirmDev });
    if (useDocumented) assertDocumentedDevTestAccount(memberEmail);
    requireMemberPasswords({ emailA: memberEmail, emailB: memberEmail, passA: memberPassword, passB: memberPassword });
  } catch (e) {
    devReason = String(e.message ?? e);
    blocked.push(devReason);
  }
}

async function devRpcBrowse(client) {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const zip = '43228';
  const radius = 25;
  const limit = 5;

  const jobs = await client.rpc('search_jobs', {
    p_query: null,
    p_zip: zip,
    p_radius_miles: radius,
    p_location: null,
    p_remote: false,
    p_employment_type: null,
    p_second_chance: false,
    p_limit: limit,
    p_offset: 0,
    p_veteran_friendly: false,
  });
  if (jobs.error) throw new Error(jobs.error.message ?? 'search_jobs failed');
  const jobRows = jobs.data ?? [];
  if (!Array.isArray(jobRows)) throw new Error('search_jobs returned non-array');

  const housing = await client.rpc('search_housing', {
    p_query: null,
    p_zip: zip,
    p_radius_miles: radius,
    p_location: null,
    p_filters: {},
    p_sort: 'featured',
    p_limit: limit,
    p_offset: 0,
  });
  if (housing.error) throw new Error(housing.error.message ?? 'search_housing failed');
  const homeRows = housing.data ?? [];
  if (!Array.isArray(homeRows)) throw new Error('search_housing returned non-array');

  return {
    jobs: { count: jobRows.length, sampleTitle: jobRows[0]?.job?.title ?? jobRows[0]?.title ?? null },
    housing: { count: homeRows.length, sampleTitle: homeRows[0]?.listing?.title ?? homeRows[0]?.title ?? null },
  };
}

if (!devReason) {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const client = createClient(url, anonKey, opts);
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: memberEmail,
    password: memberPassword,
  });
  if (authErr || !authData.session?.access_token) {
    devReason = authErr?.message ?? 'signIn failed';
    blocked.push(devReason);
  } else {
    console.log('Signed in as ' + maskEmail(memberEmail) + ' (member JWT, anon client)');
    try {
      const summary = await devRpcBrowse(client);
      pushResult('DEV signed-in search_jobs browse', summary.jobs.count >= 0, {
        detail: `${summary.jobs.count} rows${summary.jobs.sampleTitle ? `; first=${String(summary.jobs.sampleTitle).slice(0, 40)}` : ''}`,
      });
      pushResult('DEV signed-in search_housing browse', summary.housing.count >= 0, {
        detail: `${summary.housing.count} rows${summary.housing.sampleTitle ? `; first=${String(summary.housing.sampleTitle).slice(0, 40)}` : ''}`,
      });
      const devFailed = results.some((r) => r.name.startsWith('DEV') && !r.ok);
      devStatus = devFailed ? 'FAILED' : 'PASSED';
    } catch (e) {
      devReason = String(e.message ?? e).slice(0, 400);
      blocked.push(devReason);
      pushResult('DEV signed-in jobs/housing RPC browse', false, { detail: devReason });
      devStatus = 'FAILED';
    }
  }
}

if (devReason && devStatus === 'BLOCKED') {
  results.push({
    name: 'DEV jobs/housing list RPC smoke',
    ok: null,
    skipped: true,
    reason: devReason,
  });
  console.log('BLOCKED DEV jobs/housing smoke — ' + devReason);
}

const failedDev = results.filter((r) => r.ok === false).length;
const payload = {
  runId,
  at: new Date().toISOString(),
  mission: 'JOB-101 / HOUSE-101 prep',
  local: { status: localOk ? 'PASSED' : 'FAILED' },
  dev: { status: devStatus, reason: devReason || undefined, member: maskEmail(memberEmail) },
  blocked,
  results,
  credentialsLogged: false,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(payload, null, 2));

console.log(
  `\nLocal: ${localOk ? 'PASS' : 'FAIL'}. DEV: ${devStatus}${devReason ? ` (${devReason})` : ''}. ` +
    `Wrote ${REPORT_PATH}`,
);

if (!localOk) process.exit(1);
if (devStatus === 'FAILED') process.exit(1);
process.exit(0);
