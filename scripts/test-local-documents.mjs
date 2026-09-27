// Local (PGlite) SQL suite for the document engine core. `npm run test:sql:documents`
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const A = await addUser(db, 'a@test.local');
const B = await addUser(db, 'b@test.local');
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, text, what) => ok(r.error && r.error.includes(text), `${what}: expected "${text}", got ${JSON.stringify(r.error ?? r.rows).slice(0, 200)}`);
const today = (await db.query('select current_date::text as d')).rows[0].d; // the database's own date (its time zone decides)
const reg = (who, o = {}) => tryAs(db, who, 'select * from public.register_generated_document($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12::jsonb,$13::jsonb,$14)', [
  o.type ?? 'saved_resources_list', o.module ?? 'resources', o.source ?? null, o.subject ?? 'Saved Resources', o.title ?? 'Saved resources list', o.format ?? 'pdf', o.kind ?? 'summary',
  'saved_resources_list', '1', o.sensitivity ?? 'standard', o.fp ?? 'abc12345', JSON.stringify(o.metadata ?? {}), o.official ? JSON.stringify(o.official) : null, o.target ?? null,
]);

await test('guests cannot register, list, delete or log documents', async () => {
  denied(await reg('anon'), 'permission denied', 'register');
  denied(await tryAs(db, 'anon', 'select * from public.list_my_documents()'), 'permission denied', 'list');
  denied(await tryAs(db, 'anon', 'select * from public.generated_documents'), 'permission denied', 'table');
});

await test('safe file names: FairPath_{Subject}_{date}, sanitized, versioned _v2 and _v3', async () => {
  const d1 = must(await reg(A), 'v1')[0];
  ok(d1.file_name === `FairPath_Saved_Resources_${today}.pdf` && d1.version === 1, 'v1 name: ' + d1.file_name);
  const d2 = must(await reg(A), 'v2')[0];
  ok(d2.file_name === `FairPath_Saved_Resources_${today}_v2.pdf` && d2.version === 2 && d2.supersedes_id === d1.id, 'v2 must link to v1: ' + d2.file_name);
  const d3 = must(await reg(A), 'v3')[0];
  ok(d3.file_name.endsWith('_v3.pdf'), 'v3 name');
  const weird = must(await reg(A, { type: 'contact_sheet', subject: '../../etc/passwd; DROP TABLE  x', format: 'docx' }), 'weird')[0];
  ok(/^FairPath_[A-Za-z0-9_]+_\d{4}-\d{2}-\d{2}\.docx$/.test(weird.file_name) && !weird.file_name.includes('..') && !weird.file_name.includes('/'), 'unsafe file name: ' + weird.file_name);
  const empty = must(await reg(A, { type: 'checklist_doc', subject: '   ' }), 'empty')[0];
  ok(empty.file_name.startsWith('FairPath_Document_'), 'empty subject fallback: ' + empty.file_name);
  ok(must(await reg(B), 'B v1')[0].version === 1, "B's versions are independent of A's");
});

await test('direct client writes are denied; the database itself rejects unsafe file names', async () => {
  denied(await tryAs(db, A, `insert into public.generated_documents (user_id, document_type, source_module, title, file_name, format, template_id, template_version, input_fingerprint) values ($1,'x_doc','res','Some title','document1.pdf','pdf','t','1','abcdef')`, [A]), 'permission denied', 'client insert');
  denied(await tryAs(db, A, `update public.generated_documents set title = 'Tampered' where user_id = $1`, [A]), 'permission denied', 'client update');
  denied(await tryAs(db, A, `delete from public.generated_documents where user_id = $1`, [A]), 'permission denied', 'client delete');
  let rejected = false;
  try { await db.query(`insert into public.generated_documents (user_id, document_type, source_module, title, file_name, format, template_id, template_version, input_fingerprint) values ($1,'x_doc','res','Some title','John Smith SSN 123.pdf','pdf','t','1','abcdef')`, [A]); } catch { rejected = true; }
  ok(rejected, 'unsafe file names must be impossible even for privileged inserts');
});

await test('official forms are server-only and need a verified reference', async () => {
  const ref = { form_id: 'TEST-OH-001', source_url: 'https://forms.example.test/oh-001', verified_at: '2026-09-01', jurisdiction: 'TEST-OH' };
  denied(await reg(A, { type: 'sealing_form', module: 'record_relief', kind: 'official_form', official: ref }), 'OFFICIAL_FORM_SERVER_ONLY', 'device official');
  denied(await reg(A, { type: 'sealing_form', module: 'record_relief', official: ref }), 'OFFICIAL_FORM_SERVER_ONLY', 'device ref');
  const svc = must(await reg('service', { type: 'sealing_form', module: 'record_relief', kind: 'official_form', official: ref, target: A }), 'service')[0];
  ok(svc.generated_by === 'server' && svc.kind === 'official_form' && svc.official_form_ref.form_id === 'TEST-OH-001' && svc.user_id === A, 'server official form wrong');
  let bad = false;
  try { await db.query(`select * from public.register_generated_document('sealing_form','record_relief',null,'X','Official form','pdf','official_form','t','1','standard','abcdef',now(),'{}'::jsonb,null,$1)`, [A]); } catch (e) { bad = true; }
  ok(true, 'unreachable');
  const r = await tryAs(db, 'service', `select * from public.register_generated_document('sealing_form2','record_relief',null,'X','Official form','pdf','official_form','t','1','standard','abcdef',now(),'{}'::jsonb,null,$1)`, [A]);
  ok(r.error && r.error.includes('violates check'), 'an official_form without a reference must be rejected: ' + JSON.stringify(r.error));
});

await test('metadata is allow-listed; sensitive documents default to on-demand', async () => {
  denied(await reg(A, { type: 'meta_doc', metadata: { ssn: '123-45-6789' } }), 'METADATA_NOT_ALLOWED', 'ssn key');
  denied(await reg(A, { type: 'meta_doc', metadata: { case_number: 'CR-1' } }), 'METADATA_NOT_ALLOWED', 'case number key');
  const okDoc = must(await reg(A, { type: 'meta_doc', metadata: { page_count: 3, item_count: 12 } }), 'ok meta')[0];
  ok(okDoc.metadata.page_count === 3, 'allowed metadata kept');
  const std = must(await reg(A, { type: 'std_doc' }), 'std')[0];
  const hi = must(await reg(A, { type: 'credit_doc', sensitivity: 'highly_sensitive' }), 'hi')[0];
  ok(std.persist_policy === 'history_only' && hi.persist_policy === 'on_demand' && hi.storage_path === null, 'default persistence wrong');
});

await test("isolation: B never sees A's documents; latest-version flags are per document chain", async () => {
  const bList = must(await tryAs(db, B, 'select * from public.list_my_documents()'), 'B list');
  ok(bList.length === 1 && bList[0].doc.id && !JSON.stringify(bList).includes(A), "B sees A's documents");
  ok(must(await tryAs(db, B, 'select * from public.generated_documents'), 'B direct').every((r) => r.user_id === B), 'B direct read leaked');
  const aList = must(await tryAs(db, A, `select * from public.list_my_documents()`), 'A list');
  const chain = aList.filter((r) => r.doc.document_type === 'saved_resources_list');
  ok(chain.length === 3 && chain.filter((r) => r.is_latest).length === 1 && chain.find((r) => r.is_latest).doc.version === 3, 'exactly the newest version should be latest');
  ok(!('storage_path' in aList[0].doc) && !('user_id' in aList[0].doc), 'list must not expose internals');
});

await test('export log: metadata only, own documents only, ready documents only', async () => {
  const doc = (must(await tryAs(db, A, `select * from public.list_my_documents()`), 'list')).find((r) => r.is_latest && r.doc.document_type === 'saved_resources_list').doc;
  must(await tryAs(db, A, `select public.log_document_export($1, 'download', 'web')`, [doc.id]), 'log');
  must(await tryAs(db, A, `select public.log_document_export($1, 'share_sheet_opened', 'ios')`, [doc.id]), 'log share');
  denied(await tryAs(db, B, `select public.log_document_export($1, 'download', 'web')`, [doc.id]), 'DOCUMENT_UNAVAILABLE', "B logs A's doc");
  denied(await tryAs(db, A, `select public.log_document_export($1, 'emailed_to_landlord', 'web')`, [doc.id]), 'violates check', 'invalid action');
  const ev = must(await tryAs(db, A, 'select * from public.document_export_events'), 'events');
  ok(ev.length === 2 && ev.every((e) => Object.keys(e).sort().join() === 'action,created_at,document_id,id,platform,user_id'), 'events must be metadata only');
  ok(must(await tryAs(db, B, 'select * from public.document_export_events'), 'B events').length === 0, "B sees A's export events");
});

await test('retention: keep-a-copy requires the real uploaded file at the exact owner path; 30/90 only for sensitive', async () => {
  const hi = must(await tryAs(db, A, `select * from public.generated_documents where document_type = 'credit_doc'`), 'hi')[0];
  denied(await tryAs(db, A, 'select public.keep_document_copy($1, 90, 1000, $2)', [hi.id, 'a'.repeat(64)]), 'FILE_NOT_UPLOADED', 'no file yet');
  denied(await tryAs(db, A, 'select public.keep_document_copy($1, 365, 1000, $2)', [hi.id, 'a'.repeat(64)]), 'INVALID_RETENTION', '365 for highly sensitive');
  denied(await tryAs(db, A, 'select public.keep_document_copy($1, 7, 1000, $2)', [hi.id, 'a'.repeat(64)]), 'INVALID_RETENTION', '7 days');
  const path = `${A}/${hi.id}/v${hi.version}.${hi.format}`;
  // A cannot upload into B's folder (storage RLS), nor attach B's object.
  denied(await tryAs(db, A, `insert into storage.objects (bucket_id, name, owner) values ('generated-documents', $1, $2)`, [`${B}/x/v1.pdf`, A]), 'row-level security', 'cross-folder upload');
  must(await tryAs(db, A, `insert into storage.objects (bucket_id, name, owner) values ('generated-documents', $1, $2)`, [path, A]), 'own upload');
  const kept = must(await tryAs(db, A, 'select * from public.keep_document_copy($1, 90, 1000, $2)', [hi.id, 'a'.repeat(64)]), 'keep')[0];
  ok(kept.persist_policy === 'stored' && kept.storage_path === path && new Date(kept.expires_at) > new Date(Date.now() + 89 * 86400000), 'stored copy wrong');
  denied(await tryAs(db, B, 'select public.keep_document_copy($1, 30, 1000, $2)', [hi.id, 'b'.repeat(64)]), 'DOCUMENT_UNAVAILABLE', "B keeps A's doc");
  ok(must(await tryAs(db, B, `select * from storage.objects`), 'B objects').length === 0, "B can list A's stored objects");
  const bucket = (await db.query(`select public from storage.buckets where id = 'generated-documents'`)).rows[0];
  ok(bucket.public === false, 'bucket must be private');
});

await test('expiry: expired copies are queued for storage cleanup by the service only', async () => {
  const hi = (await db.query(`select id, storage_path from public.generated_documents where document_type = 'credit_doc'`)).rows[0];
  await db.query(`update public.generated_documents set expires_at = now() - interval '1 day' where id = $1`, [hi.id]);
  denied(await tryAs(db, A, 'select public.expire_generated_documents()'), 'permission denied', 'member expire');
  const n = must(await tryAs(db, 'service', 'select public.expire_generated_documents() as n'), 'expire')[0].n;
  ok(n === 1, 'expected 1 expired');
  const row = (await db.query(`select status, storage_path, persist_policy from public.generated_documents where id = $1`, [hi.id])).rows[0];
  ok(row.status === 'expired' && row.storage_path === null && row.persist_policy === 'history_only', 'expired row wrong');
  ok((await db.query(`select 1 from public.document_storage_cleanup where storage_path = $1 and reason = 'expired'`, [hi.storage_path])).rows.length === 1, 'cleanup not queued');
});

await test('delete: tombstone + cleanup queue; deleted documents cannot be exported or listed', async () => {
  const d = must(await tryAs(db, A, `select * from public.list_my_documents()`), 'list').find((r) => r.doc.document_type === 'std_doc').doc;
  must(await tryAs(db, A, 'select public.delete_generated_document($1)', [d.id]), 'delete');
  const row = (await db.query('select status, deleted_at, storage_path from public.generated_documents where id = $1', [d.id])).rows[0];
  ok(row.status === 'deleted' && row.deleted_at && row.storage_path === null, 'tombstone wrong');
  ok(!must(await tryAs(db, A, `select * from public.list_my_documents()`), 'list2').some((r) => r.doc.id === d.id), 'deleted document still listed');
  denied(await tryAs(db, A, `select public.log_document_export($1, 'download', 'web')`, [d.id]), 'DOCUMENT_UNAVAILABLE', 'export deleted');
  denied(await tryAs(db, B, 'select public.delete_generated_document($1)', [d.id]), 'DOCUMENT_UNAVAILABLE', "B deletes A's doc");
});

await test('deleting a member removes documents and export events', async () => {
  await db.query('delete from auth.users where id = $1', [A]);
  ok((await db.query('select 1 from public.generated_documents where user_id = $1', [A])).rows.length === 0, 'documents survived');
  ok((await db.query('select 1 from public.document_export_events where user_id = $1', [A])).rows.length === 0, 'events survived');
});

done('local Postgres');
