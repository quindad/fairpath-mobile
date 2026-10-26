// DEV: verify My Path cloud sync (member_opportunity_plan_items). Requires member password in env.
//   node scripts/qa-dev-my-path-sync.mjs --confirm-dev --use-documented-dev-accounts
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { maskEmail, requireMemberPasswords, resolveCommunityE2eMembers } from './lib/dev-qa-accounts.mjs';
import {
  assertDevMutatingSession,
  assertDocumentedDevTestAccount,
  createRunId,
  loadEnvLocal,
  readLinkedRef,
} from './lib/dev-qa-run.mjs';

const args = new Set(process.argv.slice(2));
const confirmDev = args.has('--confirm-dev');
const useDocumented = args.has('--use-documented-dev-accounts');
const REPORT = 'qa-dev-my-path-sync-results.json';
const runId = createRunId('my-path-sync');

const results = [];
const push = (name, ok, extra = {}) => {
  results.push({ name, ok, ...extra });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra.detail ? ' -> ' + extra.detail : ''));
};

const env = loadEnvLocal();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let blocked = 'missing --confirm-dev';

if (confirmDev && url && anon) {
  try {
    assertDevMutatingSession({ url, linkedRef: readLinkedRef(), confirmDev });
    const { emailA, passA } = resolveCommunityE2eMembers();
    if (useDocumented) assertDocumentedDevTestAccount(emailA);
    requireMemberPasswords({ emailA, emailB: emailA, passA, passB: passA });
    blocked = '';

    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { data: auth, error: signErr } = await client.auth.signInWithPassword({ email: emailA, password: passA });
    if (signErr || !auth.session) throw new Error(signErr?.message ?? 'signIn failed');
    console.log('Signed in as ' + maskEmail(emailA));

    const clientId = `qa_${randomUUID().slice(0, 8)}`;
    const title = 'QA transportation step';
    const { error: insErr } = await client.from('member_opportunity_plan_items').upsert({
      user_id: auth.user.id,
      client_id: clientId,
      title,
      status: 'exploring',
      route: '/resources?q=transportation',
      need_labels: ['Transportation assistance'],
      updated_at: new Date().toISOString(),
    });
    push('insert own plan item', !insErr, { detail: insErr?.message });

    const { data: rows, error: readErr } = await client
      .from('member_opportunity_plan_items')
      .select('client_id,title,route')
      .eq('client_id', clientId)
      .maybeSingle();
    push('read back plan item', !readErr && rows?.title === title, { detail: readErr?.message ?? rows?.title });

    const anonClient = createClient(url, anon);
    const { data: leak } = await anonClient.from('member_opportunity_plan_items').select('id').limit(1);
    push('anon cannot read plan items', !leak?.length, { detail: `rows=${leak?.length ?? 0}` });

    await client.from('member_opportunity_plan_items').delete().eq('client_id', clientId);
    push('cleanup test row', true);
  } catch (e) {
    blocked = String(e.message ?? e);
    push('my path sync', false, { detail: blocked });
  }
}

const payload = {
  runId,
  at: new Date().toISOString(),
  blocked: blocked || undefined,
  results,
};
fs.writeFileSync(REPORT, JSON.stringify(payload, null, 2));
if (blocked) {
  console.log('BLOCKED:', blocked);
  process.exit(2);
}
if (results.some((r) => !r.ok)) process.exit(1);
console.log('My Path DEV sync: PASSED');
