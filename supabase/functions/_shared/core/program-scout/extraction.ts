// Program Scout extraction boundary (pure, no I/O). An AI extraction engine returns UNTRUSTED structured JSON;
// this module is the only thing allowed to turn it into a program_candidates row shape.
//
// Rules enforced here:
//  * Nothing is invented. A field the model did not actually find stays null/undefined - the model must list
//    any field it is uncertain about in uncertain_fields rather than guessing, and this validator strips
//    anything that fails basic sanity checks rather than "fixing" it.
//  * This produces a CANDIDATE, never truth. Promotion to a real program is a separate, explicit step.
//  * Unknown stays unknown - there is no fallback/default benefit amount, domain, or date.

const DOMAINS = ['employment', 'housing', 'record_relief', 'education_training', 'transportation', 'childcare', 'benefits', 'small_business', 'financial_assistance'] as const;
const BENEFIT_TYPES = [
  'tax_credit', 'tax_deduction', 'wage_reimbursement', 'training_reimbursement', 'grant', 'tax_refund',
  'bond_coverage', 'job_creation_credit', 'payroll_credit', 'direct_assistance', 'rental_subsidy',
  'security_deposit_assistance', 'move_in_assistance', 'lease_up_bonus', 'vacancy_payment', 'damage_mitigation',
  'rent_loss_protection', 'training_funding', 'transportation_assistance', 'childcare_assistance', 'fee_waiver',
  'loan', 'loan_guarantee', 'legal_relief', 'other',
] as const;
const JURISDICTION_LEVELS = ['federal', 'state', 'local'] as const;
const STATE_CODES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);

export type CandidateExtraction = {
  program_name?: string; program_domain?: string; program_subtype?: string; administering_authority?: string;
  jurisdiction_level?: string; jurisdiction_state?: string; target_recipient?: string; benefit_type?: string;
  benefit_amount?: number; benefit_minimum?: number; benefit_maximum?: number; benefit_percentage?: number;
  effective_date?: string; expiration_date?: string; application_period?: string; funding_limited?: boolean;
  eligibility_criteria?: string; required_documentation?: string; application_process?: string; source_section?: string;
  confidence?: number; uncertain_fields: string[];
};
export type ExtractionOutcome = { ok: true; candidate: CandidateExtraction; dropped: string[] } | { ok: false; reason: 'not_an_object' | 'nothing_extracted' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length >= 1 ? t.slice(0, max) : undefined;
};
const pick = <T extends readonly string[]>(list: T, v: unknown): T[number] | undefined => (typeof v === 'string' && (list as readonly string[]).includes(v) ? v : undefined);
const num = (v: unknown, min: number, max: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
function isoDate(v: unknown): string | undefined {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(v + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? undefined : v;
}

export function validateCandidateExtraction(raw: unknown): ExtractionOutcome {
  if (!isObj(raw)) return { ok: false, reason: 'not_an_object' };
  const dropped: string[] = [];
  const drop = (field: string, why: string) => dropped.push(`${field}: ${why}`);

  const program_name = text(raw.program_name, 200);
  if (raw.program_name !== undefined && !program_name) drop('program_name', 'invalid');
  const program_domain = pick(DOMAINS, raw.program_domain);
  if (raw.program_domain !== undefined && !program_domain) drop('program_domain', 'not a recognized domain');
  const benefit_type = pick(BENEFIT_TYPES, raw.benefit_type);
  if (raw.benefit_type !== undefined && !benefit_type) drop('benefit_type', 'not a recognized benefit type');
  const jurisdiction_level = pick(JURISDICTION_LEVELS, raw.jurisdiction_level);
  if (raw.jurisdiction_level !== undefined && !jurisdiction_level) drop('jurisdiction_level', 'invalid');
  let jurisdiction_state = text(raw.jurisdiction_state, 2)?.toUpperCase();
  if (jurisdiction_state && !STATE_CODES.has(jurisdiction_state)) { drop('jurisdiction_state', 'not a recognized state/DC code'); jurisdiction_state = undefined; }

  const effective_date = isoDate(raw.effective_date);
  if (raw.effective_date !== undefined && !effective_date) drop('effective_date', 'not a valid ISO date');
  const expiration_date = isoDate(raw.expiration_date);
  if (raw.expiration_date !== undefined && !expiration_date) drop('expiration_date', 'not a valid ISO date');

  const confidence = num(raw.confidence, 0, 1);
  if (raw.confidence !== undefined && confidence === undefined) drop('confidence', 'out of 0..1 range');

  const uncertainRaw = Array.isArray(raw.uncertain_fields) ? raw.uncertain_fields : [];
  const uncertain_fields = uncertainRaw.filter((f): f is string => typeof f === 'string').slice(0, 20);

  const candidate: CandidateExtraction = {
    program_name, program_domain, program_subtype: text(raw.program_subtype, 100),
    administering_authority: text(raw.administering_authority, 200), jurisdiction_level, jurisdiction_state,
    target_recipient: text(raw.target_recipient, 300), benefit_type,
    benefit_amount: num(raw.benefit_amount, 0, 100_000_000), benefit_minimum: num(raw.benefit_minimum, 0, 100_000_000),
    benefit_maximum: num(raw.benefit_maximum, 0, 100_000_000), benefit_percentage: num(raw.benefit_percentage, 0, 100),
    effective_date, expiration_date, application_period: text(raw.application_period, 300),
    funding_limited: typeof raw.funding_limited === 'boolean' ? raw.funding_limited : undefined,
    eligibility_criteria: text(raw.eligibility_criteria, 2000), required_documentation: text(raw.required_documentation, 1000),
    application_process: text(raw.application_process, 1000), source_section: text(raw.source_section, 200),
    confidence, uncertain_fields,
  };
  if (!program_name && !benefit_type) return { ok: false, reason: 'nothing_extracted' };
  return { ok: true, candidate, dropped };
}

export const EXTRACTION_INSTRUCTIONS = `You are extracting STRUCTURED FACTS about a government/institutional economic-opportunity program from the provided source text. You are reading one authoritative source document - extract only what it actually states.

Rules:
- Never invent or estimate a number, date, or rule that is not stated in the text. If the text does not state it, omit the field entirely.
- If a fact is stated but you are not fully confident in your reading of it, still extract it, but add its field name to uncertain_fields.
- Set confidence to your overall confidence (0 to 1) that program_name, benefit_type, and the benefit amount/percentage (if present) were read correctly.
- jurisdiction_state must be a 2-letter USPS state code or "DC" - omit it if the program is federal or you cannot determine the state.
- Only extract ONE program per call, the most clearly described program in the text. If the text describes multiple distinct programs, extract the most prominent one.
- Do not summarize or paraphrase eligibility_criteria/required_documentation/application_process beyond condensing for length - keep them close to the source's own language.`;

export const EXTRACTION_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    program_name: { type: 'string' }, program_domain: { type: 'string', enum: [...DOMAINS] },
    program_subtype: { type: 'string' }, administering_authority: { type: 'string' },
    jurisdiction_level: { type: 'string', enum: [...JURISDICTION_LEVELS] }, jurisdiction_state: { type: 'string' },
    target_recipient: { type: 'string' }, benefit_type: { type: 'string', enum: [...BENEFIT_TYPES] },
    benefit_amount: { type: 'number' }, benefit_minimum: { type: 'number' }, benefit_maximum: { type: 'number' },
    benefit_percentage: { type: 'number' }, effective_date: { type: 'string', description: 'YYYY-MM-DD' },
    expiration_date: { type: 'string', description: 'YYYY-MM-DD' }, application_period: { type: 'string' },
    funding_limited: { type: 'boolean' }, eligibility_criteria: { type: 'string' }, required_documentation: { type: 'string' },
    application_process: { type: 'string' }, source_section: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    uncertain_fields: { type: 'array', items: { type: 'string' } },
  },
  required: ['uncertain_fields'],
};
