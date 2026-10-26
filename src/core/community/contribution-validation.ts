const PRIVATE_PATTERNS = [
  /\bcase[_\s-]?number\b/i,
  /\bdocket\b/i,
  /\bssn\b/i,
  /social security/i,
  /date of birth/i,
  /\bdefendant\b/i,
  /\bvictim\b/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
];

const MAX_FIELD = 2000;
const MAX_NAME = 80;

export function containsPrivateContributionText(text: string): boolean {
  return PRIVATE_PATTERNS.some((re) => re.test(text));
}

export function sanitizeContributionPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    if (typeof v === 'string') {
      const trimmed = v.trim().slice(0, k === 'display_name' ? MAX_NAME : MAX_FIELD);
      if (trimmed) out[k] = trimmed;
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      out[k] = v;
    }
  }
  return out;
}

export function validateResourceAddPayload(p: Record<string, unknown>): string | null {
  if (!String(p.resource_name ?? '').trim()) return 'Add a resource name.';
  if (!String(p.description ?? '').trim()) return 'Add a short description.';
  if (!String(p.service_area ?? '').trim() && !String(p.city ?? '').trim()) return 'Add a location or service area.';
  return null;
}

export function validateResourceEditPayload(p: Record<string, unknown>): string | null {
  if (!String(p.proposed_change ?? '').trim()) return 'Describe what should change.';
  if (!String(p.source_url ?? '').trim()) return 'Add an official source link when possible.';
  return null;
}

export function validateRecordReliefSourcePayload(p: Record<string, unknown>): string | null {
  if (!String(p.jurisdiction_code ?? p.state ?? '').trim()) return 'Add the state or jurisdiction.';
  if (!String(p.official_form_url ?? p.source_url ?? '').trim() && !String(p.proposed_correction ?? '').trim()) {
    return 'Add an official form link or describe the correction.';
  }
  if (p.case_document_id || p.upload_case_file) {
    return 'Do not upload personal court records. Share official public links only.';
  }
  return null;
}
