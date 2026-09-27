// FairPath DEV verification for the Profile / Documents / Credit / Record Relief / AI / reminders pass. DEV ONLY.
//
//   1. npx supabase db push                     (applies migrations 20261001130000 .. 20261001190000)
//   2. $env:SUPABASE_SERVICE_ROLE_KEY = "<DEV key>"
//      npm run seed:dev:relief                  (TEST rules/forms/pathways; resources fixtures come from seed:dev:resources)
//      npm run qa:dev-pass2
//      Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
//
// What it proves on the REAL DEV project (real Auth, RLS, grants, and Storage), which the local Postgres suites cannot:
// owner isolation through PostgREST, the employer-safe application snapshot, document versioning + private storage +
// short-lived signed URLs, credit private uploads and sample data, record-relief evaluation, summary, AI provenance
// validation, deletion requests and the reminder job. It creates disposable @dev-seed.fairpath.test users and deletes
// them (cascade) at the end. Nothing touches production, Stripe, or any real payment method.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { assertDevTarget } from '../supabase/seed/lib/guards.mjs';
import { rid } from '../supabase/seed/data/resources-fixtures.mjs';

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
const anon = createClient(url, anonKey, opts);
const stamp = Date.now().toString(36);
const created = [];
const results = [];

async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('FAIL ' + name + '\n     ' + String(e.message).slice(0, 400)); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const has = (r, text) => ok(r.error && (r.error.message + (r.error.code ?? '')).includes(text), `expected error containing "${text}", got ${JSON.stringify(r.error)?.slice(0, 200)}`);
const fine = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

async function makeUser(label, metadata = {}) {
  const email = `qa-p2-${label}-${stamp}@dev-seed.fairpath.test`;
  const c = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: metadata });
  if (c.error) throw new Error('createUser: ' + c.error.message);
  const id = c.data.user.id;
  created.push(id);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const client = createClient(url, anonKey, opts);
  const v = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
  if (v.error) throw new Error('verifyOtp: ' + v.error.message);
  return { id, email, client };
}

const A = await makeUser('a');
const B = await makeUser('b');
const bytes = new TextEncoder().encode('%PDF-1.4 dev qa file');

await test('migrations are applied (new tables exist)', async () => {
  for (const t of ['member_skills', 'generated_documents', 'credit_reports', 'record_relief_cases', 'ai_interactions', 'account_deletion_requests']) {
    const r = await admin.from(t).select('*', { count: 'exact', head: true });
    ok(!r.error, `${t} missing: ${r.error?.message}. Run npx supabase db push first.`);
  }
});

await test('opportunity profile: owner-only through PostgREST; validation; guests denied', async () => {
  fine(await A.client.from('member_skills').insert({ user_id: A.id, skill: 'Forklift' }), 'insert');
  ok((await B.client.from('member_skills').select('*')).data.length === 0, "B reads A's skills");
  has(await B.client.from('member_skills').insert({ user_id: A.id, skill: 'Sneaky' }), 'row-level security');
  has(await A.client.from('member_work_experience').insert({ user_id: A.id, job_title: 'Cook', employer_name: 'Diner', start_date: '2020-01-01', end_date: '2019-01-01', is_current: false }), 'check');
  ok((await anon.from('member_skills').select('*')).error, 'guest must be denied');
  const c = fine(await A.client.rpc('get_opportunity_completion'), 'completion');
  ok(c.length === 8 && c.every((x) => x.is_complete === false || x.section_key === 'skills' === false), 'eight sections, real state');
});

// ---- application snapshot (jobs may carry required employer questions, so the payload answers every one of them) ----
const snap = { jobs: [], apps: {} };
const employerAnswers = (job) => Object.fromEntries((job.application_questions ?? []).filter((q) => q?.id).map((q) => [q.id, 'Yes']));
const applyPayload = (job, extra = {}) => ({
  profile: { first_name: 'Quinn', last_name: 'Tester', email: A.email, phone: '(614) 555-0100', current_address: '123 Secret Street', date_of_birth: '1985-02-03' },
  employer_questions: employerAnswers(job), ...extra,
});

await test('snapshot: setup (two Easy Apply jobs; profile with skills and private fields)', async () => {
  const jobsQ = await admin.from('jobs').select('id,application_questions').eq('status', 'published').eq('application_method', 'fairpath').eq('easy_apply_enabled', true).limit(2);
  if (jobsQ.error) throw new Error('jobs query failed: ' + jobsQ.error.message);
  const jobs = jobsQ.data;
  ok(jobs?.length === 2, 'need two Easy Apply jobs in DEV inventory (run npm run seed:dev)');
  snap.jobs = jobs;
  await admin.from('profiles').update({ first_name: 'Quinn', last_name: 'Tester', phone: '(614) 555-0100', date_of_birth: '1985-02-03' }).eq('id', A.id);
  fine(await A.client.from('member_skills').insert([{ user_id: A.id, skill: 'Inventory' }, { user_id: A.id, skill: 'Teamwork' }]), 'skills');
});

await test('snapshot: required employer questions are still enforced (unanswered -> INVALID_APPLICATION:question:<id>)', async () => {
  const withQ = snap.jobs.find((j) => (j.application_questions ?? []).some((q) => q?.required));
  if (!withQ) return console.log('     (no DEV job has a required question; enforcement is covered by the local suite)');
  has(await A.client.rpc('submit_job_application', { p_job_id: withQ.id, p_answers: { ...applyPayload(withQ), employer_questions: {} } }), 'INVALID_APPLICATION:question:');
});

await test('snapshot: a valid first application succeeds when NOT opted in, and stores no snapshot (a forged one is ignored)', async () => {
  const job = snap.jobs[0];
  const id = fine(await A.client.rpc('submit_job_application', { p_job_id: job.id, p_answers: applyPayload(job, { share_opportunity_profile: false, opportunity_snapshot: { skills: ['FORGED'] } }) }), 'apply (no opt-in)');
  const appQ = await admin.from('job_applications').select('answers').eq('id', id).single();
  if (appQ.error) throw new Error('application row query failed: ' + appQ.error.message);
  const app = appQ.data;
  snap.apps.plain = app.answers;
  ok(app.answers.opportunity_snapshot === undefined && !JSON.stringify(app.answers).includes('FORGED'), 'no snapshot without opt-in: ' + JSON.stringify(app.answers).slice(0, 200));
});

await test('snapshot: duplicate application is rejected with ALREADY_APPLIED and creates no second row', async () => {
  const job = snap.jobs[0];
  has(await A.client.rpc('submit_job_application', { p_job_id: job.id, p_answers: applyPayload(job) }), 'ALREADY_APPLIED');
  const { data } = await admin.from('job_applications').select('id').eq('user_id', A.id).eq('job_id', job.id);
  ok(data.length === 1, 'exactly one application row for the job, got ' + data.length);
});

await test('snapshot: opted in -> built by the server from the member profile, unknown sections dropped, client forgery ignored', async () => {
  const job = snap.jobs[1];
  const id = fine(await A.client.rpc('submit_job_application', { p_job_id: job.id, p_answers: applyPayload(job, { share_opportunity_profile: true, share_sections: ['skills', 'justice_history', 'date_of_birth'], opportunity_snapshot: { skills: ['FORGED'] } }) }), 'apply (opt-in)');
  const appQ = await admin.from('job_applications').select('answers').eq('id', id).single();
  if (appQ.error) throw new Error('application row query failed: ' + appQ.error.message);
  const app = appQ.data;
  snap.apps.shared = app.answers;
  const s = app.answers.opportunity_snapshot;
  ok(s && Array.isArray(s.skills) && s.skills.includes('Forklift') && s.skills.includes('Inventory'), 'skills come from member_skills: ' + JSON.stringify(s).slice(0, 200));
  ok(!JSON.stringify(app.answers).includes('FORGED'), 'client-supplied snapshot content must be ignored');
  ok(JSON.stringify(s.sections) === '["skills"]', 'only allow-listed sections survive, got ' + JSON.stringify(s.sections));
});

await test('snapshot: DOB, street address and justice data never enter the employer-visible answers or snapshot', async () => {
  const text = JSON.stringify(snap.apps);
  ok(!/1985|123 Secret|Secret Street|date_of_birth|current_address/i.test(text), 'private personal fields leaked: ' + text.slice(0, 300));
  ok(!/justice|conviction|record_relief|expunge|sealing|readiness/i.test(JSON.stringify(snap.apps.shared.opportunity_snapshot)), 'justice data in snapshot');
  ok(!/pay|salary|wage/i.test(JSON.stringify(Object.keys(snap.apps.shared.opportunity_snapshot))), 'pay in snapshot');
});


await test('documents: safe file names, versions, private storage, signed URL, delete', async () => {
  const reg = () => A.client.rpc('register_generated_document', { p_document_type: 'saved_resources_list', p_source_module: 'resources', p_source_record_id: null, p_subject: 'Saved Resources', p_title: 'Saved resources', p_format: 'pdf', p_kind: 'summary', p_template_id: 'saved_resources_list', p_template_version: '1', p_sensitivity: 'standard', p_input_fingerprint: 'abc12345', p_confirmed_data_at: new Date().toISOString(), p_metadata: {}, p_official_form_ref: null, p_target_user: null });
  const d1 = fine(await reg(), 'v1'); const d2 = fine(await reg(), 'v2');
  ok(/^FairPath_Saved_Resources_\d{4}-\d{2}-\d{2}\.pdf$/.test(d1.file_name) && d2.version === 2 && /_v2\.pdf$/.test(d2.file_name) && d2.supersedes_id === d1.id, 'names/versions: ' + d1.file_name + ' ' + d2.file_name);
  has(await A.client.rpc('register_generated_document', { p_document_type: 'sealing_form', p_source_module: 'record_relief', p_source_record_id: null, p_subject: 'X', p_title: 'Official form', p_format: 'pdf', p_kind: 'official_form', p_template_id: 't', p_template_version: '1', p_sensitivity: 'sensitive', p_input_fingerprint: 'abc12345', p_confirmed_data_at: new Date().toISOString(), p_metadata: {}, p_official_form_ref: { form_id: 'x', source_url: 'https://x.test', verified_at: '2026-01-01' }, p_target_user: null }), 'OFFICIAL_FORM_SERVER_ONLY');
  const path = `${A.id}/${d2.id}/v2.pdf`;
  fine(await A.client.storage.from('generated-documents').upload(path, bytes, { contentType: 'application/pdf' }), 'upload');
  has(await B.client.storage.from('generated-documents').upload(`${A.id}/${d2.id}/hack.pdf`, bytes, { contentType: 'application/pdf' }), 'row-level');
  const kept = fine(await A.client.rpc('keep_document_copy', { p_id: d2.id, p_days: 30, p_bytes: bytes.length, p_checksum: 'a'.repeat(64) }), 'keep');
  ok(kept.persist_policy === 'stored' && kept.storage_path === path, 'kept');
  const signed = fine(await A.client.storage.from('generated-documents').createSignedUrl(path, 60), 'signed');
  const good = await fetch(signed.signedUrl); ok(good.ok, 'owner signed URL should download');
  const blocked = await B.client.storage.from('generated-documents').createSignedUrl(path, 60); ok(blocked.error || !blocked.data?.signedUrl, "B must not get a signed URL for A's file");
  const pub = await fetch(`${url}/storage/v1/object/public/generated-documents/${path}`); ok(!pub.ok, 'a private bucket must not serve public URLs');
  ok((await B.client.rpc('list_my_documents')).data.length === 0, "B lists A's documents");
  const removed = fine(await A.client.rpc('delete_generated_document', { p_id: d2.id }), 'delete');
  ok(removed === path, 'delete returns the path to remove');
  await A.client.storage.from('generated-documents').remove([path]);
  const after = await fetch(signed.signedUrl); ok(!after.ok, 'the file must be gone after deletion');
});

await test('credit: sample data (dev only), rules, stages, disputes, private uploads', async () => {
  ok((await anon.rpc('load_credit_sample_report')).error, 'guest cannot load samples');
  fine(await A.client.rpc('load_credit_sample_report'), 'load sample');
  const items = fine(await A.client.from('credit_review_items').select('id,stage,issue_type'), 'items');
  ok(items.some((i) => i.issue_type === 'duplicate_account') && items.some((i) => i.issue_type === 'conflicting_balance') && items.every((i) => ['negative_item', 'possible_inaccuracy'].includes(i.stage)), 'rules flagged items, none disputed automatically');
  ok((await B.client.from('credit_review_items').select('id')).data.length === 0, "B reads A's credit items");
  const neg = items.find((i) => i.issue_type === 'negative_item');
  has(await A.client.rpc('set_credit_item_stage', { p_item: neg.id, p_stage: 'confirmed_dispute_issue', p_statement: 'I say so' }), 'INVALID_TRANSITION');
  has(await A.client.from('credit_review_items').update({ stage: 'confirmed_dispute_issue' }).eq('id', neg.id), 'permission denied');
  fine(await A.client.rpc('set_credit_item_stage', { p_item: neg.id, p_stage: 'member_disputes_accuracy', p_statement: 'The balance is higher than my statement says.' }), 'claim');
  fine(await A.client.rpc('set_credit_item_stage', { p_item: neg.id, p_stage: 'confirmed_dispute_issue', p_statement: null }), 'confirm');
  const d = fine(await A.client.rpc('create_credit_dispute', { p_target_kind: 'bureau', p_target_name: 'TransUnion', p_item_ids: [neg.id], p_reason: 'The balance shown is higher than my statements.' }), 'dispute');
  ok(d.status === 'draft', 'draft dispute');
  const upId = crypto.randomUUID(); const upPath = `${A.id}/${upId}/report.pdf`;
  has(await A.client.rpc('register_credit_upload', { p_upload_id: upId, p_bureau: 'experian', p_ext: 'pdf', p_pages: 2, p_bytes: bytes.length, p_mime: 'application/pdf', p_checksum: null }), 'FILE_NOT_UPLOADED');
  fine(await A.client.storage.from('credit-uploads').upload(upPath, bytes, { contentType: 'application/pdf' }), 'credit upload');
  has(await B.client.storage.from('credit-uploads').download(upPath), '');
  const up = fine(await A.client.rpc('register_credit_upload', { p_upload_id: upId, p_bureau: 'experian', p_ext: 'pdf', p_pages: 2, p_bytes: bytes.length, p_mime: 'application/pdf', p_checksum: null }), 'register');
  ok(up.status === 'uploaded', 'registered');
  const path = fine(await A.client.rpc('delete_credit_upload', { p_id: upId }), 'delete'); await A.client.storage.from('credit-uploads').remove([path]);
});

await test('record relief: TEST rules, federal branch, hedged results, isolation', async () => {
  const j = await admin.from('record_relief_jurisdictions').select('code').eq('code', 'TEST-A');
  ok(j.data?.length, 'TEST fixtures missing. Run: npm run seed:dev:relief');
  const yearsAgo = (y) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); return d.toISOString().slice(0, 10); };
  const c = fine(await A.client.rpc('save_record_relief_case', { p_id: null, p: { jurisdiction_code: 'TEST-A', label: 'QA case', offense_class: 'misdemeanor', disposition: 'conviction', sentence_completion_date: yearsAgo(4), fines_paid: true, pending_charges: false } }), 'save');
  const detail = fine(await A.client.rpc('get_record_relief_case_detail', { p_case: c.id }), 'detail');
  ok(detail.evaluations.some((e) => e.outcome === 'potentially_eligible_now' && e.rule.data_origin === 'dev_fixture'), 'hedged outcome from a fixture rule');
  ok(detail.forms.every((f) => f.auto_fillable === false), 'no auto-fill');
  const ohio = fine(await A.client.rpc('save_record_relief_case', { p_id: null, p: { jurisdiction_code: 'US-OH', label: 'Ohio QA' } }), 'ohio');
  ok((await A.client.rpc('get_record_relief_case_detail', { p_case: ohio.id })).data.evaluations[0].outcome === 'rule_unavailable', 'a jurisdiction with no verified rules says so');
  const fed = fine(await A.client.rpc('save_record_relief_case', { p_id: null, p: { jurisdiction_code: 'US-FED', label: 'Fed QA' } }), 'fed');
  ok((await A.client.rpc('get_record_relief_case_detail', { p_case: fed.id })).data.evaluations[0].outcome === 'federal_separate', 'federal is separate');
  has(await B.client.rpc('get_record_relief_case_detail', { p_case: c.id }), 'CASE_UNAVAILABLE');
  ok((await B.client.from('record_relief_cases').select('id')).data.length === 0, "B reads A's cases");
  has(await A.client.from('record_relief_rules').insert({ rule_key: 'forged-rule', jurisdiction_code: 'US-OH', remedy: 'other', title: 'Forged', source_authority: 'statute', source_url: 'https://x.test', citation_text: 'x', effective_from: '2024-01-01' }), 'permission denied');
});

// ---- member summary, privacy, AI provenance, reminders: each reported separately, with actual values on failure ----
const summaryA = { v: null };
await test('summary: get_member_home_summary returns the expected shape for the member', async () => {
  summaryA.v = fine(await A.client.rpc('get_member_home_summary'), 'summary');
  for (const k of ['jobs', 'housing', 'resources', 'profile', 'documents', 'notifications', 'deletion_request', 'credit', 'record_relief']) ok(summaryA.v[k] !== undefined, 'missing section ' + k + '; keys: ' + Object.keys(summaryA.v).join(','));
  ok(summaryA.v.profile.total_sections === 8, 'profile.total_sections = ' + summaryA.v.profile.total_sections);
});
await test('summary: jobs.applied reflects the two real applications', async () => {
  ok(summaryA.v.jobs.applied === 2, 'jobs.applied = ' + summaryA.v.jobs.applied + ' (expected 2)');
});
await test('summary: credit section reflects the loaded sample data', async () => {
  const c = summaryA.v.credit;
  ok(c.reports >= 1 && c.items_to_review >= 1, 'credit = ' + JSON.stringify(c));
});
await test('summary: record_relief.cases reflects the three cases', async () => {
  ok(summaryA.v.record_relief.cases === 3, 'record_relief = ' + JSON.stringify(summaryA.v.record_relief));
});
await test('summary: documents.generated reflects the remaining generated document', async () => {
  ok(summaryA.v.documents.generated >= 1, 'documents = ' + JSON.stringify(summaryA.v.documents));
});
await test("summary: another member's summary is their own; guests are denied", async () => {
  const b = fine(await B.client.rpc('get_member_home_summary'), 'B summary');
  ok(b.jobs.applied === 0 && (b.credit?.reports ?? 0) === 0 && (b.record_relief?.cases ?? 0) === 0, "B sees A's data: " + JSON.stringify([b.jobs, b.credit, b.record_relief]).slice(0, 200));
  ok((await anon.rpc('get_member_home_summary')).error, 'guest must be denied');
});

await test('privacy: deletion request is idempotent while open and is request-only (nothing deleted)', async () => {
  const r1 = fine(await A.client.rpc('request_account_deletion', { p_reason: 'privacy' }), 'request');
  const r2 = fine(await A.client.rpc('request_account_deletion', { p_reason: null }), 'again');
  ok(r1.id === r2.id && r1.status === 'requested', 'idempotent: ' + JSON.stringify([r1, r2]));
  const st = fine(await A.client.rpc('get_account_deletion_status'), 'status');
  ok(st && st.status === 'requested', 'status reads back: ' + JSON.stringify(st));
  const still = await admin.auth.admin.getUserById(A.id); ok(still.data?.user, 'the account still exists');
});
await test('privacy: request can be cancelled, and a second cancel is refused', async () => {
  const c = fine(await A.client.rpc('cancel_account_deletion'), 'cancel'); ok(c.status === 'cancelled', 'cancelled');
  has(await A.client.rpc('cancel_account_deletion'), 'NOT_CANCELLABLE');
});
await test("privacy: another member cannot read A's requests; guests are denied", async () => {
  ok((await B.client.from('account_deletion_requests').select('id')).data.length === 0, "B reads A's request");
  ok((await anon.rpc('request_account_deletion', { p_reason: null })).error, 'guest denied');
});

const aiLog = (o) => A.client.rpc('log_ai_interaction', { p_task: 'navigation', p_intent: 'open_screen', p_engine: 'deterministic_router', p_route: '/me', p_source_refs: [], p_rule_versions: [], p_official_sources: [], p_confidence: 'deterministic', p_confirmation: 'not_required', ...o });
await test('ai provenance: a valid log entry (ids only) is accepted', async () => {
  const id = fine(await aiLog({ p_source_refs: [{ kind: 'credit_item', id: crypto.randomUUID() }] }), 'valid log'); ok(typeof id === 'string', 'returns the row id');
});
await test('ai provenance: content/text in source refs is rejected (INVALID_PROVENANCE)', async () => {
  has(await aiLog({ p_source_refs: [{ kind: 'credit_item', id: 'x', text: 'Metro balance $2650' }] }), 'INVALID_PROVENANCE');
});
await test('ai provenance: an off-app route is rejected by the schema', async () => {
  const r = await aiLog({ p_route: 'https://evil.example' }); ok(r.error, 'expected an error, got ' + JSON.stringify(r.data));
});
await test("ai provenance: ledger is owner-only; history deletion works", async () => {
  ok((await B.client.from('ai_interactions').select('id')).data.length === 0, "B reads A's ledger");
  fine(await A.client.rpc('delete_my_ai_history'), 'delete history');
  ok((await admin.from('ai_interactions').select('id').eq('user_id', A.id)).data.length === 0, 'history removed');
});

await test('reminders: members cannot run the reminder job', async () => {
  const r = await A.client.rpc('generate_member_reminders'); ok(r.error && /permission denied/i.test(r.error.message), 'expected permission denied, got ' + JSON.stringify(r.error));
});
await test('reminders: the service job runs, is deduped on rerun, and produces lock-screen-safe text', async () => {
  const n1 = fine(await admin.rpc('generate_member_reminders'), 'reminder job'); ok(Number.isInteger(n1), 'returns a count, got ' + JSON.stringify(n1));
  const n2 = fine(await admin.rpc('generate_member_reminders'), 'reminder job again'); ok(n2 === 0, 'rerun creates nothing new, got ' + n2);
  const notes = (await admin.from('user_notifications').select('title,body').eq('user_id', A.id)).data;
  ok(!notes.some((x) => /Metro|TransUnion|Experian|Equifax|QA case|Testland|\$\d/i.test(x.title + ' ' + x.body)), 'reminder text names private details: ' + JSON.stringify(notes).slice(0, 200));
});


// ---- cleanup (cascade removes all member data) ----
for (const id of created) await admin.auth.admin.deleteUser(id);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed (DEV, real Auth/RLS/Storage). Disposable members removed.`);
process.exit(failed.length ? 1 : 0);
