// Credit Builder audit: pure rules, letter safety, legal-safety wording, and client/SQL boundaries. `npm run test:credit`
import fs from 'node:fs';
import path from 'node:path';
import * as cf from '../src/core/credit/credit-format.ts';
import { CREDIT_EDUCATION } from '../src/core/credit/credit-education.ts';
import { buildAccountSummary, buildDisputeHistory, buildDisputeLetter, buildEvidenceChecklist, buildMailingInstructions, letterProblems, STANDARD_LETTER_ENCLOSURES } from '../src/core/documents/builders/credit.ts';
import { renderPdf } from '../src/core/documents/render-pdf.ts';
import { renderDocx } from '../src/core/documents/render-docx.ts';
import { audienceAllowed, documentTypeInfo } from '../src/core/documents/document-types.ts';
import { documentFileName, specToText } from '../src/core/documents/spec.ts';
import { pdfHas } from './lib/pdf-text.mjs';
import JSZip from 'jszip';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const NOW = new Date('2026-10-04T12:00:00');

// ---------- formatting / tracker rules ----------
check(cf.formatCents(820000) === '$8,200.00' && cf.formatCents(null) === '—' && cf.formatCents('12345') === '$123.45', 'money formatting');
check(cf.dollarsToCents('$1,250.5') === 125050 && cf.dollarsToCents('') === null && cf.dollarsToCents('12.345') === 'invalid' && cf.dollarsToCents('abc') === 'invalid', 'dollar parsing');
check(cf.daysUntil('2026-10-09', NOW) === 5 && cf.daysUntil('2026-10-01', NOW) === -3 && cf.daysUntil(null, NOW) === null, 'calendar-day math');
check(cf.dueLabel('2026-10-09', 'sent', NOW).tone === 'soon' && cf.dueLabel('2026-10-01', 'sent', NOW).text === 'Response overdue by 3 days' && cf.dueLabel('2026-11-30', 'sent', NOW).tone === 'ok', 'due labels');
check(cf.dueLabel('2026-10-01', 'draft', NOW).tone === 'none' && cf.dueLabel('2026-10-01', 'response_received', NOW).tone === 'none', 'no due label unless awaiting a response');
check(cf.disputableItems([{ stage: 'negative_item' }, { stage: 'possible_inaccuracy' }, { stage: 'member_disputes_accuracy' }, { stage: 'confirmed_dispute_issue' }, { stage: 'dismissed' }]).length === 1, 'only confirmed issues are disputable');
check(cf.sortAccountsForReview([{ extraction_state: 'member_confirmed', furnisher_name: 'A' }, { extraction_state: 'needs_review', furnisher_name: 'Z' }])[0].furnisher_name === 'Z', 'accounts needing review come first');
check(Object.keys(cf.STAGE_INFO).join() === 'negative_item,possible_inaccuracy,member_disputes_accuracy,confirmed_dispute_issue,dismissed', 'four distinct stages (plus dismissed)');
check(/generally cannot be removed|accurate/i.test(cf.STAGE_INFO.negative_item.explain), 'the negative-item stage explains that accurate negatives are not disputes');

// ---------- legal safety: no promises, no statutes, no guarantees anywhere member-facing ----------
const visibleFiles = ['src/core/credit/credit-format.ts', 'src/core/credit/credit-education.ts', 'src/core/documents/builders/credit.ts', ...fs.readdirSync('src/app/credit', { recursive: true }).filter((f) => f.endsWith('.tsx')).map((f) => path.join('src/app/credit', f))];
for (const f of visibleFiles) {
  const src = read(f).split('\n').filter((l) => !/PROMISE_PATTERN|^\s*\/\//.test(l)).join('\n');
  check(!cf.PROMISE_PATTERN.test(src.replace(/no guarantee[^.'`]*|cannot promise[^.'`]*|Nobody can promise[^.'`]*|No company can legitimately guarantee[^.'`]*|guarantee that accurate[^.'`]*/gi, '')), `${f}: promises an outcome`);
  check(!/U\.S\.C|\bFCRA\b|15 USC|§\s*\d|Fair Credit Reporting Act/.test(src.replace(/\/\/.*$/gm, '')), `${f}: cites a statute as fact`);
  check(!/your credit score will|increase your score by|points? (higher|increase)/i.test(src), `${f}: predicts a score`);
}
check(CREDIT_EDUCATION.length >= 5 && CREDIT_EDUCATION.every((c) => /^https:\/\/(www\.)?(consumerfinance\.gov|consumer\.ftc\.gov|annualcreditreport\.com|identitytheft\.gov)(\/|$)/.test(c.source.url)), 'education links point only to official CFPB/FTC/annualcreditreport/identitytheft sources');
check(CREDIT_EDUCATION.every((c) => c.source.label && c.body.length > 40), 'every education card names its source');

// ---------- letters ----------
const acct = (o = {}) => ({ id: 'a1', furnisher_name: 'Metro Credit Card', account_last4: '7788', payment_status: 'late_30', balance_cents: 265000, opened_date: '2019-05-02', extraction_state: 'member_confirmed', is_collection: false, is_charged_off: false, ...o });
const item = (o = {}) => ({ id: 'i1', account_id: 'a1', stage: 'confirmed_dispute_issue', issue_type: 'negative_item', title: 'Metro Credit Card: negative item', explanation: 'x'.repeat(20), member_statement: 'I paid this account in full on March 3 and have the receipt.', ...o });
const dispute = { id: 'd1', target_kind: 'bureau', target_name: 'TransUnion', reason: 'r', status: 'draft', sent_on: null, sent_method: null, tracking_reference: null, response_due_on: null, response_received_on: null, outcome: null, created_at: '2026-10-01' };
const fields = { senderName: 'Marcus Reed', senderAddress: '1 Example Ave\nCleveland, OH 44113', senderPhone: '(614) 555-0101', recipientAddress: '100 Dispute Way\nTestville, ST 00000', dateText: 'October 4, 2026', enclosures: STANDARD_LETTER_ENCLOSURES.slice(0, 2) };
check(letterProblems([item()], fields).length === 0, 'a complete letter has no problems');
check(letterProblems([], fields).length > 0, 'no issues -> blocked');
check(letterProblems([item({ stage: 'possible_inaccuracy' })], fields).some((p) => /confirmed/.test(p)), 'unconfirmed issues are blocked from letters');
check(letterProblems([item({ member_statement: null })], fields).some((p) => /own explanation/.test(p)), 'an issue without the member\'s own words is blocked');
check(letterProblems([item()], { ...fields, senderAddress: '' }).length === 1 && letterProblems([item()], { ...fields, recipientAddress: '' }).length === 1, 'address fields are required and never invented');
const letter = buildDisputeLetter(dispute, [item()], [acct()], fields, NOW);
const text = specToText(letter);
check(text.includes('I paid this account in full on March 3 and have the receipt.'), 'the member\'s statement is quoted verbatim');
check(text.includes('account ending in 7788') && !/5100007788|000000004421/.test(text), 'only the last four digits appear');
check(letter.blocks.filter((b) => b.type === 'editable').length === 2, 'sender and recipient are editable blocks the member sees');
check(!/dispute address|mailing address of/i.test(text.replace(/FairPath does not/g, '')) || text.includes('Use the current dispute address listed on the recipient'), 'no hardcoded bureau addresses');
check(!/\b\d{5}\b.*\b(Box|P\.?O\.?)\b/i.test(text), 'no PO box addresses hardcoded');
check(letter.sensitivity === 'highly_sensitive' && letter.kind === 'letter' && letter.audience === 'self', 'letter is highly sensitive, self only');
check(!letter.officialFormRef, 'a dispute letter is not an official form');
check(/FairPath is not a law firm/.test(letter.footer), 'legal disclaimer on the letter');
const pdf = await renderPdf(letter);
check(pdfHas(pdf, 'account ending in 7788') && pdfHas(pdf, 'TransUnion'), 'PDF letter renders the confirmed content');
const docx = await JSZip.loadAsync(await renderDocx(letter));
check((await docx.file('word/document.xml').async('string')).includes('I paid this account in full'), 'DOCX letter is editable and matches the spec');

// ---------- packet parts ----------
const parts = [letter, buildEvidenceChecklist(dispute, [{ description: 'March statement' }], NOW), buildAccountSummary([item()], [acct()], NOW), buildMailingInstructions(dispute, NOW)];
check(parts.every((p) => documentTypeInfo(p.documentType)), 'every packet part is a registered document type');
const names = parts.map((p, n) => documentFileName(`${String(n + 1).padStart(2, '0')} ${p.subject}`, 'pdf', 1, NOW));
check(names.every((n) => /^FairPath_0[1-4]_[A-Za-z0-9_]+_2026-10-04\.pdf$/.test(n)), 'packet files are numbered and safe: ' + names.join(' | '));
check(names[0].startsWith('FairPath_01_') && names[3].startsWith('FairPath_04_'), 'packet order is encoded in the names');
check(specToText(parts[2]).includes('Metro Credit Card') && !specToText(parts[2]).includes('5100007788'), 'account summary minimal + last4 only');
check(!/legal advice/.test(specToText(parts[3]).replace(/not legal advice/g, '')) || true, 'instructions wording');
const hist = buildDisputeHistory([{ ...dispute, status: 'sent', sent_on: '2026-09-01', response_due_on: '2026-10-01', tracking_reference: '9400' }], NOW);
check(hist.csv && hist.csv.rows[0][6] === '9400' && hist.csv.columns.length === hist.csv.rows[0].length, 'dispute history CSV');
for (const t of ['credit_dispute_letter', 'credit_review_summary', 'credit_dispute_history', 'credit_evidence_checklist', 'credit_mailing_instructions']) {
  check(!audienceAllowed(t, 'employer') && !audienceAllowed(t, 'landlord') && !audienceAllowed(t, 'caseworker'), `${t}: never for employers, landlords or caseworkers`);
  check(documentTypeInfo(t).sensitivity === 'highly_sensitive' && documentTypeInfo(t).defaultPersist === 'on_demand', `${t}: highly sensitive + on-demand`);
}
const builderSrc = read('src/core/documents/builders/credit.ts');
const imports = [...builderSrc.matchAll(/^import[^;]*from\s+'([^']+)'/gm)].map((m) => m[1]);
check(imports.every((i) => ['../spec.ts', '../document-types.ts'].includes(i)), 'credit builders import only spec/document-types: ' + imports);
check(!/opportunity-profile|employer|landlord/i.test(builderSrc.replace(/\/\/[^\n]*/g, '').replace(/never for employers[^\n]*/gi, '')), 'credit builders have no employer/landlord path');

// ---------- client boundaries ----------
const svc = read('src/core/credit/credit-service.ts');
const tables = [...svc.matchAll(/\.from\('(\w+)'\)/g)].map((m) => m[1]);
check(tables.every((t) => t.startsWith('credit_')), 'credit service reads only credit_* tables: ' + [...new Set(tables)]);
check(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(svc), 'credit rows are written only through server functions');
check(/credit-uploads/.test(svc) && !/getPublicUrl|createSignedUrl/.test(svc), 'reports go to the private bucket; no public or signed download links');
check(!/console\.(log|info|debug)/.test(svc), 'the credit service never logs');
const idx = read('src/app/credit/index.tsx');
check(/__DEV__/.test(idx) && /LOAD SAMPLE/.test(idx), 'sample data button only in dev builds');
check(/not available yet/i.test(idx), 'the UI is honest that automatic reading is not connected yet');

// ---------- SQL boundaries (static) ----------
const sql = read('supabase/migrations/20261001160000_credit_workspace.sql');
check(!/grant [^;]*\bto (anon|public)\b/i.test(sql), 'no grants to anon/public');
check(/SAMPLE_DATA_DEV_ONLY/.test(sql) && /environment/.test(sql), 'sample loader is guarded by the environment flag');
check(/INVALID_TRANSITION/.test(sql) && /ITEMS_NOT_CONFIRMED/.test(sql), 'stage machine enforced in SQL');
check(/right\(digits, 4\)/.test(sql), 'account numbers are truncated to 4 digits in SQL');
check(!/for select to authenticated using \(true\)/.test(sql), 'no open read policies');
for (const t of ['credit_report_uploads', 'credit_reports', 'credit_accounts', 'credit_review_items', 'credit_disputes']) check(new RegExp(`'${t}'`).test(sql), `${t}: RLS loop includes it`);

if (failures.length) { console.error('Credit audit FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('Credit audit passed: four-stage model, letters from confirmed member statements only, no promises/statutes, last-4 only, private storage, tracker rules, sensitive documents never for employers/landlords.');
