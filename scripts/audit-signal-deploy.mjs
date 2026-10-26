// Signal deploy manifest: client invoke list matches Edge Function folders + deploy script. `npm run test:signal-deploy`
import fs from 'node:fs';

const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const signalTs = read('src/core/ai/signal.ts');
const deploySrc = read('scripts/deploy-dev-signal.mjs');
const chains = read('supabase/functions/_shared/core/ai-gateway/signal-chains.ts');

const clientFns = [...signalTs.matchAll(/invokeSignal\('([^']+)'/g)].map((m) => m[1]);
const clientUnique = [...new Set(clientFns)];
const deployFns = [...deploySrc.matchAll(/^\s+'([a-z0-9-]+)',/gm)].map((m) => m[1]);

check(clientUnique.length >= 15, 'signal.ts must invoke member-facing Edge Functions.');

for (const fn of clientUnique) {
  check(fs.existsSync(`supabase/functions/${fn}/index.ts`), `missing Edge Function folder: ${fn}`);
  check(deployFns.includes(fn), `${fn} is invoked by the client but missing from deploy-dev-signal.mjs`);
}

const deployOnlyOrchestration = new Set(['fairpath-ai-gateway']); // auth metadata Edge fn; invoked from fairpath-ai-gateway-client.ts

for (const fn of deployFns) {
  if (deployOnlyOrchestration.has(fn)) continue;
  check(clientFns.includes(fn), `${fn} is in deploy script but not invoked from signal.ts`);
  check(fs.existsSync(`supabase/functions/${fn}/index.ts`), `deploy lists missing function: ${fn}`);
}

check(/resolveSignalChain/.test(chains) && /ANTHROPIC_API_KEY/.test(chains) && /OPENAI_API_KEY/.test(chains), 'Signal chains read provider keys from Edge secrets only.');
check(!/sk-[a-z0-9]{10,}/i.test(signalTs + deploySrc), 'no provider keys in repo scripts');

const sample = read('supabase/functions/job-fit-explanation/index.ts');
check(/runSignalCall/.test(sample) && /resolveSignalChain/.test(sample), 'Signal functions must use shared gateway runner + chain.');

if (failures.length) {
  console.error('Signal deploy audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log(`Signal deploy audit passed: ${deployFns.length} functions aligned (client ↔ deploy ↔ supabase/functions).`);
