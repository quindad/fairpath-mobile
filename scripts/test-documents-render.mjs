// Renders real PDF / DOCX / CSV bytes from the shared document spec and verifies them. `npm run test:documents`
import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { pdfHas } from './lib/pdf-text.mjs';
import { renderPdf, toWinAnsi } from '../src/core/documents/render-pdf.ts';
import { renderDocx } from '../src/core/documents/render-docx.ts';
import { documentFileName, fingerprintOf, safeFileToken, specToText, toCsv } from '../src/core/documents/spec.ts';
import { audienceAllowed, DOCUMENT_TYPES } from '../src/core/documents/document-types.ts';
import { buildContactSheet, buildRequiredDocumentsChecklist, buildSavedResourcesList } from '../src/core/documents/builders/resources.ts';
import { buildOpportunityProfile, DEFAULT_PROFILE_OPTIONS, describeIncluded } from '../src/core/documents/builders/opportunity-profile.ts';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const res = (n, o = {}) => ({
  id: `r${n}`, title: `Community Pantry ${n}`, summary: 'Free groceries', organization: { name: `Org ${n}`, website_url: `https://org${n}.example.test` },
  categories: ['food'], delivery_mode: 'in_person', is_national: false, cost_type: 'free', cost_notes: null, how_to_access: 'Walk in during open hours.',
  freshness: 'fresh', last_verified_at: '2026-09-01T00:00:00Z', accessibility: ['wheelchair'],
  locations: [{ label: 'Main', address_line: `${n} Example Ave`, city: 'Cleveland', state_code: 'OH', postal_code: '44113', phone: '(555) 010-0100', is_virtual: false,
    hours: [1, 2, 3, 4, 5].map((d) => ({ weekday: d, opens_at: '09:00:00', closes_at: '17:00:00', is_24h: false })) }],
  contacts: [{ method: 'phone', value: '(555) 010-0100', label: 'Main', is_primary: true }, { method: 'url', value: `https://org${n}.example.test`, label: 'Web', is_primary: false }],
  required_documents: [{ document_type: 'photo_id', description: 'Photo ID', is_required: true }, { document_type: 'mail', description: 'Mail showing your address', is_required: false }],
  ...o,
});
const labels = { food: 'Food' };
const NOW = new Date('2026-10-04T12:00:00');

// ---------- PDF ----------
const list = buildSavedResourcesList([res(1), res(2, { freshness: 'stale' })], labels, NOW);
const pdf = await renderPdf(list);
check(Buffer.from(pdf.slice(0, 5)).toString() === '%PDF-', 'PDF header');
const doc = await PDFDocument.load(pdf);
check(doc.getPageCount() === 1, 'a two-row list fits on one page');
check(doc.getTitle() === 'Saved resources' && doc.getAuthor() === 'FairPath', 'PDF metadata');
check(pdfHas(pdf, 'Community Pantry 1') && pdfHas(pdf, 'Saved resources') && pdfHas(pdf, 'Page 1 of 1'), 'PDF must contain the spec text and page numbers');
check(pdfHas(pdf, 'May be out of date'), 'stale status must be printed');
const big = await renderPdf(buildSavedResourcesList(Array.from({ length: 70 }, (_, i) => res(i + 1)), labels, NOW));
check((await PDFDocument.load(big)).getPageCount() > 2, 'long lists must paginate');
const weird = buildSavedResourcesList([res(1, { title: 'Ünïcödé 日本語 😀 ☐ → café', summary: 'x' })], labels, NOW);
let crashed = false;
try { await renderPdf(weird); } catch { crashed = true; }
check(!crashed, 'unsupported characters must never crash a render');
check(toWinAnsi('a☐b→c日') === 'a[ ]b->c?', 'WinAnsi sanitizer: ' + toWinAnsi('a☐b→c日'));
const sheet = await renderPdf(buildContactSheet([res(1), res(2)], NOW));
check(pdfHas(sheet, '(555) 010-0100') && pdfHas(sheet, 'Mon') , 'contact sheet phone + hours present');
const checklist = await renderPdf(buildRequiredDocumentsChecklist([res(1), res(2)], NOW));
check(pdfHas(checklist, 'Photo ID'), 'checklist content');

// ---------- DOCX ----------
const docx = await renderDocx(buildContactSheet([res(1)], NOW));
const zip = await JSZip.loadAsync(docx);
check(!!zip.file('[Content_Types].xml') && !!zip.file('word/document.xml'), 'DOCX package structure');
const xml = await zip.file('word/document.xml').async('string');
check(xml.includes('Community Pantry 1') && xml.includes('(555) 010-0100') && xml.includes('<w:document'), 'DOCX must contain the spec text');
check(!xml.includes('<script') && (xml.match(/<w:body>/g) ?? []).length === 1, 'DOCX body sanity');

// ---------- CSV ----------
const csv = toCsv(['a', 'b'], [['=cmd|calc', 'x,y'], ['say "hi"', '+1'], ['ok', '@x']]);
check(csv.startsWith('﻿') && csv.includes("'=cmd|calc") && csv.includes('"x,y"') && csv.includes('"say ""hi"""') && csv.includes("'+1") && csv.includes("'@x"), 'CSV escaping / formula neutralization: ' + JSON.stringify(csv));
check(list.csv.columns.length === list.csv.rows[0].length, 'CSV rows match columns');

// ---------- file names ----------
check(documentFileName('Opportunity Profile', 'pdf', 1, NOW) === 'FairPath_Opportunity_Profile_2026-10-04.pdf', 'file name v1');
check(documentFileName('Ohio Record Sealing Packet', 'pdf', 2, NOW) === 'FairPath_Ohio_Record_Sealing_Packet_2026-10-04_v2.pdf', 'file name v2');
check(safeFileToken('../../a b/c;d') === 'a_b_c_d' && safeFileToken('   ') === 'Document' && safeFileToken('x'.repeat(200)).length === 60, 'token sanitizer');
for (const t of Object.values(DOCUMENT_TYPES)) check(/^FairPath_[A-Za-z0-9_]+_\d{4}-\d{2}-\d{2}\.(pdf|docx|csv)$/.test(documentFileName(t.label, t.formats[0], 1, NOW)), `${t.type}: unsafe generated file name`);

// ---------- fingerprints (stale detection) ----------
check(fingerprintOf({ a: 1, b: [1, 2] }) === fingerprintOf({ b: [1, 2], a: 1 }), 'fingerprint must ignore key order');
check(fingerprintOf({ a: 1 }) !== fingerprintOf({ a: 2 }), 'fingerprint must change with data');
const l1 = buildSavedResourcesList([res(1)], labels, NOW);
const l2 = buildSavedResourcesList([res(1)], labels, new Date('2027-01-01'));
check(fingerprintOf(l1.inputs) === fingerprintOf(l2.inputs), 'regenerating on another day with the same data must not look stale');
const l3 = buildSavedResourcesList([res(1, { last_verified_at: '2026-12-01T00:00:00Z' })], labels, NOW);
check(fingerprintOf(l1.inputs) !== fingerprintOf(l3.inputs), 'a re-verified resource must mark the document as changed');

// ---------- Opportunity Profile: sensitive fields OFF by default, member selection honored ----------
const profile = {
  contact: { first_name: 'Marcus', last_name: 'Reed', phone: '(614) 555-0101', email: 'marcus@example.test', zip_code: '44113' },
  work: [{ job_title: 'Forklift Operator', employer_name: 'Acme Logistics', location_text: 'Cleveland, OH', start_date: '2019-03-01', end_date: '2021-06-30', is_current: false, description: 'Loaded and unloaded trucks.' },
    { job_title: 'Prep Cook', employer_name: 'Corner Diner', location_text: null, start_date: '2022-01-10', end_date: null, is_current: true, description: null }],
  education: [{ school_name: 'Lincoln High School', credential: 'ged', field_of_study: null, start_year: null, end_year: 2015, status: 'completed' }],
  credentials: [{ credential_type: 'certification', name: 'OSHA 10', issuer: 'OSHA', issued_date: '2023-05-01', expires_date: null }],
  skills: ['Forklift', 'Inventory', 'Teamwork'],
  preferences: { desired_titles: ['Warehouse Associate'], employment_types: ['full_time'], workplace_types: ['on_site'], pay_min_hourly: 19.5, available_days: ['mon', 'tue'], shift_preferences: ['morning'], earliest_start_date: '2026-11-01', transportation_modes: ['public_transit'], has_drivers_license: false },
};
const def = buildOpportunityProfile(profile, DEFAULT_PROFILE_OPTIONS, NOW);
const defText = specToText(def);
check(defText.includes('Marcus Reed') && defText.includes('Forklift Operator') && defText.includes('Mar 2019 – Jun 2021') && defText.includes('Jan 2022 – Present'), 'default profile content / date ranges');
check(!defText.includes('555-0101') && !defText.includes('marcus@example.test') && !defText.includes('44113') && !defText.includes('19.50') && !defText.includes('Public transit'), 'phone, email, ZIP, pay and transportation must be OFF by default');
check(describeIncluded(DEFAULT_PROFILE_OPTIONS).join('|') === 'Your name|Work experience|Education|Certifications and licenses|Skills|Job preferences|Availability', 'included-panel matches defaults');
const withPhone = specToText(buildOpportunityProfile(profile, { ...DEFAULT_PROFILE_OPTIONS, includePhone: true, includePay: true }, NOW));
check(withPhone.includes('(614) 555-0101') && withPhone.includes('$19.50 per hour'), 'selected fields must appear');
const noName = specToText(buildOpportunityProfile(profile, { ...DEFAULT_PROFILE_OPTIONS, includeName: false }, NOW));
check(!noName.includes('Marcus') && !noName.includes('Reed'), 'name must be omittable');
const fpBase = fingerprintOf(def.inputs);
const changedPhone = { ...profile, contact: { ...profile.contact, phone: '(614) 555-9999' } };
check(fingerprintOf(buildOpportunityProfile(changedPhone, DEFAULT_PROFILE_OPTIONS, NOW).inputs) === fpBase, 'changing a field that is not exported must not mark the document stale');
const changedJob = { ...profile, work: [{ ...profile.work[0], job_title: 'Shift Lead' }, profile.work[1]] };
check(fingerprintOf(buildOpportunityProfile(changedJob, DEFAULT_PROFILE_OPTIONS, NOW).inputs) !== fpBase, 'changing exported data must mark the document stale');
const pdfProfile = await renderPdf(def);
check(pdfHas(pdfProfile, 'Forklift Operator') && !pdfHas(pdfProfile, '555-0101'), 'profile PDF matches the spec');
const docxProfile = await JSZip.loadAsync(await renderDocx(def));
const px = await docxProfile.file('word/document.xml').async('string');
check(px.includes('Forklift Operator') && !px.includes('555-0101'), 'profile DOCX matches the spec');

// ---------- audience boundary ----------
check(audienceAllowed('opportunity_profile', 'employer') && audienceAllowed('opportunity_profile', 'self'), 'profile may be prepared for employers');
for (const t of ['credit_dispute_letter', 'credit_review_summary', 'record_relief_case_summary', 'record_relief_worksheet']) {
  check(!audienceAllowed(t, 'employer') && !audienceAllowed(t, 'landlord'), `${t} must never be preparable for an employer/landlord`);
}
check(!audienceAllowed('saved_resources_list', 'landlord') && !audienceAllowed('unknown_type', 'self'), 'unknown/unlisted audiences denied');
for (const t of Object.values(DOCUMENT_TYPES)) {
  if (t.module === 'credit' || t.module === 'record_relief') check(t.sensitivity === 'highly_sensitive' && t.defaultPersist === 'on_demand' && !t.retentionChoices.includes(365), `${t.type}: justice/credit documents are highly sensitive, on-demand, max 90 days`);
}

// ---------- structural boundary: employer/landlord-capable builders cannot import sensitive modules ----------
const src = fs.readFileSync('src/core/documents/builders/opportunity-profile.ts', 'utf8');
const imports = [...src.matchAll(/^import[^;]*from\s+'([^']+)'/gm)].map((m) => m[1]);
check(imports.every((i) => ['../spec.ts', '../document-types.ts'].includes(i)), 'opportunity-profile builder imports only spec/document-types: ' + imports.join(','));
check(!/date_of_birth|home_address|conviction|offense|supervision|registration/i.test(src.replace(/\/\/[^\n]*/g, '')), 'opportunity-profile builder must have no field for DOB, address or justice data');

if (failures.length) { console.error('Document render tests FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log(`Document render tests passed: real PDF/DOCX/CSV bytes verified, ${Object.keys(DOCUMENT_TYPES).length} document types, safe names, stale detection, sensitive-off-by-default, audience boundary.`);
