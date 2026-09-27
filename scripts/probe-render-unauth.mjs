// Unauthenticated probes of the DEPLOYED render-document function (DEV). Needs only the public anon key from .env.local.
// No service key, no member data, nothing written. `node scripts/probe-render-unauth.mjs`
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!/znvhmuhojvwvjzmaqwff/.test(url)) { console.error('Refusing: .env.local does not point at the DEV project.'); process.exit(1); }
const fn = url + '/functions/v1/render-document';
let failed = 0;
async function probe(name, init, expect) {
  const r = await fetch(fn, init).catch((e) => ({ status: 0, text: async () => String(e) }));
  const text = await r.text();
  const good = expect.includes(r.status) && !/stack|at file:|Deno\.|SUPABASE_|service_role|eyJ/i.test(text);
  if (!good) failed++;
  console.log((good ? 'PASS ' : 'FAIL ') + name + '  -> HTTP ' + r.status + ' ' + text.slice(0, 110));
}
const body = JSON.stringify({ document_type: 'saved_resources_list', format: 'pdf' });
await probe('no Authorization header is rejected', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }, [401]);
await probe('anon key as bearer (guest) is rejected', { method: 'POST', body, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + anon, apikey: anon } }, [401]);
await probe('garbage bearer token is rejected', { method: 'POST', body, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-a-real-token', apikey: anon } }, [401]);
await probe('GET is refused', { method: 'GET', headers: { Authorization: 'Bearer ' + anon, apikey: anon } }, [401, 405]);
await probe('malformed JSON without auth is refused before parsing', { method: 'POST', body: '{nope', headers: { 'Content-Type': 'application/json', apikey: anon } }, [401]);
await probe('oversized body without auth is refused', { method: 'POST', body: 'x'.repeat(50000), headers: { 'Content-Type': 'application/json', apikey: anon } }, [401, 413]);
console.log(failed ? `\n${failed} probe(s) FAILED` : '\nAll unauthenticated probes behaved safely (DEV).');
process.exit(failed ? 1 : 0);
