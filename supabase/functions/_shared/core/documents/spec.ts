// The ONE document specification. A builder turns confirmed data into a DocumentSpec; the same spec then drives the
// in-app preview, the PDF, the DOCX and the CSV, so what the member reviews is exactly what is exported.
// Pure module (no runtime imports) so it runs under Node for audits and inside the Edge Function unchanged.

export type DocFormat = 'pdf' | 'docx' | 'csv';
export type DocAudience = 'self' | 'landlord' | 'employer' | 'caseworker';
export type DocSensitivity = 'standard' | 'sensitive' | 'highly_sensitive';
export type DocKind = 'summary' | 'worksheet' | 'letter' | 'checklist' | 'packet_part' | 'official_form';

export type DocBlock =
  | { type: 'heading'; text: string; level?: 1 | 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'keyvalue'; items: { label: string; value: string }[] }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'checklist'; items: { text: string; note?: string; checked?: boolean }[] }
  | { type: 'bullets'; items: string[] }
  | { type: 'notice'; text: string; tone?: 'info' | 'warning' }
  | { type: 'editable'; label: string; value: string; hint?: string }
  | { type: 'spacer' };

export type OfficialFormRef = { form_id: string; source_url: string; verified_at: string; jurisdiction?: string; revision?: string };

export type DocumentSpec = {
  documentType: string;
  sourceModule: string;
  sourceRecordId: string | null;
  templateId: string;
  templateVersion: string;
  title: string;
  /** Used ONLY for the file name (never a person's name or an identifier). */
  subject: string;
  audience: DocAudience;
  sensitivity: DocSensitivity;
  kind: DocKind;
  formats: DocFormat[];
  blocks: DocBlock[];
  /** Optional structured export for CSV. */
  csv?: { columns: string[]; rows: string[][] };
  /** Present only for a real, verified official form (server-generated). */
  officialFormRef?: OfficialFormRef | null;
  /** ISO timestamp of the confirmed data this was built from. */
  confirmedDataAt: string;
  /** Canonical inputs, hashed for stale detection. Never rendered. */
  inputs: unknown;
  footer: string;
  /** Non-identifying code of the options used (e.g. the Opportunity Profile's include toggles). */
  optionsCode?: string;
};

/** Stable JSON: object keys sorted, so the same data always hashes the same. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  return '{' + Object.keys(obj).sort().filter((k) => obj[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

/** cyrb53: a fast non-cryptographic hash, used only to detect "the inputs changed since this was generated". */
export function fingerprintOf(inputs: unknown): string {
  const str = stableStringify(inputs);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

const SAFE_TOKEN_MAX = 60;
/** Mirrors public.document_safe_token in SQL. */
export function safeFileToken(text: string): string {
  const cleaned = (text ?? '').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, SAFE_TOKEN_MAX);
  return cleaned || 'Document';
}

/** Mirrors public.document_file_name in SQL: FairPath_{Subject}_{YYYY-MM-DD}[_vN].{ext} */
export function documentFileName(subject: string, ext: DocFormat, version: number, on: Date): string {
  const y = on.getFullYear();
  const m = String(on.getMonth() + 1).padStart(2, '0');
  const d = String(on.getDate()).padStart(2, '0');
  return `FairPath_${safeFileToken(subject)}_${y}-${m}-${d}${version > 1 ? '_v' + version : ''}.${ext}`;
}

export const MIME: Record<DocFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv',
};

/** RFC 4180 CSV with a UTF-8 BOM (Excel) and spreadsheet-formula injection neutralized. */
export function toCsv(columns: string[], rows: string[][]): string {
  const cell = (v: string) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + [columns, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** Plain text of a spec (used by tests and the accessibility text view of the preview). */
export function specToText(spec: DocumentSpec): string {
  const out: string[] = [spec.title];
  for (const b of spec.blocks) {
    switch (b.type) {
      case 'heading': out.push(b.text); break;
      case 'paragraph': case 'notice': out.push(b.text); break;
      case 'keyvalue': for (const i of b.items) out.push(`${i.label}: ${i.value}`); break;
      case 'table': out.push(b.columns.join(' | ')); for (const r of b.rows) out.push(r.join(' | ')); break;
      case 'checklist': for (const i of b.items) out.push(`[${i.checked ? 'x' : ' '}] ${i.text}${i.note ? ' - ' + i.note : ''}`); break;
      case 'bullets': for (const i of b.items) out.push('- ' + i); break;
      case 'editable': out.push(`${b.label}: ${b.value}`); break;
      default: break;
    }
  }
  out.push(spec.footer);
  return out.join('\n');
}
