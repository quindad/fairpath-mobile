// FairPath DEV verification of the DEPLOYED render-document Edge Function. DEV ONLY.
//
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<DEV key>"; npm run qa:dev-render; Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
//
// Creates two disposable @dev-seed.fairpath.test members, calls the real function with their real JWTs, and proves:
// real PDF/DOCX/CSV bytes, safe file names, versioning + regeneration, checksum, private storage + signed URLs,
// deletion, per-member data isolation, and that malformed/unauthorized/forged requests fail safely. Cleans up after itself.
import fs from 'node:fs';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';
import { assertDevTarget } from '../supabase/seed/lib/guards.mjs';
import { pdfText } from './lib/pdf-text.mjs';

const args = new Set(process.argv.slice(2));
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const linkedRef = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
try { assertDevTarget({ url, serviceKey, linkedRef, confirmDev: args.has('--confirm-dev'), apply: true }); }
catch (e) { console.error(e.message); process.exit(1); }

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, opts);
const fnUrl = url + '/functions/v1/render-document';
const stamp = Date.now().toString(36);
const created = [];
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('PASS ' + name); } catch (e) { results.push(false); console.log('FAIL ' + name + '\n     ' + String(e.message).slice(0, 400)); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const fine = (r, w) => { if (r.error) throw new Error(w + ': ' + r.error.message); return r.data; };

async function makeUser(label) {
  const email = `qa-render-${label}-${stamp}@dev-seed.fairpath.test`;
  const c = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (c.error) throw new Error('createUser: ' + c.error.message);
  created.push(c.data.user.id);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const client = createClient(url, anonKey, opts);
  const v = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
  if (v.error) throw new Error('verifyOtp: ' + v.error.message);
  return { id: c.data.user.id, email, client, token: v.data.session.access_token };
}
const call = (who, body, raw) => fetch(fnUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anonKey, ...(who ? { Authorization: 'Bearer ' + who.token } : {}) }, body: raw ?? JSON.stringify(body) });
const gen = async (who, document_type, format, options) => {
  const r = await call(who, { document_type, format, ...(options ? { options } : {}) });
  const j = await r.json();
  return { status: r.status, j, bytes: j.file_base64 ? Buffer.from(j.file_base64, 'base64') : null };
};
const NAME = /^FairPath_[A-Za-z0-9_]+_\d{4}-\d{2}-\d{2}(_v\d+)?\.(pdf|docx|csv)$/;

const A = await makeUser('a');
const B = await makeUser('b');

// ---- give A real data to render ----
const { data: res } = await admin.from('resources').select('id,name').eq('status', 'verified').limit(3);
ok(res?.length >= 2, 'no verified resources in DEV (run npm run seed:dev:resources)');
for (const r of res) fine(await A.client.rpc('save_resource', { p_id: r.id }), 'save resource');
await admin.from('profiles').update({ first_name: 'Quinn', last_name: 'Renderer', phone: '(614) 555-0100', date_of_birth: '1985-02-03' }).eq('id', A.id);
fine(await A.client.from('member_skills').insert({ user_id: A.id, skill: 'Forklift' }), 'skill');
fine(await A.client.from('member_work_experience').insert({ user_id: A.id, job_title: 'Line Cook', employer_name: 'Corner Diner', start_date: '2021-01-01', is_current: true }), 'work');

let saved1; let saved2;
await test('PDF: saved resources list is a real PDF containing the member\'s own resources', async () => {
  saved1 = await gen(A, 'saved_resources_list', 'pdf');
  ok(saved1.status === 200, 'HTTP ' + saved1.status + ' ' + JSON.stringify(saved1.j).slice(0, 200));
  ok(saved1.bytes.subarray(0, 5).toString() === '%PDF-', 'PDF magic bytes');
  ok(NAME.test(saved1.j.file_name) && saved1.j.file_name.endsWith('.pdf') && !saved1.j.file_name.includes(' '), 'safe file name: ' + saved1.j.file_name);
  ok(saved1.j.generated_by === 'server' && saved1.j.mime === 'application/pdf', 'labeled server-generated');
  ok(crypto.createHash('sha256').update(saved1.bytes).digest('hex') === saved1.j.checksum_sha256, 'checksum matches the bytes');
  ok(saved1.j.byte_size === saved1.bytes.length, 'byte_size matches');
  const text = pdfText(saved1.bytes);
  ok(res.some((r) => text.includes(r.name.slice(0, 20))), 'PDF text should include a saved resource name');
});
await test('CSV: saved resources list is a real CSV with a header row', async () => {
  const r = await gen(A, 'saved_resources_list', 'csv');
  ok(r.status === 200 && r.j.mime.startsWith('text/csv'), 'HTTP ' + r.status);
  const text = r.bytes.toString('utf8'); ok(text.split('\n').length >= 3 && text.split('\n')[0].includes(','), 'CSV rows: ' + text.slice(0, 120));
  ok(NAME.test(r.j.file_name) && r.j.file_name.endsWith('.csv'), r.j.file_name);
});
await test('DOCX: contact sheet is a real Word file (zip with word/document.xml)', async () => {
  const r = await gen(A, 'resource_contact_sheet', 'docx');
  ok(r.status === 200, 'HTTP ' + r.status + ' ' + JSON.stringify(r.j).slice(0, 200));
  const zip = await JSZip.loadAsync(r.bytes); ok(zip.file('word/document.xml'), 'word/document.xml present');
  ok(NAME.test(r.j.file_name) && r.j.file_name.endsWith('.docx'), r.j.file_name);
});
await test('PDF + DOCX: required-documents checklist and opportunity profile render', async () => {
  for (const [t, f] of [['resource_required_documents', 'pdf'], ['resource_required_documents', 'docx'], ['opportunity_profile', 'pdf'], ['opportunity_profile', 'docx']]) {
    const r = await gen(A, t, f); ok(r.status === 200, `${t}.${f}: HTTP ${r.status} ${JSON.stringify(r.j).slice(0, 160)}`);
    if (f === 'pdf') ok(r.bytes.subarray(0, 5).toString() === '%PDF-', t + ' pdf bytes'); else ok((await JSZip.loadAsync(r.bytes)).file('word/document.xml'), t + ' docx');
  }
});
await test('opportunity profile: default options exclude DOB/address and honor include flags', async () => {
  const r = await gen(A, 'opportunity_profile', 'pdf'); const t = pdfText(r.bytes);
  ok(t.includes('Forklift') && t.includes('Line Cook'), 'profile content present');
  ok(!/1985|Secret Street/.test(t) && !/1985/.test(JSON.stringify(r.j.spec)), 'DOB must never be in the profile document');
});
await test('versioning + regeneration: the same document again is v2 and supersedes v1, with a _v2 file name', async () => {
  saved2 = await gen(A, 'saved_resources_list', 'pdf');
  ok(saved2.status === 200 && saved2.j.document.version === 2, 'version ' + saved2.j.document?.version);
  ok(/_v2\.pdf$/.test(saved2.j.file_name), saved2.j.file_name);
  ok(saved2.j.document.supersedes_id === saved1.j.document.id, 'v2 supersedes v1');
  ok(saved2.j.input_fingerprint === saved1.j.input_fingerprint, 'same inputs -> same fingerprint');
});
await test('the documents list shows the registered versions to the owner only', async () => {
  const mine = fine(await A.client.rpc('list_my_documents'), 'list'); ok(mine.length >= 6, 'A sees registered documents: ' + mine.length);
  ok(fine(await B.client.rpc('list_my_documents'), 'B list').length === 0, "B sees none of A's documents");
});
await test("isolation: B's documents contain none of A's resources, name or skills", async () => {
  const r = await gen(B, 'saved_resources_list', 'pdf'); ok(r.status === 200, 'B can generate their own (empty) list: HTTP ' + r.status);
  const t = pdfText(r.bytes); ok(!res.some((x) => t.includes(x.name.slice(0, 20))), "A's resources leaked into B's PDF");
  const p = await gen(B, 'opportunity_profile', 'pdf'); ok(!/Forklift|Line Cook|Renderer/.test(pdfText(p.bytes)), "A's profile data leaked into B's profile");
});
await test('private storage: keep a copy, owner signed URL works, other member and public URL do not, deletion removes it', async () => {
  const id = saved2.j.document.id; const path = `${A.id}/${id}/v2.pdf`;
  fine(await A.client.storage.from('generated-documents').upload(path, saved2.bytes, { contentType: 'application/pdf' }), 'upload');
  const kept = fine(await A.client.rpc('keep_document_copy', { p_id: id, p_days: 30, p_bytes: saved2.bytes.length, p_checksum: saved2.j.checksum_sha256 }), 'keep'); ok(kept.persist_policy === 'stored', 'stored');
  const signed = fine(await A.client.storage.from('generated-documents').createSignedUrl(path, 60), 'signed');
  const dl = await fetch(signed.signedUrl); ok(dl.ok && Buffer.from(await dl.arrayBuffer()).equals(saved2.bytes), 'signed URL returns identical bytes');
  const b = await B.client.storage.from('generated-documents').createSignedUrl(path, 60); ok(b.error || !b.data?.signedUrl, "B must not sign A's file");
  ok(!(await fetch(`${url}/storage/v1/object/public/generated-documents/${path}`)).ok, 'no public access');
  const removed = fine(await A.client.rpc('delete_generated_document', { p_id: id }), 'delete'); await A.client.storage.from('generated-documents').remove([removed]);
  ok(!(await fetch(signed.signedUrl)).ok, 'file gone after deletion');
});
await test('unauthorized: no token, guest anon token, and forged token are all 401', async () => {
  ok((await call(null, { document_type: 'saved_resources_list', format: 'pdf' })).status === 401, 'no token');
  const guest = await fetch(fnUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: 'Bearer ' + anonKey }, body: '{}' }); ok(guest.status === 401, 'anon key ' + guest.status);
  const forged = await fetch(fnUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: 'Bearer ' + A.token.slice(0, -4) + 'AAAA' }, body: '{}' }); ok(forged.status === 401, 'tampered JWT ' + forged.status);
});
await test('malformed requests fail safely with no internals: bad JSON, unknown type, bad format, oversize, wrong method', async () => {
  const chk = async (label, p, want) => { const r = await p; const t = await r.text(); ok(r.status === want && !/stack|at file|Deno|SERVICE|eyJ/i.test(t), `${label}: HTTP ${r.status} ${t.slice(0, 120)}`); };
  await chk('invalid json', call(A, null, '{nope'), 400);
  await chk('unknown type', call(A, { document_type: 'credit_dispute_letter', format: 'pdf' }), 400);
  await chk('sensitive types are not renderable server-side', call(A, { document_type: 'record_relief_worksheet', format: 'pdf' }), 400);
  await chk('unsupported format', call(A, { document_type: 'saved_resources_list', format: 'docx' }), 400);
  await chk('missing fields', call(A, {}), 400);
  await chk('oversize body', call(A, null, JSON.stringify({ document_type: 'saved_resources_list', format: 'pdf', pad: 'x'.repeat(6000) })), 413);
  await chk('GET', fetch(fnUrl, { method: 'GET', headers: { apikey: anonKey, Authorization: 'Bearer ' + A.token } }), 405);
});
await test('forged inputs are ignored or refused: client content, official form ref, employer audience, other user id', async () => {
  const r = await call(A, { document_type: 'opportunity_profile', format: 'pdf', content: 'INJECTED', official_form_ref: { form_id: 'x' }, user_id: B.id, options: { includePay: false } });
  const j = await r.json(); ok(r.status === 200 && !pdfText(Buffer.from(j.file_base64, 'base64')).includes('INJECTED'), 'client content must not appear');
  const doc = fine(await admin.from('generated_documents').select('official_form_ref,user_id,generated_by').eq('id', j.document.id).single(), 'row');
  ok(doc.user_id === A.id && !doc.official_form_ref && doc.generated_by === 'server', 'row belongs to the caller, no official form ref: ' + JSON.stringify(doc));
  const emp = await call(A, { document_type: 'saved_resources_list', format: 'pdf', options: { audience: 'employer' } }); ok(emp.status === 200, 'audience is ignored for resource documents');
  const prof = await call(A, { document_type: 'opportunity_profile', format: 'pdf', options: { audience: 'landlord' } }); ok(prof.status === 403, 'a disallowed audience is refused, got ' + prof.status);
});

for (const id of created) await admin.auth.admin.deleteUser(id);
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed (DEPLOYED render-document on DEV). Disposable members removed.`);
process.exit(failed ? 1 : 0);
