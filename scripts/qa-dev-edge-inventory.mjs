// Read-only DEV Edge Function reachability inventory (anon key, no writes).
//   node scripts/qa-dev-edge-inventory.mjs
// Writes qa-dev-edge-inventory-results.json — use for deployment manifest gaps.
import fs from 'node:fs';
import path from 'node:path';

const DEV_REF = 'znvhmuhojvwvjzmaqwff';
const PROD_REF = 'rqpczemdagoddhuwefxt';

function loadEnvLocal() {
  if (!fs.existsSync('.env.local')) return {};
  return Object.fromEntries(
    fs
      .readFileSync('.env.local', 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
  );
}

const env = loadEnvLocal();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const linked = fs.existsSync('supabase/.temp/project-ref') ? fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim() : '';

if (!url?.includes(DEV_REF) || url.includes(PROD_REF) || linked !== DEV_REF || !key || key.startsWith('<')) {
  console.error('REFUSING: inventory only runs against linked DEV project.');
  process.exit(1);
}

const fnRoot = 'supabase/functions';
const repoFunctions = fs
  .readdirSync(fnRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name)
  .sort();

async function probe(name) {
  try {
    const r = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: '{}',
    });
    let body = null;
    try {
      body = await r.json();
    } catch {
      body = null;
    }
    const deployed = r.status !== 404;
    return { name, status: r.status, deployed, bodySnippet: body ? JSON.stringify(body).slice(0, 100) : '' };
  } catch (e) {
    return { name, status: 0, deployed: false, bodySnippet: String(e).slice(0, 80) };
  }
}

const mobileCritical = [
  'evaluate-record-relief',
  'extract-record-relief-case',
  'member-focus-guidance',
  'render-document',
  'extract-credit-report',
  'stripe-webhook',
  'create-fasttrack-payment',
  'store-subscription-webhook',
  'claim-correctional-transition',
];

const results = [];
for (const name of repoFunctions) {
  results.push(await probe(name));
}

const byName = Object.fromEntries(results.map((r) => [r.name, r]));
const critical = mobileCritical.map((n) => ({ name: n, inRepo: repoFunctions.includes(n), ...byName[n] }));

const summary = {
  generatedAt: new Date().toISOString(),
  projectRef: DEV_REF,
  repoFunctionCount: repoFunctions.length,
  deployedCount: results.filter((r) => r.deployed).length,
  notDeployed: results.filter((r) => !r.deployed).map((r) => r.name),
  critical,
  results,
};

fs.writeFileSync('qa-dev-edge-inventory-results.json', JSON.stringify(summary, null, 2));
console.log(`Edge inventory: ${summary.deployedCount}/${repoFunctions.length} names returned non-404 on DEV.`);
console.log('Not deployed on DEV:', summary.notDeployed.join(', ') || '(none)');
const criticalGaps = critical.filter((c) => c.inRepo && c.deployed === false).map((c) => c.name);
if (criticalGaps.length) console.log('CRITICAL mobile gaps (404 on DEV):', criticalGaps.join(', '));
process.exit(0);
