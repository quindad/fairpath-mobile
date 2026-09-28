// Credit document builders. Pure: confirmed member data -> DocumentSpec.
//
// Rules: only issues the MEMBER confirmed are included; the member's own statement is quoted, never rewritten into an
// allegation; account identifiers are limited to the creditor name and last four digits; nothing predicts a result and
// no statute is cited as fact. The letter's sender/recipient/enclosure fields are `editable` blocks the member sees and
// completes BEFORE anything is generated. These documents are highly sensitive: on-demand by default, never for employers.
import type { DocBlock, DocumentSpec } from '../spec.ts';
import { documentTypeInfo } from '../document-types.ts';

export type CreditAccountForDoc = {
  id: string; furnisher_name: string; account_last4: string | null; payment_status: string; balance_cents: number | string | null;
  opened_date: string | null; extraction_state: string; is_collection: boolean; is_charged_off: boolean;
};
export type CreditItemForDoc = {
  id: string; account_id: string | null; stage: string; issue_type: string; title: string; explanation: string; member_statement: string | null;
};
export type CreditDisputeForDoc = {
  id: string; target_kind: 'bureau' | 'furnisher'; target_name: string; reason: string; status: string;
  sent_on: string | null; sent_method: string | null; tracking_reference: string | null; response_due_on: string | null;
  response_received_on: string | null; outcome: string | null; created_at: string;
};
export type LetterFields = {
  senderName: string; senderAddress: string; senderPhone: string; recipientAddress: string; dateText: string; enclosures: string[];
};

const money = (c: number | string | null | undefined) => (c === null || c === undefined || c === '' ? 'not listed' : '$' + (Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const label = (s: string) => s.replace(/_/g, ' ');
const ending = (a: CreditAccountForDoc | undefined) => (a?.account_last4 ? ` (account ending in ${a.account_last4})` : '');

const FOOTER_LETTER = 'Prepared with FairPath from information confirmed by the member. FairPath is not a law firm and does not give legal advice.';
const FOOTER_SUMMARY = 'Prepared by FairPath from information you reviewed. This is a summary of your own review, not a credit report and not legal advice.';

function spec(type: string, subject: string, title: string, blocks: DocBlock[], inputs: unknown, recordId: string | null, footer: string, now: Date): DocumentSpec {
  const info = documentTypeInfo(type)!;
  return {
    documentType: type, sourceModule: info.module, sourceRecordId: recordId, templateId: info.templateId, templateVersion: info.templateVersion,
    title, subject, audience: 'self', sensitivity: info.sensitivity, kind: info.kind, formats: info.formats, blocks, confirmedDataAt: now.toISOString(), inputs, footer,
  };
}

/** Errors that must be fixed before a letter can be generated (shown to the member). */
export function letterProblems(items: CreditItemForDoc[], fields: LetterFields): string[] {
  const p: string[] = [];
  if (!items.length) p.push('Choose at least one confirmed issue.');
  if (items.some((i) => i.stage !== 'confirmed_dispute_issue')) p.push('Only issues you confirmed can go in a dispute letter.');
  if (items.some((i) => !i.member_statement || i.member_statement.trim().length < 10)) p.push('Each issue needs your own explanation of what is wrong.');
  if (fields.senderName.trim().length < 2) p.push('Enter your name as it should appear on the letter.');
  if (fields.senderAddress.trim().length < 5) p.push('Enter your mailing address.');
  if (fields.recipientAddress.trim().length < 5) p.push('Enter the address you are sending this to (find the current address on the recipient\'s website).');
  return p;
}

export function identityLetterProblems(bureauName: string, fields: IdentityCorrectionField[], letter: LetterFields): string[] {
  const p: string[] = [];
  if (!bureauName.trim()) p.push('Choose who you are sending this to.');
  if (!fields.some((f) => f.correct.trim())) p.push('Enter at least one correction.');
  if (letter.senderName.trim().length < 2) p.push('Enter your name as it should appear on the letter.');
  if (letter.senderAddress.trim().length < 5) p.push('Enter your mailing address.');
  if (letter.recipientAddress.trim().length < 5) p.push('Enter the address you are sending this to (find the current address on the recipient\'s website).');
  return p;
}

export function buildDisputeLetter(dispute: CreditDisputeForDoc, items: CreditItemForDoc[], accounts: CreditAccountForDoc[], fields: LetterFields, now = new Date()): DocumentSpec {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const blocks: DocBlock[] = [
    { type: 'notice', tone: 'info', text: 'Review everything below. The boxed fields are yours to edit before you send this. FairPath does not send anything for you.' },
    { type: 'editable', label: 'From', value: [fields.senderName, fields.senderAddress, fields.senderPhone].filter((x) => x.trim()).join('\n'), hint: 'Your name, mailing address and phone number.' },
    { type: 'paragraph', text: fields.dateText },
    { type: 'editable', label: 'To', value: [dispute.target_name, fields.recipientAddress].filter((x) => x.trim()).join('\n'), hint: 'Use the current dispute address listed on the recipient\'s official website.' },
    { type: 'heading', text: `Dispute of inaccurate information${dispute.target_kind === 'bureau' ? ' in my credit file' : ''}`, level: 2 },
    { type: 'paragraph', text: `To ${dispute.target_name}:` },
    { type: 'paragraph', text: 'I am writing to dispute information that I believe is inaccurate. The item(s) and what I believe is wrong are listed below. Please investigate and correct or remove any information you are not able to verify, and send me the results in writing.' },
  ];
  items.forEach((it, n) => {
    const a = it.account_id ? byId.get(it.account_id) : undefined;
    blocks.push({ type: 'heading', text: `Item ${n + 1}: ${a ? a.furnisher_name : it.title}${ending(a)}`, level: 3 });
    const kv: { label: string; value: string }[] = [];
    if (a) {
      kv.push({ label: 'As reported', value: `${label(a.payment_status)}, balance ${money(a.balance_cents)}` });
    }
    kv.push({ label: 'What I believe is wrong', value: it.member_statement ?? '' });
    blocks.push({ type: 'keyvalue', items: kv });
  });
  blocks.push({ type: 'paragraph', text: 'Thank you for your prompt attention to this matter.' });
  blocks.push({ type: 'paragraph', text: 'Sincerely,' });
  blocks.push({ type: 'paragraph', text: fields.senderName });
  if (fields.enclosures.length) blocks.push({ type: 'heading', text: 'Enclosures', level: 3 }, { type: 'bullets', items: fields.enclosures });
  return spec('credit_dispute_letter', `${dispute.target_kind === 'bureau' ? dispute.target_name : 'Furnisher'} Dispute`, `Dispute letter to ${dispute.target_name}`, blocks,
    { d: dispute.id, items: items.map((i) => [i.id, i.stage, i.member_statement]), fields: { ...fields, dateText: undefined } }, dispute.id, FOOTER_LETTER, now);
}

export type IdentityCorrectionField = { label: string; current: string; correct: string };

/**
 * A separate letter for personal-information errors (name, address, DOB, SSN digits, work history on file, etc.) rather
 * than an account issue. FairPath never pulls these values from the member's identity documents automatically —
 * every field here is what the member typed into the correction screen, current vs. correct, in their own words.
 */
export function buildIdentityCorrectionLetter(bureauName: string, fields: IdentityCorrectionField[], letter: LetterFields, now = new Date()): DocumentSpec {
  const blocks: DocBlock[] = [
    { type: 'notice', tone: 'info', text: 'Review everything below. The boxed fields are yours to edit before you send this. FairPath does not send anything for you.' },
    { type: 'editable', label: 'From', value: [letter.senderName, letter.senderAddress, letter.senderPhone].filter((x) => x.trim()).join('\n'), hint: 'Your name, mailing address and phone number.' },
    { type: 'paragraph', text: letter.dateText },
    { type: 'editable', label: 'To', value: [bureauName, letter.recipientAddress].filter((x) => x.trim()).join('\n'), hint: 'Use the current dispute address listed on the recipient\'s official website.' },
    { type: 'heading', text: 'Request to correct personal information', level: 2 },
    { type: 'paragraph', text: `To ${bureauName}:` },
    { type: 'paragraph', text: 'The personal information you have on file for me includes one or more errors. Please correct my file as described below and send me confirmation in writing.' },
    { type: 'heading', text: 'Corrections requested', level: 3 },
    { type: 'keyvalue', items: fields.filter((f) => f.correct.trim()).map((f) => ({ label: f.label, value: `On file: ${f.current || 'not listed'}\nCorrect: ${f.correct}` })) },
    { type: 'paragraph', text: 'Thank you for your prompt attention to this matter.' },
    { type: 'paragraph', text: 'Sincerely,' },
    { type: 'paragraph', text: letter.senderName },
  ];
  if (letter.enclosures.length) blocks.push({ type: 'heading', text: 'Enclosures', level: 3 }, { type: 'bullets', items: letter.enclosures });
  return spec('credit_identity_correction_letter', `${bureauName} Personal Info Correction`, `Personal information correction letter to ${bureauName}`, blocks,
    { b: bureauName, f: fields.map((x) => [x.label, x.correct]) }, null, FOOTER_LETTER, now);
}

const STANDARD_ENCLOSURES = [
  'A copy of a government-issued photo ID',
  'Proof of your current address (for example a recent utility bill)',
  'The page(s) of your credit report showing the item(s) you dispute, with the items marked',
  'Any statements, receipts or letters that show the information is wrong',
];

export function buildEvidenceChecklist(dispute: CreditDisputeForDoc, evidence: { description: string }[], now = new Date()): DocumentSpec {
  const blocks: DocBlock[] = [
    { type: 'heading', text: 'Supporting-document checklist', level: 1 },
    { type: 'paragraph', text: `Dispute to ${dispute.target_name}` },
    { type: 'notice', tone: 'info', text: 'Send copies, not originals. Only include what supports your explanation. Black out anything the recipient does not need, such as full account numbers.' },
    { type: 'heading', text: 'Commonly included', level: 2 },
    { type: 'checklist', items: STANDARD_ENCLOSURES.map((t) => ({ text: t })) },
  ];
  if (evidence.length) blocks.push({ type: 'heading', text: 'Documents you added to this dispute', level: 2 }, { type: 'checklist', items: evidence.map((e) => ({ text: e.description })) });
  return spec('credit_evidence_checklist', 'Evidence Checklist', 'Supporting-document checklist', blocks, { d: dispute.id, e: evidence.map((x) => x.description) }, dispute.id, FOOTER_SUMMARY, now);
}

export function buildMailingInstructions(dispute: CreditDisputeForDoc, now = new Date()): DocumentSpec {
  const blocks: DocBlock[] = [
    { type: 'heading', text: 'How to send your dispute', level: 1 },
    { type: 'paragraph', text: `Dispute to ${dispute.target_name}` },
    { type: 'notice', tone: 'warning', text: 'These are general steps. Check the recipient\'s official website for their current dispute address and any online option, and follow the official guidance if it differs.' },
    { type: 'checklist', items: [
      { text: 'Read your letter one more time and fix anything that is not accurate.' },
      { text: 'Sign the letter.' },
      { text: 'Make a copy of the letter and every enclosure for your own records.' },
      { text: 'Send it in a way that gives you proof of delivery (for example certified mail with a return receipt).' },
      { text: 'Write down the date you sent it and the tracking or reference number.' },
      { text: 'Record the sent date in FairPath so it can remind you when a response is due.' },
    ] },
    { type: 'heading', text: 'After you send it', level: 2 },
    { type: 'bullets', items: [
      'Responses usually arrive by mail or online within a few weeks. Check the official guidance for the current time frames.',
      'When you get a response, record what it says in FairPath.',
      'If the item is verified as accurate and you still believe it is wrong, you can add new information and dispute again, or contact the company that reported it directly.',
      'Nobody can promise a particular result.',
    ] },
    { type: 'paragraph', text: 'Official guidance: consumerfinance.gov (CFPB) and consumer.ftc.gov (FTC).' },
  ];
  return spec('credit_mailing_instructions', 'Mailing Instructions', 'Mailing instructions', blocks, { d: dispute.id }, dispute.id, FOOTER_SUMMARY, now);
}

export function buildAccountSummary(items: CreditItemForDoc[], accounts: CreditAccountForDoc[], now = new Date()): DocumentSpec {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const rows = items.map((it) => {
    const a = it.account_id ? byId.get(it.account_id) : undefined;
    return [`${a ? a.furnisher_name : it.title}${ending(a)}`, label(a?.payment_status ?? ''), money(a?.balance_cents), it.member_statement ?? ''];
  });
  const blocks: DocBlock[] = [
    { type: 'heading', text: 'Account summary', level: 1 },
    { type: 'paragraph', text: `Prepared ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` },
    { type: 'notice', tone: 'info', text: 'This lists only the accounts included in your dispute, with the explanation you confirmed. It is not a complete credit report.' },
    rows.length ? { type: 'table', columns: ['Account', 'Status', 'Balance', 'What you say is wrong'], rows } : { type: 'paragraph', text: 'No confirmed issues.' },
  ];
  return spec('credit_review_summary', 'Account Summary', 'Account summary', blocks, { i: items.map((x) => [x.id, x.stage, x.member_statement]) }, null, FOOTER_SUMMARY, now);
}

export function buildDisputeHistory(disputes: CreditDisputeForDoc[], now = new Date()): DocumentSpec {
  const rows = disputes.map((d) => [d.target_name, d.status.replace(/_/g, ' '), d.sent_on ?? '', d.response_received_on ?? '', d.outcome ? d.outcome.replace(/_/g, ' ') : '']);
  const blocks: DocBlock[] = [
    { type: 'heading', text: 'Dispute history', level: 1 },
    { type: 'paragraph', text: `Prepared ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` },
    rows.length ? { type: 'table', columns: ['Sent to', 'Status', 'Sent', 'Response', 'Outcome'], rows } : { type: 'paragraph', text: 'No disputes yet.' },
  ];
  const s = spec('credit_dispute_history', 'Dispute History', 'Dispute history', blocks, { d: disputes.map((x) => [x.id, x.status, x.sent_on, x.outcome]) }, null, FOOTER_SUMMARY, now);
  s.csv = { columns: ['Sent to', 'Status', 'Sent', 'Response due', 'Response received', 'Outcome', 'Reference'], rows: disputes.map((d) => [d.target_name, d.status, d.sent_on ?? '', d.response_due_on ?? '', d.response_received_on ?? '', d.outcome ?? '', d.tracking_reference ?? '']) };
  return s;
}

export const STANDARD_LETTER_ENCLOSURES = STANDARD_ENCLOSURES;
