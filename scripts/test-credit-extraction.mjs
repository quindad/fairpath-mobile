// Tests the credit extraction boundary: the strict validator and the extract-credit-report handler. `npm run test:extraction`
import { validateExtraction, last4Only, MAX_ACCOUNTS } from '../src/core/credit/extraction.ts';
import { handleExtract } from '../supabase/functions/extract-credit-report/handler.ts';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };
const now = new Date('2026-10-04T12:00:00Z');

// ---- validator ----
const good = validateExtraction({
  bureau: 'experian', report_date: '2026-09-30',
  accounts: [
    { furnisher_name: 'Metro Credit Card', account_type: 'revolving', account_number: '4111-1111-1111-2650', payment_status: 'late_60', balance_cents: 265000, opened_date: '2019-03-01', INJECT: 'x', ssn: '123-45-6789' },
    { furnisher_name: 'ACME Collections', account_type: 'collection', is_collection: true, payment_status: 'collection', balance_cents: 84200, low_confidence_fields: ['balance_cents'] },
  ],
  inquiries: [{ inquirer_name: 'Auto Lender', inquiry_date: '2026-08-01', inquiry_kind: 'hard' }],
}, now);
check(good.ok && good.payload.accounts.length === 2, 'valid report accepted');
check(good.payload.accounts[0].account_last4 === '2650', 'only the last four digits are kept');
check(!JSON.stringify(good.payload).includes('4111') && !JSON.stringify(good.payload).includes('123-45') && !JSON.stringify(good.payload).includes('INJECT'), 'full account number, SSN and unknown keys never survive');
check(good.payload.accounts[1].low_confidence_fields.includes('balance_cents'), 'engine-reported uncertainty is preserved');
check(good.payload.bureau === 'experian' && good.payload.report_date === '2026-09-30', 'bureau/date kept');

const bad = validateExtraction({ bureau: 'made-up', accounts: [
  { furnisher_name: 'X', payment_status: 'late_60' },
  { furnisher_name: 'Real Bank', account_type: 'spaceship', payment_status: 'weird', opened_date: '2031-01-01', closed_date: '2020-02-30', balance_cents: -5, credit_limit_cents: 1.5, monthly_payment_cents: 1e15, is_collection: 'yes' },
  'not an object', null,
], inquiries: [{ inquirer_name: '' }, { inquirer_name: 'Ok Lender', inquiry_kind: 'weird', inquiry_date: 'yesterday' }] }, now);
check(bad.ok, 'the valid remainder is kept');
const a = bad.payload.accounts[0];
check(bad.payload.accounts.length === 1 && a.furnisher_name === 'Real Bank', 'too-short names and non-objects dropped');
check(a.account_type === 'other' && a.payment_status === 'unknown' && a.low_confidence_fields.includes('account_type') && a.low_confidence_fields.includes('payment_status'), 'invalid enums become other/unknown AND flagged, never guessed');
check(!('opened_date' in a) && !('closed_date' in a) && !('balance_cents' in a) && !('credit_limit_cents' in a) && !('monthly_payment_cents' in a), 'future dates, impossible dates, negative/fractional/huge money all dropped');
check(a.is_collection === false, 'only a real boolean true counts');
check(['opened_date', 'closed_date', 'balance_cents', 'credit_limit_cents', 'monthly_payment_cents'].every((f) => a.low_confidence_fields.includes(f)), 'every dropped field is flagged for the member');
check(bad.payload.bureau === 'unknown', 'unknown bureau');
check(bad.payload.inquiries.length === 1 && bad.payload.inquiries[0].inquiry_kind === 'unknown' && !('inquiry_date' in bad.payload.inquiries[0]), 'bad inquiry fields dropped');

check(validateExtraction(null).ok === false && validateExtraction('x').ok === false && validateExtraction([]).ok === false, 'non-objects rejected');
check(validateExtraction({ accounts: [] }).ok === false && validateExtraction({}).reason === 'nothing_extracted', 'an empty extraction is a failure, never an empty success');
check(validateExtraction({ accounts: Array.from({ length: 500 }, (_, i) => ({ furnisher_name: 'Bank ' + i })) }, now).payload.accounts.length === MAX_ACCOUNTS, 'account count is capped');
check(validateExtraction({ accounts: [{ furnisher_name: 'Line\u0000break\nBank  Name' }] }, now).payload.accounts[0].furnisher_name === 'Line break Bank Name', 'control characters are stripped');
check(last4Only('12') === undefined && last4Only(12345678) === '5678' && last4Only('xxxx-9876') === '9876', 'last4Only');

// ---- handler ----
const UP = '11111111-2222-4333-8444-555555555555';
function deps(over = {}) {
  const calls = { ingest: [], failed: [], engine: 0, download: 0 };
  const d = {
    enabled: () => true,
    getUserId: async (h) => (h === 'Bearer good' ? 'u1' : null),
    getOwnUpload: async (id) => (id === UP ? { id, status: 'uploaded', mime_type: 'application/pdf', byte_size: 5000, storage_path: 'u1/x/report.pdf' } : null),
    download: async () => { calls.download++; return new Uint8Array([1, 2, 3]); },
    runEngine: async () => { calls.engine++; return { bureau: 'equifax', accounts: [{ furnisher_name: 'Metro Card', account_number: '999988887777' }] }; },
    ingest: async (id, p) => { calls.ingest.push(p); return 'report-1'; },
    markFailed: async (id, code) => { calls.failed.push(code); },
    now: () => now, ...over,
  };
  return { d, calls };
}
const run = (over, body = { upload_id: UP, consent: true }, auth = 'Bearer good', method = 'POST') => { const x = deps(over); return handleExtract(method, auth, typeof body === 'string' ? body : JSON.stringify(body), x.d).then((r) => ({ ...r, calls: x.calls })); };

let r = await run();
check(r.status === 200 && r.body.accounts === 1 && r.body.needs_member_review === true && r.calls.ingest.length === 1, 'happy path ingests');
check(r.calls.ingest[0].accounts[0].account_last4 === '7777' && !JSON.stringify(r.calls.ingest[0]).includes('9999'), 'the handler ingests last-4 only');
check(!JSON.stringify(r.body).includes('Metro'), 'the response carries counts only, never account content');
r = await run({ enabled: () => false }); check(r.status === 503 && r.body.error === 'extraction_not_enabled' && r.calls.engine === 0 && r.calls.download === 0, 'disabled by default: nothing is read or sent');
r = await run({}, { upload_id: UP }); check(r.status === 400 && r.body.error === 'consent_required' && r.calls.engine === 0, 'consent is required');
r = await run({}, { upload_id: UP, consent: 'yes' }); check(r.status === 400 && r.calls.engine === 0, 'consent must be literally true');
r = await run({}, { upload_id: UP, consent: true }, null); check(r.status === 401 && r.calls.download === 0, 'unauthenticated');
r = await run({}, { upload_id: UP, consent: true }, 'Bearer nope'); check(r.status === 401, 'bad token');
r = await run({}, { upload_id: '11111111-2222-4333-8444-000000000000', consent: true }); check(r.status === 404 && r.calls.engine === 0, "someone else's / missing upload is not found (RLS hides it)");
r = await run({}, { upload_id: 'not-a-uuid', consent: true }); check(r.status === 400, 'bad id');
r = await run({}, '{nope'); check(r.status === 400, 'bad json');
r = await run({}, 'x'.repeat(2000)); check(r.status === 413, 'oversize');
r = await run({}, undefined, 'Bearer good', 'GET'); check(r.status === 405, 'GET');
r = await run({ getOwnUpload: async (id) => ({ id, status: 'needs_review', mime_type: 'application/pdf', byte_size: 1, storage_path: 'p' }) }); check(r.status === 409 && r.calls.engine === 0, 'already-read uploads are not re-read');
r = await run({ getOwnUpload: async (id) => ({ id, status: 'deleted', mime_type: 'application/pdf', byte_size: 1, storage_path: null }) }); check(r.status === 404, 'deleted upload');
r = await run({ getOwnUpload: async (id) => ({ id, status: 'uploaded', mime_type: 'application/pdf', byte_size: 50_000_000, storage_path: 'p' }) }); check(r.status === 413 && r.calls.failed[0] === 'file_too_large' && r.calls.engine === 0, 'too-large file');
r = await run({ download: async () => null }); check(r.status === 422 && r.calls.failed[0] === 'file_unreadable', 'unreadable file');
r = await run({ runEngine: async () => { throw new Error('secret provider detail'); } }); check(r.status === 502 && !JSON.stringify(r.body).includes('secret') && r.calls.failed[0] === 'engine_error' && r.calls.ingest.length === 0, 'engine error: short code, nothing ingested');
r = await run({ runEngine: async () => null }); check(r.status === 422 && r.calls.failed[0] === 'nothing_extracted', 'engine read nothing');
r = await run({ runEngine: async () => ({ accounts: [{ furnisher_name: '' }] }) }); check(r.status === 422 && r.calls.ingest.length === 0, 'garbage engine output is never ingested');

if (failures.length) { console.error('Credit extraction tests FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('Credit extraction tests passed: strict validator (last-4 only, no invention, flagged gaps) and consent-gated, disabled-by-default handler.');
