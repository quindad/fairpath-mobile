// DEV ONLY — six capability scenarios on shared DEV (profiles + profile_answers).
// Local static audit always runs; DEV PATCH/verify skipped when passwords or --confirm-dev missing.
//
//   node scripts/qa-dev-member-capabilities-matrix.mjs --confirm-dev
//   node scripts/qa-dev-member-capabilities-matrix.mjs --confirm-dev --use-documented-dev-accounts
//
// Passwords (never printed): QA_DEV_FREE_PASSWORD / QA_COMMUNITY_MEMBER_A_PASSWORD (member A)
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { maskEmail, requireMemberPasswords, resolveCommunityE2eMembers } from './lib/dev-qa-accounts.mjs';
import {
  assertDevMutatingSession,
  assertDocumentedDevTestAccount,
  createRunId,
  loadEnvLocal,
  readLinkedRef,
} from './lib/dev-qa-run.mjs';
import {
  VETERAN_TOOLS_QUESTION_ID,
  justiceToolsEnabled,
  normalizeCapabilityChoice,
  parseJusticeImpactedField,
  toProfileJusticeField,
  veteranToolsEnabled,
} from '../src/core/profile/member-capabilities-core.ts';

const args = new Set(process.argv.slice(2));
const useDocumented = args.has('--use-documented-dev-accounts');
const confirmDev = args.has('--confirm-dev');
const runId = createRunId('caps');

const SCENARIOS = [
  { id: 'neither', justice: 'no', veteran: 'no' },
  { id: 'justice_only', justice: 'yes', veteran: 'no' },
  { id: 'veteran_only', justice: 'no', veteran: 'yes' },
  { id: 'both', justice: 'yes', veteran: 'yes' },
  { id: 'justice_prefer_not_to_say', justice: 'prefer_not_to_say', veteran: 'no' },
  { id: 'veteran_prefer_not_to_say', justice: 'no', veteran: 'prefer_not_to_say' },
];

function runLocalAudit() {
  const r = spawnSync(process.execPath, ['scripts/audit-member-capabilities.mjs'], { encoding: 'utf8' });
  return { ok: r.status === 0, last: (r.stdout + r.stderr).trim().split('\n').slice(-1)[0] ?? '' };
}

const localAudit = runLocalAudit();
const results = [{ name: 'local audit-member-capabilities', ok: localAudit.ok, detail: localAudit.last }];
const blocked = [];

if (!localAudit.ok) {
  console.error('Local member-capabilities audit failed — fix before DEV matrix.');
  writeReport({ localAudit, results, dev: { status: 'BLOCKED', reason: 'local audit failed' }, blocked });
  process.exit(1);
}

console.log('PASS local audit-member-capabilities');

const env = loadEnvLocal();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const linkedRef = readLinkedRef();

const { emailA, passA } = resolveCommunityE2eMembers();
const memberEmail = emailA;
const memberPassword = passA;

let devStatus = 'SKIPPED';
let devReason = '';

if (!confirmDev) {
  devReason = 'missing --confirm-dev';
  blocked.push('DEV matrix: pass --confirm-dev');
} else if (!url || !anonKey) {
  devReason = 'missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local';
  blocked.push(devReason);
} else if (!memberPassword) {
  devReason = 'missing member password (QA_DEV_FREE_PASSWORD or QA_COMMUNITY_MEMBER_A_PASSWORD)';
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

async function readCapabilities(client, userId) {
  const [{ data: profile }, { data: veteranRow }] = await Promise.all([
    client.from('profiles').select('justice_impacted').eq('id', userId).maybeSingle(),
    client
      .from('profile_answers')
      .select('answer')
      .eq('user_id', userId)
      .eq('question_id', VETERAN_TOOLS_QUESTION_ID)
      .maybeSingle(),
  ]);
  const veteranRaw = veteranRow?.answer;
  const veteran =
    typeof veteranRaw === 'string'
      ? normalizeCapabilityChoice(veteranRaw)
      : veteranRaw && typeof veteranRaw === 'object' && 'choice' in veteranRaw
        ? normalizeCapabilityChoice(veteranRaw.choice)
        : 'prefer_not_to_say';
  return {
    justice: parseJusticeImpactedField(profile?.justice_impacted),
    veteran,
  };
}

async function applyScenario(client, userId, scenario) {
  const { error: profileErr } = await client
    .from('profiles')
    .update({ justice_impacted: toProfileJusticeField(scenario.justice), updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (profileErr) throw profileErr;
  const { error: ansErr } = await client.from('profile_answers').upsert(
    {
      user_id: userId,
      question_id: VETERAN_TOOLS_QUESTION_ID,
      answer: scenario.veteran,
      source: 'user',
      verification_state: 'self_reported',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,question_id' },
  );
  if (ansErr) throw ansErr;
}

if (!devReason) {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const client = createClient(url, anonKey, opts);
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: memberEmail,
    password: memberPassword,
  });
  if (authErr || !authData.user?.id) {
    devReason = authErr?.message ?? 'signIn failed';
    blocked.push(devReason);
  } else {
    const userId = authData.user.id;
    let snapshot = null;
    try {
      snapshot = await readCapabilities(client, userId);
      for (const scenario of SCENARIOS) {
        const name = `DEV scenario ${scenario.id}`;
        try {
          await applyScenario(client, userId, scenario);
          const loaded = await readCapabilities(client, userId);
          if (loaded.justice !== scenario.justice || loaded.veteran !== scenario.veteran) {
            throw new Error(`readback mismatch: got ${JSON.stringify(loaded)}`);
          }
          const flags = {
            justiceToolsEnabled: justiceToolsEnabled(loaded),
            veteranToolsEnabled: veteranToolsEnabled(loaded),
          };
          const expectJustice = scenario.justice === 'yes';
          const expectVeteran = scenario.veteran === 'yes';
          if (flags.justiceToolsEnabled !== expectJustice || flags.veteranToolsEnabled !== expectVeteran) {
            throw new Error(`tool flags mismatch: ${JSON.stringify(flags)}`);
          }
          results.push({ name, ok: true, scenario: scenario.id, flags });
          console.log('PASS ' + name);
        } catch (e) {
          results.push({ name, ok: false, scenario: scenario.id, error: String(e.message ?? e).slice(0, 400) });
          console.log('FAIL ' + name + '\n     ' + String(e.message ?? e).slice(0, 400));
        }
      }
      devStatus = results.some((r) => r.name.startsWith('DEV') && !r.ok) ? 'FAILED' : 'PASSED';
    } finally {
      if (snapshot) {
        try {
          await applyScenario(client, userId, snapshot);
          console.log('Restored member capability snapshot after matrix.');
        } catch (e) {
          const msg = String(e.message ?? e).slice(0, 400);
          results.push({ name: 'restore capability snapshot', ok: false, error: msg });
          blocked.push(`restore failed: ${msg}`);
          console.log('FAIL restore capability snapshot\n     ' + msg);
        }
      }
    }
  }
}

if (devReason && devStatus === 'SKIPPED') {
  results.push({
    name: 'DEV capability matrix',
    ok: null,
    skipped: true,
    reason: devReason,
  });
  console.log('SKIP DEV capability matrix — ' + devReason);
}

const failedDev = results.filter((r) => r.ok === false).length;
const restoreFailed = results.some((r) => r.name === 'restore capability snapshot' && r.ok === false);
writeReport({
  runId,
  localAudit,
  results,
  dev: { status: devStatus, reason: devReason || undefined, member: maskEmail(memberEmail) },
  blocked,
  assertionCount: results.filter((r) => r.ok === true).length,
  nativeIphone: 'NOT TESTED',
  uiSurfacesAfterReload: 'NOT TESTED (persistence only)',
});

console.log(
  `\nLocal audit: PASS. DEV: ${devStatus}${devReason ? ` (${devReason})` : ''}. ` +
    `${results.filter((r) => r.ok === true).length} assertions OK` +
    (failedDev ? `, ${failedDev} DEV failures` : '') +
    '. Wrote qa-dev-member-capabilities-matrix-results.json',
);

process.exit(localAudit.ok && failedDev === 0 && !restoreFailed ? 0 : failedDev || restoreFailed ? 1 : 0);

function writeReport(payload) {
  fs.writeFileSync(
    'qa-dev-member-capabilities-matrix-results.json',
    JSON.stringify({ at: new Date().toISOString(), ...payload }, null, 2),
  );
}
