// Record Relief candidate-data importer. Implements docs/RECORD_RELIEF_DATA_OPERATIONS.md's spec exactly:
// research output is CANDIDATE DATA, never production law. VALIDATE / DRY-RUN / IMPORT. Import always inserts
// status='draft' - this code has no path that can ever set status='verified'. All-or-nothing per batch.
//
// This is the boundary between FairPath's Research/Data-Ops function (Perplexity, a researcher) and Engineering.
// Nothing here trusts the input's own claims about correctness - every check either passes on merit or the whole
// batch is REJECTED with a human-readable reason.

const DISPOSITIONS = ['conviction', 'dismissal', 'acquittal', 'deferred_adjudication', 'nolle_prosequi', 'arrest_no_charge'];
const OFFENSE_CLASSES = ['traffic_infraction', 'misdemeanor', 'non_violent_felony', 'violent_felony', 'sex_offense', 'dui_dwi', 'other'];
const REMEDIES = ['expungement', 'sealing', 'set_aside', 'certificate', 'automatic_clearing', 'other'];
const WAITING_ANCHORS = ['disposition_date', 'conviction_date', 'sentence_completion_date', 'supervision_completion_date', 'release_date', 'latest_completion'];
const SOURCE_AUTHORITIES = ['statute', 'court_rule', 'government_guidance', 'test_fixture'];
const MANUAL_REVIEW_FLAGS = ['juvenile', 'out_of_state_conviction'];
const FORM_KINDS = ['official_form', 'instructions', 'fee_waiver_form'];
const FORM_SCOPES = ['statewide', 'county', 'municipal', 'court_specific', 'other'];

const RULE_REQUIRED_FIELDS = [
  'kind', 'jurisdiction_code', 'rule_key', 'rule_version', 'remedy', 'title',
  'applies_dispositions', 'applies_offense_classes', 'waiting_anchor',
  'source_authority', 'source_url', 'citation_text', 'effective_from', 'researched_by',
];
const RULE_ALL_FIELDS = new Set([
  ...RULE_REQUIRED_FIELDS,
  'summary', 'excluded_offense_classes', 'waiting_years', 'waiting_months', 'waiting_days',
  'requires_fines_paid', 'requires_restitution_paid', 'requires_no_pending_charges', 'max_other_convictions',
  'manual_review_flags', 'fees', 'filing', 'required_documents', 'steps', 'form_keys',
  'effective_to', 'next_review_at', 'staff_notes', 'reviewed_by', 'data_origin', 'fixture_set', 'court_discretion',
]);

const FORM_REQUIRED_FIELDS = ['kind', 'jurisdiction_code', 'form_key', 'name', 'form_kind'];
const FORM_ALL_FIELDS = new Set([
  ...FORM_REQUIRED_FIELDS, 'revision', 'effective_date', 'official_source_url', 'remedies', 'scope', 'scope_detail',
  'auto_fillable', 'field_map', 'data_origin', 'fixture_set',
]);

// Federal pathways are structurally distinct from state rules (see docs/RECORD_RELIEF_NATIONWIDE_CAPABILITY_MATRIX.md
// and the Federal red-team package): they never drive the deterministic waiting-period engine, they're purely
// informational reference data. pathway_type/jurisdiction_subtype exist specifically so "pardon" never collapses
// into "expungement" and "United States Code" never collapses into "D.C. Code."
const PATHWAY_TYPES = ['pardon', 'commutation', 'remission', 'reprieve', 'judicial_expungement', 'statutory_relief', 'firearm_rights_restoration', 'other'];
const JURISDICTION_SUBTYPES = ['united_states_code', 'district_of_columbia_code', 'code_of_federal_regulations', 'uniform_code_of_military_justice', 'unknown'];
const PATHWAY_REQUIRED_FIELDS = [
  'kind', 'jurisdiction_code', 'pathway_key', 'pathway_version', 'title', 'description', 'pathway_type',
  'source_authority', 'source_url', 'citation_text', 'effective_from', 'researched_by',
];
const PATHWAY_ALL_FIELDS = new Set([
  ...PATHWAY_REQUIRED_FIELDS, 'is_general_expungement', 'applies_to', 'jurisdiction_subtype', 'effect_summary',
  'rights_not_restored', 'next_review_at', 'staff_notes', 'reviewed_by', 'data_origin', 'fixture_set',
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = (v) => (typeof v === 'string' && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v))) ? v : null;
const subsetOf = (arr, allowed) => Array.isArray(arr) && arr.every((v) => allowed.includes(v));

function reject(report, field, message) { report.status = 'REJECTED'; report.issues.push({ level: 'REJECTED', field, message }); }
function warn(report, field, message) { if (report.status === 'VALID') report.status = 'WARNING'; report.issues.push({ level: 'WARNING', field, message }); }

/** Pure structural + field-level validation - no database access. Matches the REJECTED-conditions table exactly. */
export function validateCandidate(input) {
  const report = { status: 'VALID', issues: [] };
  if (typeof input !== 'object' || input === null) { reject(report, '(root)', 'Input is not an object.'); return report; }

  if (input.kind === 'rule') return validateRule(input, report);
  if (input.kind === 'form') return validateForm(input, report);
  if (input.kind === 'federal_pathway') return validateFederalPathway(input, report);
  reject(report, 'kind', `Unknown kind "${input.kind}". Must be "rule", "form", or "federal_pathway".`);
  return report;
}

function rejectUnknownFields(input, allowed, report) {
  for (const key of Object.keys(input)) if (!allowed.has(key)) reject(report, key, `Unknown field "${key}" is not part of the candidate-data contract. Never silently dropped - the whole record is rejected.`);
}

function validateRule(input, report) {
  rejectUnknownFields(input, RULE_ALL_FIELDS, report);
  for (const f of RULE_REQUIRED_FIELDS) if (input[f] === undefined || input[f] === null || input[f] === '') reject(report, f, `Required field "${f}" is missing.`);
  if (report.status === 'REJECTED') return report; // don't cascade confusing secondary errors off missing required fields

  const isTest = input.data_origin === 'dev_fixture';

  if (!REMEDIES.includes(input.remedy)) reject(report, 'remedy', `"${input.remedy}" is not a known remedy (${REMEDIES.join(', ')}).`);
  if (typeof input.title !== 'string' || input.title.trim().length < 3 || input.title.trim().length > 160) reject(report, 'title', 'title must be 3-160 characters.');
  if (!subsetOf(input.applies_dispositions, DISPOSITIONS)) reject(report, 'applies_dispositions', `Must be a subset of ${DISPOSITIONS.join(', ')}.`);
  if (!subsetOf(input.applies_offense_classes, OFFENSE_CLASSES)) reject(report, 'applies_offense_classes', `Must be a subset of ${OFFENSE_CLASSES.join(', ')}.`);
  if (input.excluded_offense_classes !== undefined && !subsetOf(input.excluded_offense_classes, OFFENSE_CLASSES)) reject(report, 'excluded_offense_classes', `Must be a subset of ${OFFENSE_CLASSES.join(', ')}.`);
  if (!WAITING_ANCHORS.includes(input.waiting_anchor)) reject(report, 'waiting_anchor', `"${input.waiting_anchor}" is not a known waiting_anchor (${WAITING_ANCHORS.join(', ')}).`);
  if (input.manual_review_flags !== undefined && !subsetOf(input.manual_review_flags, MANUAL_REVIEW_FLAGS)) reject(report, 'manual_review_flags', `Must be a subset of ${MANUAL_REVIEW_FLAGS.join(', ')}. If research names a manual-review trigger not on this list, REJECT rather than force it into an existing value - that is a schema gap, not a data error (flag SCHEMA_LIMITATION).`);

  for (const [k, lo, hi] of [['waiting_years', 0, 50], ['waiting_months', 0, 11], ['waiting_days', 0, 365]]) {
    const v = input[k];
    if (v !== undefined && (typeof v !== 'number' || !Number.isInteger(v) || v < lo || v > hi)) reject(report, k, `${k} must be an integer between ${lo} and ${hi}.`);
  }
  if (input.max_other_convictions !== undefined && input.max_other_convictions !== null) {
    const v = input.max_other_convictions;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 50) reject(report, 'max_other_convictions', 'max_other_convictions must be an integer between 0 and 50.');
  }
  if (input.fees?.court_fee_cents !== undefined && (typeof input.fees.court_fee_cents !== 'number' || input.fees.court_fee_cents < 0)) reject(report, 'fees.court_fee_cents', 'court_fee_cents cannot be negative.');

  if (!isTest) {
    if (!input.source_url || typeof input.source_url !== 'string') reject(report, 'source_url', 'Official source URL is required for production candidate data.');
    else {
      let parsed = null;
      try { parsed = new URL(input.source_url); } catch { /* invalid */ }
      if (!parsed) reject(report, 'source_url', `"${input.source_url}" is not a well-formed URL.`);
      else if (parsed.protocol !== 'https:') reject(report, 'source_url', 'source_url must be https://.');
      else if (!/\.gov$/i.test(parsed.hostname) && !/courts?\./i.test(parsed.hostname)) reject(report, 'source_url', `"${parsed.hostname}" does not look like an official .gov or court domain. A source URL alone never establishes authority - human verification does - but a structurally implausible source is rejected at import time so it never reaches review.`);
    }
    if (!input.citation_text || typeof input.citation_text !== 'string' || !input.citation_text.trim()) reject(report, 'citation_text', 'citation_text is required for production candidate data.');
  } else if (!SOURCE_AUTHORITIES.includes(input.source_authority) || input.source_authority !== 'test_fixture') {
    if (input.source_authority && input.source_authority !== 'test_fixture') warn(report, 'source_authority', 'dev_fixture candidate data should normally use source_authority="test_fixture".');
  }
  if (!SOURCE_AUTHORITIES.includes(input.source_authority)) reject(report, 'source_authority', `"${input.source_authority}" is not a known source_authority.`);

  const from = isoDate(input.effective_from);
  if (!from) reject(report, 'effective_from', `"${input.effective_from}" is not a valid ISO date (YYYY-MM-DD).`);
  else {
    const oneYearOut = new Date(); oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
    if (new Date(from) > oneYearOut) reject(report, 'effective_from', 'effective_from is more than 1 year in the future - likely a data-entry error, not a real adopted-but-not-yet-effective rule.');
  }
  if (input.effective_to !== undefined && input.effective_to !== null) {
    const to = isoDate(input.effective_to);
    if (!to) reject(report, 'effective_to', `"${input.effective_to}" is not a valid ISO date.`);
    else if (from && to < from) reject(report, 'effective_to', 'effective_to is before effective_from.');
  }
  if (input.next_review_at !== undefined && input.next_review_at !== null) {
    const nr = isoDate(input.next_review_at);
    if (!nr) reject(report, 'next_review_at', `"${input.next_review_at}" is not a valid ISO date.`);
    else {
      if (input.last_verified_at) { const lv = isoDate(input.last_verified_at); if (lv && nr <= lv) reject(report, 'next_review_at', 'next_review_at must be after last_verified_at.'); }
      const threeYearsOut = new Date(); threeYearsOut.setFullYear(threeYearsOut.getFullYear() + 3);
      if (new Date(nr) > threeYearsOut) warn(report, 'next_review_at', 'next_review_at is more than 3 years out - unusually long for a legal-data recheck interval.');
    }
  }
  if (input.reviewed_by !== undefined && input.reviewed_by !== null && input.reviewed_by === input.researched_by) reject(report, 'reviewed_by', 'reviewed_by must be a different person than researched_by - a rule cannot self-verify.');
  if ((!input.manual_review_flags || input.manual_review_flags.length === 0) && input.applies_offense_classes?.includes('sex_offense')) warn(report, 'manual_review_flags', 'sex_offense coverage with no manual_review_flags set - the importer can only suggest, never force, a flag.');
  if (!input.staff_notes) warn(report, 'staff_notes', 'staff_notes empty on import - a second reviewer likely wants context.');
  if (typeof input.rule_version !== 'number' || !Number.isInteger(input.rule_version) || input.rule_version < 1) reject(report, 'rule_version', 'rule_version must be a positive integer.');
  if (typeof input.rule_key !== 'string' || !/^[a-z0-9][a-z0-9-]{2,80}$/.test(input.rule_key)) reject(report, 'rule_key', 'rule_key must match ^[a-z0-9][a-z0-9-]{2,80}$.');

  return report;
}

function validateForm(input, report) {
  rejectUnknownFields(input, FORM_ALL_FIELDS, report);
  for (const f of FORM_REQUIRED_FIELDS) if (input[f] === undefined || input[f] === null || input[f] === '') reject(report, f, `Required field "${f}" is missing.`);
  if (report.status === 'REJECTED') return report;

  if (!FORM_KINDS.includes(input.form_kind)) reject(report, 'form_kind', `"${input.form_kind}" is not a known form kind (${FORM_KINDS.join(', ')}).`);
  if (input.scope !== undefined && !FORM_SCOPES.includes(input.scope)) reject(report, 'scope', `"${input.scope}" is not a known scope (${FORM_SCOPES.join(', ')}). A local form must never default to statewide by omission - if research doesn't state a scope, flag SCHEMA_LIMITATION rather than guessing.`);
  if (input.scope && input.scope !== 'statewide' && !input.scope_detail) reject(report, 'scope_detail', 'A non-statewide scope (county/municipal/court_specific) requires scope_detail naming the specific county/municipality/court - otherwise a local form could be silently presented as covering the whole state.');
  if (input.form_kind === 'official_form') {
    if (!input.official_source_url) reject(report, 'official_source_url', 'An official_form requires official_source_url.');
    if (!input.revision) reject(report, 'revision', 'An official_form requires a revision identifier.');
    if (!input.effective_date || !isoDate(input.effective_date)) reject(report, 'effective_date', 'An official_form requires a valid effective_date.');
  }
  if (input.auto_fillable && !input.field_map) reject(report, 'field_map', 'auto_fillable=true requires a field_map - never invented.');
  return report;
}

function validateFederalPathway(input, report) {
  rejectUnknownFields(input, PATHWAY_ALL_FIELDS, report);
  for (const f of PATHWAY_REQUIRED_FIELDS) if (input[f] === undefined || input[f] === null || input[f] === '') reject(report, f, `Required field "${f}" is missing.`);
  if (report.status === 'REJECTED') return report;

  const isTest = input.data_origin === 'dev_fixture';
  if (!PATHWAY_TYPES.includes(input.pathway_type)) reject(report, 'pathway_type', `"${input.pathway_type}" is not a known pathway_type (${PATHWAY_TYPES.join(', ')}). Never default to "other" merely because the research didn't state one - if genuinely ambiguous, flag SCHEMA_LIMITATION.`);
  if (input.jurisdiction_subtype !== undefined && !JURISDICTION_SUBTYPES.includes(input.jurisdiction_subtype)) reject(report, 'jurisdiction_subtype', `"${input.jurisdiction_subtype}" is not a known jurisdiction_subtype (${JURISDICTION_SUBTYPES.join(', ')}).`);
  if (typeof input.title !== 'string' || input.title.trim().length < 3) reject(report, 'title', 'title must be at least 3 characters.');
  if (typeof input.pathway_key !== 'string' || !/^[a-z0-9][a-z0-9-]{2,80}$/.test(input.pathway_key)) reject(report, 'pathway_key', 'pathway_key must match ^[a-z0-9][a-z0-9-]{2,80}$.');
  if (typeof input.pathway_version !== 'number' || !Number.isInteger(input.pathway_version) || input.pathway_version < 1) reject(report, 'pathway_version', 'pathway_version must be a positive integer.');

  if (!isTest) {
    if (!input.source_url || typeof input.source_url !== 'string') reject(report, 'source_url', 'Official source URL is required for production candidate data.');
    else {
      let parsed = null;
      try { parsed = new URL(input.source_url); } catch { /* invalid */ }
      if (!parsed) reject(report, 'source_url', `"${input.source_url}" is not a well-formed URL.`);
      else if (parsed.protocol !== 'https:') reject(report, 'source_url', 'source_url must be https://.');
      else if (!/\.gov$/i.test(parsed.hostname) && !/courts?\./i.test(parsed.hostname)) reject(report, 'source_url', `"${parsed.hostname}" does not look like an official .gov or court domain.`);
    }
    if (!input.citation_text || typeof input.citation_text !== 'string' || !input.citation_text.trim()) reject(report, 'citation_text', 'citation_text is required for production candidate data.');
  }
  if (!SOURCE_AUTHORITIES.includes(input.source_authority)) reject(report, 'source_authority', `"${input.source_authority}" is not a known source_authority.`);

  const from = isoDate(input.effective_from);
  if (!from) reject(report, 'effective_from', `"${input.effective_from}" is not a valid ISO date (YYYY-MM-DD).`);
  else {
    const oneYearOut = new Date(); oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
    if (new Date(from) > oneYearOut) reject(report, 'effective_from', 'effective_from is more than 1 year in the future - likely a data-entry error.');
  }

  // Pathway-specific dangerous-equivalence guard, directly from the Federal red-team package: a pardon/
  // commutation/firearm-rights-restoration pathway must never carry is_general_expungement=true - that field
  // means "this IS a general expungement mechanism," and collapsing distinct clemency concepts into it is
  // exactly the failure mode the red-team named (PARDON = EXPUNGEMENT, COMMUTATION = RECORD CLEARING, etc.).
  const NEVER_GENERAL_EXPUNGEMENT = ['pardon', 'commutation', 'remission', 'reprieve', 'firearm_rights_restoration'];
  if (NEVER_GENERAL_EXPUNGEMENT.includes(input.pathway_type) && input.is_general_expungement === true) {
    reject(report, 'is_general_expungement', `pathway_type "${input.pathway_type}" can never have is_general_expungement=true - that would collapse a legally distinct clemency mechanism into "this is an expungement," exactly the dangerous equivalence the candidate-data contract prohibits.`);
  }
  if (input.pathway_type !== 'other' && !input.effect_summary) warn(report, 'effect_summary', 'No effect_summary provided - members will see only a title/description with no explicit "what this does and does not do" statement.');

  return report;
}

/** Database-dependent checks the pure validator above cannot do alone. db must expose db.query(sql, params). */
export async function validateAgainstDb(db, input, report) {
  if (report.status === 'REJECTED') return report; // structural failure already fatal, don't run DB checks on garbage
  if (input.kind === 'rule') {
    const jur = await db.query('select kind from public.record_relief_jurisdictions where code = $1', [input.jurisdiction_code]);
    if (jur.rows.length === 0) { reject(report, 'jurisdiction_code', `"${input.jurisdiction_code}" is not a known jurisdiction.`); return report; }
    const jurKind = jur.rows[0].kind;
    const isTestImport = input.data_origin === 'dev_fixture';
    if (isTestImport && jurKind !== 'test') reject(report, 'jurisdiction_code', `dev_fixture candidate data targets jurisdiction "${input.jurisdiction_code}" (kind=${jurKind}), which is not a TEST jurisdiction. TEST/real mismatch.`);
    if (!isTestImport && jurKind === 'test') reject(report, 'jurisdiction_code', `Production candidate data targets a TEST jurisdiction ("${input.jurisdiction_code}"). TEST/real mismatch.`);

    const dup = await db.query('select 1 from public.record_relief_rules where rule_key = $1 and rule_version = $2', [input.rule_key, input.rule_version]);
    if (dup.rows.length > 0) reject(report, 'rule_version', `(${input.rule_key}, v${input.rule_version}) already exists. A new version must increment rule_version, never overwrite.`);

    const overlap = await db.query(
      `select rule_key, rule_version from public.record_relief_rules
       where jurisdiction_code = $1 and remedy = $2 and status = 'verified' and rule_key <> $3
         and applies_offense_classes && $4::text[]
         and effective_from <= coalesce($5::date, 'infinity'::date)
         and (effective_to is null or effective_to >= $6::date)`,
      [input.jurisdiction_code, input.remedy, input.rule_key, input.applies_offense_classes ?? [], input.effective_to ?? null, input.effective_from],
    );
    if (overlap.rows.length > 0) reject(report, 'rule_key', `Another verified rule (${overlap.rows[0].rule_key} v${overlap.rows[0].rule_version}) already covers this jurisdiction/remedy/offense-class combination with an overlapping effective window. Two rules cannot both claim to be the current answer.`);
  }
  if (input.kind === 'form') {
    const jur = await db.query('select code from public.record_relief_jurisdictions where code = $1', [input.jurisdiction_code]);
    if (jur.rows.length === 0) reject(report, 'jurisdiction_code', `"${input.jurisdiction_code}" is not a known jurisdiction.`);
  }
  if (input.kind === 'federal_pathway') {
    const jur = await db.query('select kind from public.record_relief_jurisdictions where code = $1', [input.jurisdiction_code]);
    if (jur.rows.length === 0) { reject(report, 'jurisdiction_code', `"${input.jurisdiction_code}" is not a known jurisdiction.`); return report; }
    const jurKind = jur.rows[0].kind;
    const isTestImport = input.data_origin === 'dev_fixture';
    if (isTestImport && jurKind !== 'test') reject(report, 'jurisdiction_code', `dev_fixture candidate data targets jurisdiction "${input.jurisdiction_code}" (kind=${jurKind}), which is not a TEST jurisdiction. TEST/real mismatch.`);
    if (!isTestImport && jurKind === 'test') reject(report, 'jurisdiction_code', `Production candidate data targets a TEST jurisdiction ("${input.jurisdiction_code}"). TEST/real mismatch.`);
    if (!isTestImport && jurKind !== 'federal') reject(report, 'jurisdiction_code', `federal_pathway candidates must target a jurisdiction of kind='federal' (got kind=${jurKind}). Federal pathways are never state rules.`);

    const dup = await db.query('select 1 from public.record_relief_federal_pathways where pathway_key = $1 and pathway_version = $2', [input.pathway_key, input.pathway_version]);
    if (dup.rows.length > 0) reject(report, 'pathway_version', `(${input.pathway_key}, v${input.pathway_version}) already exists. A new version must increment pathway_version, never overwrite.`);
  }
  return report;
}

/** IMPORT: only proceeds on VALID (or WARNING with allowWarnings). Always inserts status='draft'. All-or-nothing. */
export async function importBatch(db, candidates, { allowWarnings = false, dryRun = false } = {}) {
  const reports = [];
  for (const input of candidates) {
    const structural = validateCandidate(input);
    const full = await validateAgainstDb(db, input, structural);
    reports.push({ input, report: full });
  }
  const blocked = reports.filter((r) => r.report.status === 'REJECTED' || (r.report.status === 'WARNING' && !allowWarnings));
  if (blocked.length > 0) return { imported: false, dryRun, reports, reason: `${blocked.length} of ${candidates.length} record(s) did not pass validation. Nothing was imported (all-or-nothing).` };
  if (dryRun) return { imported: false, dryRun: true, reports, reason: 'Dry run: validation passed for all records; nothing was written.' };

  const inserted = [];
  try {
    await db.query('begin');
    for (const { input } of reports) {
      if (input.kind === 'rule') {
        const r = await db.query(
          `insert into public.record_relief_rules
             (rule_key, rule_version, jurisdiction_code, remedy, title, summary, applies_dispositions, applies_offense_classes,
              excluded_offense_classes, waiting_years, waiting_months, waiting_days, waiting_anchor,
              requires_fines_paid, requires_restitution_paid, requires_no_pending_charges, max_other_convictions,
              manual_review_flags, fees, filing, required_documents, steps, form_keys,
              source_authority, source_url, citation_text, effective_from, effective_to,
              researched_by, next_review_at, staff_notes, data_origin, fixture_set, court_discretion, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,'draft')
           returning id`,
          [input.rule_key, input.rule_version, input.jurisdiction_code, input.remedy, input.title, input.summary ?? null,
            input.applies_dispositions, input.applies_offense_classes, input.excluded_offense_classes ?? [],
            input.waiting_years ?? 0, input.waiting_months ?? 0, input.waiting_days ?? 0, input.waiting_anchor,
            input.requires_fines_paid ?? false, input.requires_restitution_paid ?? false, input.requires_no_pending_charges ?? false,
            input.max_other_convictions ?? null, input.manual_review_flags ?? [],
            JSON.stringify(input.fees ?? {}), JSON.stringify(input.filing ?? {}), JSON.stringify(input.required_documents ?? []),
            JSON.stringify(input.steps ?? []), input.form_keys ?? [], input.source_authority, input.source_url, input.citation_text,
            input.effective_from, input.effective_to ?? null, input.researched_by, input.next_review_at ?? null,
            input.staff_notes ?? null, input.data_origin ?? 'production', input.fixture_set ?? null, input.court_discretion ?? false],
        );
        inserted.push({ kind: 'rule', id: r.rows[0].id, rule_key: input.rule_key, rule_version: input.rule_version });
      } else if (input.kind === 'form') {
        const r = await db.query(
          `insert into public.record_relief_forms
             (form_key, jurisdiction_code, name, kind, revision, effective_date, official_source_url, remedies,
              scope, scope_detail, auto_fillable, field_map, data_origin, fixture_set, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft')
           returning id`,
          [input.form_key, input.jurisdiction_code, input.name, input.form_kind, input.revision ?? null, input.effective_date ?? null,
            input.official_source_url ?? null, input.remedies ?? [], input.scope ?? 'statewide', input.scope_detail ?? null,
            input.auto_fillable ?? false, input.field_map ? JSON.stringify(input.field_map) : null,
            input.data_origin ?? 'production', input.fixture_set ?? null],
        );
        inserted.push({ kind: 'form', id: r.rows[0].id, form_key: input.form_key });
      } else if (input.kind === 'federal_pathway') {
        const r = await db.query(
          `insert into public.record_relief_federal_pathways
             (pathway_key, pathway_version, title, description, is_general_expungement, applies_to,
              source_authority, source_url, citation_text, effective_from, jurisdiction_subtype, pathway_type,
              effect_summary, rights_not_restored, next_review_at, reviewed_by, staff_notes, data_origin, fixture_set, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'draft')
           returning id`,
          [input.pathway_key, input.pathway_version, input.title, input.description,
            input.is_general_expungement ?? false, input.applies_to ?? null,
            input.source_authority, input.source_url, input.citation_text, input.effective_from,
            input.jurisdiction_subtype ?? 'unknown', input.pathway_type,
            input.effect_summary ?? null, input.rights_not_restored ?? null,
            input.next_review_at ?? null, input.reviewed_by ?? null, input.staff_notes ?? null,
            input.data_origin ?? 'production', input.fixture_set ?? null],
        );
        inserted.push({ kind: 'federal_pathway', id: r.rows[0].id, pathway_key: input.pathway_key, pathway_version: input.pathway_version });
      }
    }
    await db.query('commit');
  } catch (e) {
    await db.query('rollback');
    return { imported: false, dryRun: false, reports, reason: `Import failed mid-batch and was rolled back: ${e.message}` };
  }
  return { imported: true, dryRun: false, reports, inserted };
}
