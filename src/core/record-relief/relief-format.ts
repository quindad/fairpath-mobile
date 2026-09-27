// Pure helpers for the Record Relief workspace (no imports; runnable under Node by audits).
//
// LEGAL-SAFETY RULES encoded here: outcomes are always worded "potentially ..."; there is no wording that says a
// member "is eligible", "will qualify" or "should file"; missing or unverified rule data is said plainly; a court decides.

export type Outcome =
  | 'potentially_eligible_now' | 'waiting_period' | 'potentially_ineligible' | 'insufficient_information' | 'manual_review' | 'rule_unavailable' | 'federal_separate';

export const OUTCOME_INFO: Record<Outcome, { label: string; tone: 'good' | 'wait' | 'stop' | 'info' | 'warn'; summary: string }> = {
  potentially_eligible_now: { label: 'POTENTIALLY ELIGIBLE NOW', tone: 'good', summary: 'Based on what you entered, you appear to meet this rule\'s conditions. A court makes the decision, and this is not legal advice.' },
  waiting_period: { label: 'WAITING PERIOD', tone: 'wait', summary: 'This rule has a waiting period that has not ended yet.' },
  potentially_ineligible: { label: 'POTENTIALLY INELIGIBLE UNDER THIS RULE', tone: 'stop', summary: 'Something you entered does not fit this rule. Other rules or a court may see it differently.' },
  insufficient_information: { label: 'MORE INFORMATION NEEDED', tone: 'info', summary: 'FairPath cannot check this rule until you add the missing information.' },
  manual_review: { label: 'MANUAL REVIEW RECOMMENDED', tone: 'warn', summary: 'Something about this case is best reviewed by a person, such as a legal aid organization or the court clerk.' },
  rule_unavailable: { label: 'RULE NOT VERIFIED YET', tone: 'info', summary: 'FairPath does not have verified rules for this jurisdiction yet, so it cannot say anything about eligibility.' },
  federal_separate: { label: 'FEDERAL CASE (SEPARATE)', tone: 'info', summary: 'Federal cases are handled separately from state record relief.' },
};

export const DISCLAIMER = 'FairPath provides legal information, not legal advice, and is not a law firm. Record-relief rules are specific to each jurisdiction and change. A court decides whether relief is granted. A legal aid organization or the court clerk can confirm what applies to you.';

export const OFFENSE_CLASS_OPTIONS = [
  { value: 'misdemeanor', label: 'Misdemeanor' }, { value: 'non_violent_felony', label: 'Non-violent felony' }, { value: 'violent_felony', label: 'Violent felony' },
  { value: 'sex_offense', label: 'Sex offense' }, { value: 'dui_dwi', label: 'DUI / DWI' }, { value: 'traffic_infraction', label: 'Traffic infraction' }, { value: 'other', label: 'Other / not sure' },
];
export const DISPOSITION_OPTIONS = [
  { value: 'conviction', label: 'Conviction' }, { value: 'dismissal', label: 'Dismissed' }, { value: 'acquittal', label: 'Acquitted' },
  { value: 'deferred_adjudication', label: 'Deferred' }, { value: 'nolle_prosequi', label: 'Not prosecuted' }, { value: 'arrest_no_charge', label: 'Arrest, no charge' },
];
export const FILING_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' }, { value: 'preparing', label: 'Preparing' }, { value: 'filed', label: 'Filed' },
  { value: 'hearing_scheduled', label: 'Hearing scheduled' }, { value: 'granted', label: 'Granted' }, { value: 'denied', label: 'Denied' }, { value: 'withdrawn', label: 'Withdrawn' },
];
export const REMEDY_LABEL: Record<string, string> = { expungement: 'Expungement', sealing: 'Sealing', set_aside: 'Set-aside', certificate: 'Certificate', automatic_clearing: 'Automatic clearing', other: 'Other relief' };
export const ANCHOR_LABEL: Record<string, string> = {
  disposition_date: 'the disposition date', conviction_date: 'the conviction date', sentence_completion_date: 'the sentence completion date',
  supervision_completion_date: 'the supervision completion date', release_date: 'the release date', latest_completion: 'the latest completion date',
};
export const MISSING_LABEL: Record<string, string> = {
  fines_paid: 'Whether fines are paid', restitution_paid: 'Whether restitution is paid', pending_charges: 'Whether you have pending charges', other_convictions_count: 'How many other convictions you have',
  sentence_completion_date: 'Sentence completion date', supervision_completion_date: 'Supervision completion date', release_date: 'Release date', disposition_date: 'Disposition date',
  conviction_date: 'Conviction date', completion_dates: 'A sentence, supervision or release completion date',
};

/** Calendar-accurate "X years, Y months, Z days" between two ISO dates (UTC calendar days). */
export function describeRemaining(fromIso: string, toIso: string): string {
  const p = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  const a = p(fromIso), b = p(toIso);
  if (!a || !b) return '';
  const toUtc = Date.UTC(b.y, b.m - 1, b.d);
  if (toUtc < Date.UTC(a.y, a.m - 1, a.d)) return '';
  // Whole months are counted by adding calendar months to the start date (clamping to month end), so Jan 31 + 1 month = Feb 28.
  const addMonths = (n: number) => {
    const y = a.y + Math.floor((a.m - 1 + n) / 12);
    const m = ((a.m - 1 + n) % 12) + 1;
    return Date.UTC(y, m - 1, Math.min(a.d, new Date(Date.UTC(y, m, 0)).getUTCDate()));
  };
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  while (months > 0 && addMonths(months) > toUtc) months--;
  const days = Math.round((toUtc - addMonths(months)) / 86400000);
  const years = Math.floor(months / 12);
  months = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (months) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  if (days || !parts.length) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  return parts.join(', ');
}

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function countdownText(outcome: Outcome, eligibilityDate: string | null, daysRemaining: number | null, now = new Date()): string {
  if (outcome === 'potentially_eligible_now') return 'The waiting period (if any) has ended under this rule.';
  if (outcome !== 'waiting_period' || !eligibilityDate) return '';
  const left = describeRemaining(todayIso(now), eligibilityDate);
  return `Potentially eligible on ${eligibilityDate}${left ? ` · ${left} remaining` : ''}${daysRemaining != null ? ` (${daysRemaining} days)` : ''}`;
}

/** Best (most actionable) outcome across a case's evaluations, for list rows. Deterministic. */
export function headlineOutcome(evals: { outcome: Outcome; eligibility_date: string | null }[]): { outcome: Outcome; eligibility_date: string | null } | null {
  if (!evals.length) return null;
  const rank: Record<Outcome, number> = { potentially_eligible_now: 0, waiting_period: 1, insufficient_information: 2, manual_review: 3, potentially_ineligible: 4, rule_unavailable: 5, federal_separate: 6 };
  return [...evals].sort((a, b) => rank[a.outcome] - rank[b.outcome] || String(a.eligibility_date ?? '9999').localeCompare(String(b.eligibility_date ?? '9999')))[0];
}

export type CaseForm = {
  jurisdiction_code: string; label: string; court_name: string; case_number: string; offense_description: string; offense_class: string; disposition: string;
  is_juvenile: boolean; out_of_state_conviction: boolean; conviction_text: string; disposition_text: string; sentence_text: string; supervision_text: string; release_text: string;
  fines_paid: 'yes' | 'no' | ''; restitution_paid: 'yes' | 'no' | ''; other_convictions: string; pending_charges: 'yes' | 'no' | '';
  notes: string;
};

export function isoFromMdy(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((text ?? '').trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[1] - 1, +m[2]);
  return d.getFullYear() === +m[3] && d.getMonth() === +m[1] - 1 && d.getDate() === +m[2] ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

export function validateCase(f: CaseForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.jurisdiction_code) e.jurisdiction_code = 'Choose where the case was heard.';
  if (f.label.trim().length < 2) e.label = 'Give this case a short name (for example "2016 theft").';
  if (f.label.length > 80) e.label = 'Keep the name under 80 characters.';
  if (f.case_number.length > 60) e.case_number = 'Keep the case number under 60 characters.';
  const dates: [keyof CaseForm, string][] = [['conviction_text', 'conviction'], ['disposition_text', 'disposition'], ['sentence_text', 'sentence completion'], ['supervision_text', 'supervision completion'], ['release_text', 'release']];
  for (const [k, name] of dates) { const v = String(f[k] ?? ''); if (v && !isoFromMdy(v)) e[k] = `Choose a valid ${name} date.`; }
  const conv = isoFromMdy(f.conviction_text), disp = isoFromMdy(f.disposition_text);
  const sent = isoFromMdy(f.sentence_text);
  if (conv && disp && disp < conv && f.disposition === 'conviction') e.disposition_text = 'The disposition cannot be before the conviction.';
  if (conv && sent && sent < conv) e.sentence_text = 'Sentence completion cannot be before the conviction.';
  if (f.other_convictions && !/^\d{1,2}$/.test(f.other_convictions)) e.other_convictions = 'Enter a number from 0 to 50.';
  if (f.other_convictions && Number(f.other_convictions) > 50) e.other_convictions = 'Enter a number from 0 to 50.';
  return e;
}

export function caseToPayload(f: CaseForm): Record<string, unknown> {
  const yn = (v: string) => (v === 'yes' ? true : v === 'no' ? false : null);
  return {
    jurisdiction_code: f.jurisdiction_code, label: f.label.trim(), court_name: f.court_name.trim(), case_number: f.case_number.trim(), offense_description: f.offense_description.trim(),
    offense_class: f.offense_class, disposition: f.disposition, is_juvenile: f.is_juvenile, out_of_state_conviction: f.out_of_state_conviction,
    conviction_date: isoFromMdy(f.conviction_text) ?? '', disposition_date: isoFromMdy(f.disposition_text) ?? '', sentence_completion_date: isoFromMdy(f.sentence_text) ?? '',
    supervision_completion_date: isoFromMdy(f.supervision_text) ?? '', release_date: isoFromMdy(f.release_text) ?? '',
    fines_paid: yn(f.fines_paid), restitution_paid: yn(f.restitution_paid), other_convictions_count: f.other_convictions === '' ? '' : Number(f.other_convictions), pending_charges: yn(f.pending_charges), notes: f.notes.trim(),
  };
}

/** Wording that must never appear in member-facing legal text. */
export const OVERCLAIM_PATTERN = /\byou (are|will be) (eligible|qualified|entitled)|you qualify|you should file|you will (win|be granted|get)|guaranteed|your record (will|can) be (cleared|erased)|definitely eligible|legal advice you can rely/i;

export function ruleChangedNotice(changed: boolean): string {
  return changed ? 'The verified rule for this jurisdiction changed after this was checked. Re-check the case to see how the new version applies.' : '';
}

export function staleRuleNotice(stale: boolean, verifiedAt: string | null): string {
  return stale ? `This rule was last verified ${verifiedAt ?? 'a long time ago'}. Confirm it is still current with the official source before relying on it.` : '';
}
