// SIG-101 prep — static FairPath Signal wiring + optional DEV Edge ping (member-focus-guidance).
// Local static audits always run; DEV Edge probes skipped unless --confirm-dev and member password env vars.
//
//   node scripts/qa-dev-signal-smoke.mjs
//   node scripts/qa-dev-signal-smoke.mjs --confirm-dev --use-documented-dev-accounts
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
const runId = createRunId('signal');

const REPORT_PATH = 'qa-dev-signal-smoke-results.json';
const SIGNAL_EDGE_FN = 'member-focus-guidance';

function staticFairpathSignalContract() {
  const read = (p) => fs.readFileSync(p, 'utf8');
  const failures = [];
  const check = (cond, msg) => {
    if (!cond) failures.push(msg);
  };

  for (const p of [
    'src/app/fairpath-ai.tsx',
    'src/core/signal/signal-orchestrator.ts',
    'src/core/signal/signal-conversation-store.ts',
    'src/core/signal/signal-prompt-guard.ts',
    'src/core/signal/signal-tool-registry.ts',
    'src/core/ai/signal.ts',
  ]) {
    check(fs.existsSync(p), `missing ${p}`);
  }

  const ui = read('src/app/fairpath-ai.tsx');
  const orch = read('src/core/signal/signal-orchestrator.ts');
  const store = read('src/core/signal/signal-conversation-store.ts');
  const guard = read('src/core/signal/signal-prompt-guard.ts');
  const plan = read('src/core/signal/signal-tool-plan.ts');
  const signalClient = read('src/core/ai/signal.ts');

  check(/from '@\/core\/signal\/signal-orchestrator'/.test(ui), 'fairpath-ai must import signal-orchestrator');
  check(/enrichWithReadTools/.test(ui), 'fairpath-ai must call enrichWithReadTools');
  check(/detectWriteToolRequest/.test(ui), 'fairpath-ai must detect write-tool requests (confirm-only)');
  check(/loadingMessageForPhase/.test(ui), 'fairpath-ai must show orchestrator loading phases');
  check(/KeyboardFooterLayout/.test(ui), 'fairpath-ai must pin composer for keyboard');
  check(/signalQuickTools/.test(ui), 'fairpath-ai must use compact tools menu');
  check(/fetchFairpathGatewayPlan/.test(ui), 'fairpath-ai must call fairpath-ai-gateway when signed in');
  check(/letter-explainer/.test(ui), 'fairpath-ai attachment must route to letter explainer');
  check(/resultCards/.test(read('src/components/signal/SignalMessageBubble.tsx')), 'Signal UI must render result cards');

  check(/from '@\/core\/signal\/signal-conversation-store'/.test(ui), 'fairpath-ai must import conversation store');
  check(/loadActiveConversation/.test(ui) && /saveActiveConversation/.test(ui), 'fairpath-ai must load and persist threads');
  check(/AsyncStorage/.test(store), 'conversation store must use device-local AsyncStorage');

  check(/from '@\/core\/signal\/signal-prompt-guard'/.test(ui), 'fairpath-ai must import prompt guard');
  check(/looksLikePromptInjection/.test(ui), 'fairpath-ai must run prompt-injection heuristics before routing');

  check(/signal-prompt-guard/.test(orch), 'orchestrator must sanitize tool queries via prompt guard');
  check(/signal-tool-plan/.test(orch), 'orchestrator must plan read tools via tool-plan');
  check(/signal-tool-registry/.test(plan), 'tool-plan must read typed tools from registry');

  check(/supabase\.functions\.invoke/.test(signalClient), 'signal.ts must invoke Edge Functions (no direct provider)');
  check(!/sk-[a-z0-9]{10,}/i.test(ui + orch + store + guard + signalClient), 'no provider keys in Signal client surfaces');

  check(/looksLikePromptInjection/.test(guard) && /sanitizeToolQuery/.test(guard), 'prompt guard exports injection + sanitize helpers');

  return { ok: failures.length === 0, failures };
}

const results = [];
const blocked = [];

function pushResult(name, ok, extra = {}) {
  results.push({ name, ok, ...extra });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra.detail ? '  -> ' + extra.detail : ''));
}

const routeContract = staticFairpathSignalContract();
pushResult('local fairpath-ai Signal wiring contract', routeContract.ok, {
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

async function invokeSignalEdge(accessToken) {
  const headers = {
    apikey: anonKey,
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  const r = await fetch(`${url}/functions/v1/${SIGNAL_EDGE_FN}`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  let body = null;
  try {
    body = await r.json();
  } catch {
    /* non-json body */
  }
  return { status: r.status, body };
}

function edgeReachableDetail(status, body) {
  const snippet = body && typeof body === 'object' ? JSON.stringify(body).slice(0, 120) : String(body ?? '').slice(0, 120);
  return `status ${status}${snippet ? ` ${snippet}` : ''}`;
}

if (!confirmDev) {
  devReason = 'missing --confirm-dev';
  blocked.push('DEV smoke: pass --confirm-dev to ping Signal Edge on shared DEV');
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

if (!devReason) {
  const anonProbe = await invokeSignalEdge(null);
  const anonOk = anonProbe.status === 401;
  pushResult(`DEV anon cannot invoke ${SIGNAL_EDGE_FN}`, anonOk, {
    detail: edgeReachableDetail(anonProbe.status, anonProbe.body),
  });

  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const client = createClient(url, anonKey, opts);
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: memberEmail,
    password: memberPassword,
  });
  if (authErr || !authData.session?.access_token) {
    devReason = authErr?.message ?? 'signIn failed';
    blocked.push(devReason);
    pushResult(`DEV signed-in ${SIGNAL_EDGE_FN} ping`, false, { detail: devReason });
    devStatus = 'FAILED';
  } else {
    console.log('Signed in as ' + maskEmail(memberEmail) + ' (member JWT, anon client)');
    const memberProbe = await invokeSignalEdge(authData.session.access_token);
    const memberOk =
      memberProbe.status === 200
        ? typeof memberProbe.body?.text === 'string'
        : memberProbe.status === 402 || memberProbe.status === 503;
    pushResult(`DEV signed-in ${SIGNAL_EDGE_FN} ping`, memberOk, {
      detail: edgeReachableDetail(memberProbe.status, memberProbe.body),
    });
    const devFailed = results.some((r) => r.name.startsWith('DEV') && !r.ok);
    devStatus = devFailed ? 'FAILED' : 'PASSED';
  }
}

if (devReason && devStatus === 'BLOCKED') {
  results.push({
    name: 'DEV Signal Edge smoke',
    ok: null,
    skipped: true,
    reason: devReason,
  });
  console.log('BLOCKED DEV Signal smoke — ' + devReason);
}

const payload = {
  runId,
  at: new Date().toISOString(),
  mission: 'SIG-101 prep',
  local: { status: localOk ? 'PASSED' : 'FAILED' },
  dev: { status: devStatus, reason: devReason || undefined, member: maskEmail(memberEmail), edgeFunction: SIGNAL_EDGE_FN },
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
