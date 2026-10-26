// DEV verification for fairpath-ai-gateway (auth + RLS read tools). No passwords in repo.
//
//   node scripts/qa-dev-fairpath-ai-gateway.mjs
//   node scripts/qa-dev-fairpath-ai-gateway.mjs --confirm-dev --use-documented-dev-accounts
//
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

const FN = 'fairpath-ai-gateway';
const MESSAGE = 'I need a job and transportation near me';
const REPORT = 'qa-dev-fairpath-ai-gateway-results.json';
const args = new Set(process.argv.slice(2));
const confirmDev = args.has('--confirm-dev');
const useDocumented = args.has('--use-documented-dev-accounts');
const runId = createRunId('gateway');

const results = [];
const push = (name, ok, extra = {}) => {
  results.push({ name, ok, ...extra });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra.detail ? '  -> ' + extra.detail : ''));
};

async function invokeGateway(accessToken, body) {
  const env = loadEnvLocal();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const headers = {
    apikey: anonKey,
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  const r = await fetch(`${url}/functions/v1/${FN}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    /* empty */
  }
  return { status: r.status, json };
}

function validateCard(card) {
  if (!card || typeof card !== 'object') return false;
  if (!['job', 'housing', 'resource'].includes(card.kind)) return false;
  if (typeof card.recordId !== 'string' || !card.recordId) return false;
  if (typeof card.title !== 'string') return false;
  if (typeof card.route !== 'string' || !card.route.startsWith('/')) return false;
  return true;
}

const env = loadEnvLocal();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const linkedRef = readLinkedRef();
let devStatus = 'BLOCKED';
let devReason = '';

if (!url || !env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  devReason = 'missing EXPO_PUBLIC_SUPABASE_URL or anon key in .env.local';
} else {
  const anon = await invokeGateway(null, { message: MESSAGE });
  push('DEV anon gateway rejected', anon.status === 401, { detail: `status ${anon.status}` });

  if (!confirmDev) {
    devReason = 'missing --confirm-dev for signed-in gateway verification';
  } else {
    try {
      assertDevMutatingSession({ url, linkedRef, confirmDev });
      const { emailA, passA } = resolveCommunityE2eMembers();
      if (useDocumented) assertDocumentedDevTestAccount(emailA);
      requireMemberPasswords({ emailA, emailB: emailA, passA, passB: passA });
      const client = createClient(url, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.signInWithPassword({ email: emailA, password: passA });
      if (error || !data.session?.access_token) {
        devReason = error?.message ?? 'signIn failed';
        push('DEV signed-in gateway', false, { detail: devReason });
        devStatus = 'FAILED';
      } else {
        console.log('Signed in as ' + maskEmail(emailA));
        const body = { message: MESSAGE, zip: '43215', radiusMiles: 25, executeTools: true };
        const authed = await invokeGateway(data.session.access_token, body);
        const ok =
          authed.status === 200 &&
          authed.json?.authenticated === true &&
          authed.json?.modelAssisted === false &&
          Array.isArray(authed.json?.tools) &&
          authed.json.tools.includes('search_jobs') &&
          authed.json.tools.includes('search_resources');
        push('DEV gateway intent + tools', ok, {
          detail: `status ${authed.status} intent=${authed.json?.intent} tools=${JSON.stringify(authed.json?.tools)}`,
        });
        const cards = authed.json?.resultCards ?? [];
        const cardsOk = Array.isArray(cards) && cards.every((c) => validateCard(c));
        push('DEV gateway resultCards schema', cardsOk, {
          detail: `count=${cards.length}`,
        });
        const locOk =
          authed.json?.location?.zip === '43215' && authed.json?.location?.radiusMiles === 25;
        push('DEV gateway location echo', locOk, {
          detail: JSON.stringify(authed.json?.location),
        });
        const badMsg = await invokeGateway(data.session.access_token, { message: '' });
        push('DEV gateway rejects empty message', badMsg.status === 400, { detail: `status ${badMsg.status}` });
        devStatus = results.some((r) => r.name.startsWith('DEV') && r.ok === false) ? 'FAILED' : 'PASSED';
      }
    } catch (e) {
      devReason = String(e.message ?? e);
      devStatus = 'BLOCKED';
    }
  }
}

const payload = {
  runId,
  at: new Date().toISOString(),
  function: FN,
  dev: { status: devStatus, reason: devReason || undefined },
  results,
};
fs.writeFileSync(REPORT, JSON.stringify(payload, null, 2));
console.log(`\nDEV gateway verification: ${devStatus}${devReason ? ` (${devReason})` : ''}. Wrote ${REPORT}`);

if (devStatus === 'FAILED') process.exit(1);
process.exit(0);
