// Tests the render-document Edge Function's handler (auth, validation, audience, server-derived content, real bytes)
// under Node with injected dependencies. `npm run test:render`
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { handleRender, sanitizeProfileOptions } from '../supabase/functions/render-document/handler.ts';
import { renderPdf } from '../src/core/documents/render-pdf.ts';
import { renderDocx } from '../src/core/documents/render-docx.ts';
import { documentFileName, fingerprintOf, toCsv } from '../src/core/documents/spec.ts';
import { pdfHas } from './lib/pdf-text.mjs';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const resource = {
  id: 'r1', title: 'Harbor Light Emergency Shelter', summary: 's', organization: { name: 'Harbor Light', website_url: null }, categories: ['housing'], delivery_mode: 'in_person', is_national: false,
  cost_type: 'free', cost_notes: null, how_to_access: 'Walk in.', freshness: 'fresh', last_verified_at: '2026-09-01T00:00:00Z', accessibility: [],
  locations: [{ label: 'Main', address_line: '1 Ave', city: 'Cleveland', state_code: 'OH', postal_code: '44113', phone: '(555) 010-0117', is_virtual: false, hours: [] }],
  contacts: [{ method: 'phone', value: '(555) 010-0117', label: null, is_primary: true }], required_documents: [{ document_type: 'photo_id', description: 'Photo ID', is_required: true }],
};
const profile = {
  contact: { first_name: 'Marcus', last_name: 'Reed', phone: '(614) 555-0101', email: 'm@example.test', zip_code: '44113' },
  work: [{ job_title: 'Forklift Operator', employer_name: 'Acme', location_text: null, start_date: '2019-03-01', end_date: '2021-06-30', is_current: false, description: null }],
  education: [], credentials: [], skills: ['Forklift'], preferences: null,
};

function makeDeps(over = {}) {
  const calls = { loadProfile: 0, loadResources: 0, register: [] };
  const deps = {
    async getUserId(h) { return h === 'Bearer good' ? 'user-1' : null; },
    async loadResources() { calls.loadResources++; return { resources: [resource], categoryLabels: { housing: 'Housing' } }; },
    async loadProfile() { calls.loadProfile++; return profile; },
    async register(userId, spec, format) { calls.register.push({ userId, spec, format }); return { id: 'doc-1', version: 1, file_name: documentFileName(spec.subject, format, 1, new Date('2026-10-04T12:00:00')) }; },
    renderPdf, renderDocx, toCsv,
    async sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); },
    now: () => new Date('2026-10-04T12:00:00'),
    ...over,
  };
  return { deps, calls };
}
const call = (deps, { method = 'POST', auth = 'Bearer good', body = {} } = {}) => handleRender(method, auth, typeof body === 'string' ? body : JSON.stringify(body), deps);

{ // auth + method + validation
  const { deps, calls } = makeDeps();
  check((await call(deps, { method: 'GET' })).status === 405, 'GET must be 405');
  check((await call(deps, { auth: null, body: { document_type: 'opportunity_profile', format: 'pdf' } })).status === 401, 'no auth header -> 401');
  check((await call(deps, { auth: 'Bearer bad', body: { document_type: 'opportunity_profile', format: 'pdf' } })).status === 401, 'bad token -> 401');
  check(calls.loadProfile === 0 && calls.loadResources === 0 && calls.register.length === 0, 'nothing may be read or registered for an unauthenticated caller');
  check((await call(deps, { body: '{not json' })).status === 400, 'invalid JSON -> 400');
  check((await call(deps, { body: 'x'.repeat(5000) })).status === 413, 'oversized body -> 413');
  check((await call(deps, { body: { document_type: 'credit_dispute_letter', format: 'pdf' } })).status === 400, 'a type this function cannot render is refused');
  check((await call(deps, { body: { document_type: 'nope', format: 'pdf' } })).status === 400, 'unknown type -> 400');
  check((await call(deps, { body: { document_type: 'saved_resources_list', format: 'docx' } })).status === 400, 'a format the type does not offer -> 400');
  check((await call(deps, { body: { document_type: 'resource_contact_sheet', format: 'csv' } })).status === 400, 'csv not offered for the contact sheet');
}

{ // audience boundary
  const { deps, calls } = makeDeps();
  for (const audience of ['landlord', 'admin', 'public']) {
    const r = await call(deps, { body: { document_type: 'opportunity_profile', format: 'pdf', options: { audience } } });
    check(r.status === 403, `audience "${audience}" must be refused (got ${r.status})`);
  }
  check(calls.register.length === 0, 'refused requests register nothing');
  check((await call(deps, { body: { document_type: 'opportunity_profile', format: 'pdf', options: { audience: 'employer' } } })).status === 200, 'employer audience is allowed for the opportunity profile');
}

{ // server-derived content; client cannot inject content
  const { deps, calls } = makeDeps();
  const r = await call(deps, { body: {
    document_type: 'opportunity_profile', format: 'pdf',
    options: { includePhone: true, includeName: 'yes', sections: { skills: false, bogus: true }, evil: '<script>' },
    blocks: [{ type: 'paragraph', text: 'CLIENT INJECTED TEXT' }], spec: { title: 'Forged' }, official_form_ref: { form_id: 'FAKE', source_url: 'x', verified_at: 'y' }, kind: 'official_form',
  } });
  check(r.status === 200, 'valid request should succeed: ' + JSON.stringify(r.body).slice(0, 120));
  const bytes = Buffer.from(r.body.file_base64, 'base64');
  check(bytes.slice(0, 5).toString() === '%PDF-', 'response file must be a PDF');
  check(!pdfHas(bytes, 'CLIENT INJECTED TEXT') && !pdfHas(bytes, 'Forged'), 'client-supplied content must never reach the document');
  check(pdfHas(bytes, 'Forklift Operator') && pdfHas(bytes, '(614) 555-0101'), 'content comes from the member data + selected options');
  check(!pdfHas(bytes, 'Skills'), 'sections=false must be honored');
  const reg = calls.register[0];
  check(reg.spec.officialFormRef === null && reg.spec.kind === 'summary', 'a request can never make the server emit an official form');
  check(reg.userId === 'user-1', 'documents are registered for the authenticated user only');
  check(r.body.generated_by === 'server' && r.body.checksum_sha256.length === 64 && r.body.byte_size === bytes.length, 'response metadata');
  check(r.body.file_name === 'FairPath_Opportunity_Profile_2026-10-04.pdf', 'file name from the registered row: ' + r.body.file_name);
  check(r.body.input_fingerprint === fingerprintOf(reg.spec.inputs), 'fingerprint returned for stale detection');
  check(!JSON.stringify(r.body).includes('user-1'), 'the response must not echo the user id');
  const o = sanitizeProfileOptions({ includeName: 'yes', includePhone: 1, evil: true, sections: { skills: 'no' } });
  check(o.includeName === true && o.includePhone === false && o.sections.skills === true && !('evil' in o), 'options sanitizer only accepts booleans and known keys');
}

{ // formats
  const { deps } = makeDeps();
  const docx = await call(deps, { body: { document_type: 'resource_contact_sheet', format: 'docx' } });
  const zip = await JSZip.loadAsync(Buffer.from(docx.body.file_base64, 'base64'));
  check((await zip.file('word/document.xml').async('string')).includes('Harbor Light Emergency Shelter'), 'server DOCX has the member data');
  const csv = await call(deps, { body: { document_type: 'saved_resources_list', format: 'csv' } });
  const text = Buffer.from(csv.body.file_base64, 'base64').toString('utf8');
  check(text.startsWith('﻿') && text.includes('Harbor Light Emergency Shelter'), 'server CSV');
  const list = await call(deps, { body: { document_type: 'saved_resources_list', format: 'pdf' } });
  const pdf = await PDFDocument.load(Buffer.from(list.body.file_base64, 'base64'));
  check(pdf.getPageCount() === 1, 'server PDF loads');
}

{ // failures never leak, and nothing persists
  const { deps } = makeDeps({ async register() { throw new Error('register_failed: secret internals'); } });
  let threw = false;
  try { await call(deps, { body: { document_type: 'saved_resources_list', format: 'pdf' } }); } catch { threw = true; }
  check(threw, 'a registration failure must surface (index.ts turns it into a generic 500 without internals)');
}

if (failures.length) { console.error('Render handler tests FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('Render handler tests passed: auth, validation, audience refusal, server-derived content (client injection ignored), no official-form minting, real PDF/DOCX/CSV.');
