// Credit-report extraction boundary (pure, no I/O). An extraction ENGINE (vision model / OCR) returns untrusted JSON;
// this module is the only thing allowed to turn it into the payload that ingest_credit_extraction() accepts.
//
// Rules enforced here (the database enforces them again):
//  * Nothing is invented. Only fields the engine actually returned survive, and only when they pass strict validation.
//  * Full account numbers never leave this module: only the last four digits are kept.
//  * Unknown keys, free text beyond short caps, and out-of-range values are dropped, never "fixed up".
//  * Every extracted account is a CANDIDATE for member review; nothing here decides that anything is inaccurate.
//  * A field the engine reported as uncertain, or that failed validation, is listed in low_confidence_fields.
const ACCOUNT_TYPES = ['revolving', 'installment', 'mortgage', 'auto', 'student', 'collection', 'utility', 'other'] as const;
const PAYMENT_STATUSES = ['current', 'late_30', 'late_60', 'late_90', 'late_120_plus', 'collection', 'charged_off', 'settled', 'paid_closed', 'unknown'] as const;
const BUREAUS = ['equifax', 'experian', 'transunion', 'unknown'] as const;
const INQUIRY_KINDS = ['hard', 'soft', 'unknown'] as const;
const DATE_FIELDS = ['opened_date', 'closed_date', 'last_reported_date', 'first_delinquency_date'] as const;
const CENT_FIELDS = ['balance_cents', 'credit_limit_cents', 'monthly_payment_cents'] as const;

export const MAX_ACCOUNTS = 60;
export const MAX_INQUIRIES = 40;
const MAX_CENTS = 100_000_000_000;

export type ExtractedAccount = {
  furnisher_name: string; account_type: string; account_last4?: string; original_creditor?: string; status_text?: string; payment_status: string;
  is_collection: boolean; is_charged_off: boolean; opened_date?: string; closed_date?: string; last_reported_date?: string; first_delinquency_date?: string;
  balance_cents?: number; credit_limit_cents?: number; monthly_payment_cents?: number; low_confidence_fields: string[];
};
export type ExtractionPayload = { bureau: string; report_date?: string; accounts: ExtractedAccount[]; inquiries: { inquirer_name: string; inquiry_date?: string; inquiry_kind: string }[] };
export type ExtractionOutcome = { ok: true; payload: ExtractionPayload; dropped: string[] } | { ok: false; reason: 'nothing_extracted' | 'not_an_object' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const pick = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] => (typeof v === 'string' && (list as readonly string[]).includes(v) ? v : fallback);
const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length >= 1 ? t.slice(0, max) : undefined;
};
function isoDate(v: unknown, now: Date): string | undefined {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(v + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return undefined;
  if (d.getUTCFullYear() < 1950 || d.getTime() > now.getTime() + 86400000) return undefined;
  return v;
}
function cents(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_CENTS ? v : undefined;
}
/** Keeps only the last four digits of anything number-like. A value with fewer than four digits is discarded. */
export function last4Only(v: unknown): string | undefined {
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const digits = String(v).replace(/[^0-9]/g, '');
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

export function validateExtraction(raw: unknown, now: Date = new Date()): ExtractionOutcome {
  if (!isObj(raw)) return { ok: false, reason: 'not_an_object' };
  const dropped: string[] = [];
  const accounts: ExtractedAccount[] = [];
  const rawAccounts = Array.isArray(raw.accounts) ? raw.accounts.slice(0, MAX_ACCOUNTS) : [];
  rawAccounts.forEach((a, i) => {
    if (!isObj(a)) { dropped.push(`account ${i}: not an object`); return; }
    const furnisher = text(a.furnisher_name, 120);
    if (!furnisher || furnisher.length < 2) { dropped.push(`account ${i}: no furnisher name`); return; }
    const low = new Set<string>(Array.isArray(a.low_confidence_fields) ? a.low_confidence_fields.filter((x): x is string => typeof x === 'string').slice(0, 20).map((x) => x.slice(0, 40)) : []);
    const out: ExtractedAccount = {
      furnisher_name: furnisher,
      account_type: pick(ACCOUNT_TYPES, a.account_type, 'other'),
      payment_status: pick(PAYMENT_STATUSES, a.payment_status, 'unknown'),
      is_collection: a.is_collection === true, is_charged_off: a.is_charged_off === true, low_confidence_fields: [],
    };
    if (a.account_type !== undefined && out.account_type === 'other' && a.account_type !== 'other') low.add('account_type');
    if (a.payment_status !== undefined && out.payment_status === 'unknown' && a.payment_status !== 'unknown') low.add('payment_status');
    const l4 = last4Only(a.account_number ?? a.account_last4); if (l4) out.account_last4 = l4;
    const oc = text(a.original_creditor, 120); if (oc) out.original_creditor = oc;
    const st = text(a.status_text, 80); if (st) out.status_text = st;
    for (const f of DATE_FIELDS) { if (a[f] === undefined || a[f] === null) continue; const d = isoDate(a[f], now); if (d) out[f] = d; else { low.add(f); dropped.push(`account ${i}: invalid ${f}`); } }
    for (const f of CENT_FIELDS) { if (a[f] === undefined || a[f] === null) continue; const c = cents(a[f]); if (c !== undefined) out[f] = c; else { low.add(f); dropped.push(`account ${i}: invalid ${f}`); } }
    out.low_confidence_fields = [...low];
    accounts.push(out);
  });
  const inquiries: ExtractionPayload['inquiries'] = [];
  (Array.isArray(raw.inquiries) ? raw.inquiries.slice(0, MAX_INQUIRIES) : []).forEach((q, i) => {
    if (!isObj(q)) return;
    const name = text(q.inquirer_name, 120); if (!name || name.length < 2) { dropped.push(`inquiry ${i}: no name`); return; }
    const inq: ExtractionPayload['inquiries'][number] = { inquirer_name: name, inquiry_kind: pick(INQUIRY_KINDS, q.inquiry_kind, 'unknown') };
    const d = isoDate(q.inquiry_date, now); if (d) inq.inquiry_date = d;
    inquiries.push(inq);
  });
  if (!accounts.length && !inquiries.length) return { ok: false, reason: 'nothing_extracted' };
  const payload: ExtractionPayload = { bureau: pick(BUREAUS, raw.bureau, 'unknown'), accounts, inquiries };
  const rd = isoDate(raw.report_date, now); if (rd) payload.report_date = rd;
  return { ok: true, payload, dropped };
}

/** Instruction for a vision model. It extracts what is printed; it must not judge, correct, or infer. */
export const EXTRACTION_INSTRUCTIONS =
  'You are transcribing a consumer credit report the member provided. Copy ONLY what is printed on the report. ' +
  'Do not judge accuracy, do not guess missing values, do not correct anything, do not add accounts. ' +
  'Omit any field you cannot read clearly and list it in low_confidence_fields. Dates are YYYY-MM-DD. Money is whole cents. ' +
  'Return only the tool result.';

/** JSON schema for a forced tool call. Account numbers are requested only so the last four digits can be kept. */
export const EXTRACTION_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    bureau: { type: 'string', enum: [...BUREAUS] },
    report_date: { type: 'string' },
    accounts: { type: 'array', items: { type: 'object', properties: {
      furnisher_name: { type: 'string' }, account_type: { type: 'string', enum: [...ACCOUNT_TYPES] }, account_number: { type: 'string' },
      original_creditor: { type: 'string' }, status_text: { type: 'string' }, payment_status: { type: 'string', enum: [...PAYMENT_STATUSES] },
      is_collection: { type: 'boolean' }, is_charged_off: { type: 'boolean' },
      opened_date: { type: 'string' }, closed_date: { type: 'string' }, last_reported_date: { type: 'string' }, first_delinquency_date: { type: 'string' },
      balance_cents: { type: 'integer' }, credit_limit_cents: { type: 'integer' }, monthly_payment_cents: { type: 'integer' },
      low_confidence_fields: { type: 'array', items: { type: 'string' } } }, required: ['furnisher_name'] } },
    inquiries: { type: 'array', items: { type: 'object', properties: { inquirer_name: { type: 'string' }, inquiry_date: { type: 'string' }, inquiry_kind: { type: 'string', enum: [...INQUIRY_KINDS] } }, required: ['inquirer_name'] } },
  },
  required: ['accounts'],
} as const;
