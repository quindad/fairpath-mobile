// Resource Scout extraction boundary (pure, no I/O) -- the member-resource equivalent of
// _shared/core/program-scout/extraction.ts. An AI extraction engine returns UNTRUSTED structured JSON; this
// module is the only thing allowed to turn it into a member_resource_candidates row shape.
//
// Rules enforced here, same discipline as program-scout:
//  * Nothing is invented. A field the model did not actually find stays undefined.
//  * This produces a CANDIDATE, never truth. Promotion to a real resource is a separate, explicit step.
//  * Unknown stays unknown -- no fallback cost type, category, or eligibility text.

const RESOURCE_KINDS = ['program', 'service', 'benefit', 'hotline', 'document_help', 'course_link'] as const;
const COST_TYPES = ['free', 'sliding', 'paid', 'unknown'] as const;
const CATEGORY_SLUGS = [
  'emergency_help', 'food', 'housing', 'health_wellness', 'id_documents', 'jobs', 'legal_record_relief',
  'benefits', 'transportation', 'money', 'banking', 'credit', 'education', 'family', 'clothing', 'technology',
  'entrepreneurship',
] as const;
const STATE_CODES = new Set(['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC']);

export type ResourceCandidateExtraction = {
  title?: string; summary?: string; description?: string; resource_kind?: string; category_slugs: string[];
  cost_type?: string; eligibility_summary?: string; official_source_url?: string; application_url?: string;
  state_code?: string; is_national?: boolean; confidence?: number; uncertain_fields: string[];
};
export type ExtractionOutcome = { ok: true; candidate: ResourceCandidateExtraction; dropped: string[] } | { ok: false; reason: 'not_an_object' | 'nothing_extracted' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length >= 1 ? t.slice(0, max) : undefined;
};
const pick = <T extends readonly string[]>(list: T, v: unknown): T[number] | undefined => (typeof v === 'string' && (list as readonly string[]).includes(v) ? v : undefined);
const num = (v: unknown, min: number, max: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const url = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:' ? v.slice(0, 500) : undefined; } catch { return undefined; }
};

export function validateResourceCandidateExtraction(raw: unknown): ExtractionOutcome {
  if (!isObj(raw)) return { ok: false, reason: 'not_an_object' };
  const dropped: string[] = [];
  const drop = (field: string, why: string) => dropped.push(`${field}: ${why}`);

  const title = text(raw.title, 200);
  if (raw.title !== undefined && !title) drop('title', 'invalid');
  const summary = text(raw.summary, 500);
  if (raw.summary !== undefined && !summary) drop('summary', 'invalid');
  const resource_kind = pick(RESOURCE_KINDS, raw.resource_kind);
  if (raw.resource_kind !== undefined && !resource_kind) drop('resource_kind', 'not a recognized kind');
  const cost_type = pick(COST_TYPES, raw.cost_type);
  if (raw.cost_type !== undefined && !cost_type) drop('cost_type', 'not a recognized cost type');
  const official_source_url = url(raw.official_source_url);
  if (raw.official_source_url !== undefined && !official_source_url) drop('official_source_url', 'not a valid http(s) url');
  const application_url = url(raw.application_url);
  if (raw.application_url !== undefined && !application_url) drop('application_url', 'not a valid http(s) url');
  let state_code = text(raw.state_code, 2)?.toUpperCase();
  if (state_code && !STATE_CODES.has(state_code)) { drop('state_code', 'not a recognized state/DC code'); state_code = undefined; }

  const categoriesRaw = Array.isArray(raw.category_slugs) ? raw.category_slugs : [];
  const category_slugs = categoriesRaw.filter((c): c is string => typeof c === 'string' && (CATEGORY_SLUGS as readonly string[]).includes(c)).slice(0, 5);
  if (categoriesRaw.length && !category_slugs.length) drop('category_slugs', 'none matched a recognized category');

  const confidence = num(raw.confidence, 0, 1);
  if (raw.confidence !== undefined && confidence === undefined) drop('confidence', 'out of 0..1 range');

  const uncertainRaw = Array.isArray(raw.uncertain_fields) ? raw.uncertain_fields : [];
  const uncertain_fields = uncertainRaw.filter((f): f is string => typeof f === 'string').slice(0, 20);

  const candidate: ResourceCandidateExtraction = {
    title, summary, description: text(raw.description, 2000), resource_kind, category_slugs,
    cost_type, eligibility_summary: text(raw.eligibility_summary, 500), official_source_url, application_url,
    state_code, is_national: typeof raw.is_national === 'boolean' ? raw.is_national : undefined,
    confidence, uncertain_fields,
  };
  if (!title || !summary) return { ok: false, reason: 'nothing_extracted' };
  return { ok: true, candidate, dropped };
}

export const EXTRACTION_INSTRUCTIONS = `You are extracting STRUCTURED FACTS about a real-world resource for people navigating reentry, poverty, or housing/job instability (food assistance, housing help, job training, legal aid, benefits, crisis hotlines, etc.) from the provided source text. You are reading one authoritative source document -- extract only what it actually states.

Rules:
- Never invent or estimate a fact, phone number, cost, or eligibility rule not stated in the text. If the text does not state it, omit the field entirely.
- If a fact is stated but you are not fully confident in your reading of it, still extract it, but add its field name to uncertain_fields.
- Set confidence to your overall confidence (0 to 1) that title, summary, and resource_kind were read correctly.
- state_code must be a 2-letter USPS state code or "DC" -- omit it if the resource is national or you cannot determine the state. Set is_national true only if the text itself says the resource serves the whole country.
- category_slugs: choose 1-3 from this exact list only, based on what the resource actually does: emergency_help, food, housing, health_wellness, id_documents, jobs, legal_record_relief, benefits, transportation, money, banking, credit, education, family, clothing, technology, entrepreneurship.
- Only extract ONE resource per call, the most clearly described one in the text. If the text describes multiple distinct resources, extract the most prominent one.
- Keep summary and eligibility_summary close to the source's own language, condensed for length, never embellished.`;

export const EXTRACTION_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' }, summary: { type: 'string' }, description: { type: 'string' },
    resource_kind: { type: 'string', enum: [...RESOURCE_KINDS] },
    category_slugs: { type: 'array', items: { type: 'string', enum: [...CATEGORY_SLUGS] } },
    cost_type: { type: 'string', enum: [...COST_TYPES] },
    eligibility_summary: { type: 'string' }, official_source_url: { type: 'string' }, application_url: { type: 'string' },
    state_code: { type: 'string' }, is_national: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    uncertain_fields: { type: 'array', items: { type: 'string' } },
  },
  required: ['uncertain_fields'],
};
