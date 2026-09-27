// Opportunity Profile document builder. Pure.
//
// BOUNDARY (audited): this module - like every employer/landlord-capable builder - must never import justice-history,
// credit or record-relief code, and its input type has no field for date of birth, home address or any justice data.
// Sensitive-ish fields (phone, email, location, pay expectation) are OFF by default and only appear when the member
// selects them.
import { fingerprintOf, type DocBlock, type DocumentSpec, type DocAudience } from '../spec.ts';
import { documentTypeInfo } from '../document-types.ts';

export type OpportunityProfileData = {
  contact: { first_name: string; last_name: string; phone: string | null; email: string | null; zip_code: string | null };
  work: { job_title: string; employer_name: string; location_text: string | null; start_date: string; end_date: string | null; is_current: boolean; description: string | null }[];
  education: { school_name: string; credential: string; field_of_study: string | null; start_year: number | null; end_year: number | null; status: string }[];
  credentials: { credential_type: string; name: string; issuer: string | null; issued_date: string | null; expires_date: string | null }[];
  skills: string[];
  preferences: {
    desired_titles: string[]; employment_types: string[]; workplace_types: string[]; pay_min_hourly: number | null;
    available_days: string[]; shift_preferences: string[]; earliest_start_date: string | null;
    transportation_modes: string[]; has_drivers_license: boolean | null;
  } | null;
};

export type OpportunityProfileOptions = {
  audience: DocAudience;
  includeName: boolean;
  includePhone: boolean;
  includeEmail: boolean;
  includeZip: boolean;
  includePay: boolean;
  sections: { experience: boolean; education: boolean; credentials: boolean; skills: boolean; preferences: boolean; availability: boolean; transportation: boolean };
};

/** Sensitive-ish fields are OFF by default. */
export const DEFAULT_PROFILE_OPTIONS: OpportunityProfileOptions = {
  audience: 'self',
  includeName: true,
  includePhone: false,
  includeEmail: false,
  includeZip: false,
  includePay: false,
  sections: { experience: true, education: true, credentials: true, skills: true, preferences: true, availability: true, transportation: false },
};

const CREDENTIAL_LABEL: Record<string, string> = {
  high_school: 'High school diploma', ged: 'GED', trade_certificate: 'Trade certificate', associate: 'Associate degree',
  bachelor: "Bachelor's degree", graduate: 'Graduate degree', other: 'Other',
};
const STATUS_LABEL: Record<string, string> = { completed: 'Completed', in_progress: 'In progress', incomplete: 'Not completed' };
const TYPE_LABEL: Record<string, string> = { full_time: 'Full time', part_time: 'Part time', temporary: 'Temporary', contract: 'Contract', seasonal: 'Seasonal' };
const PLACE_LABEL: Record<string, string> = { on_site: 'On site', remote: 'Remote', hybrid: 'Hybrid' };
const DAY_LABEL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const SHIFT_LABEL: Record<string, string> = { morning: 'Mornings', afternoon: 'Afternoons', evening: 'Evenings', overnight: 'Overnight', weekends: 'Weekends' };
const MODE_LABEL: Record<string, string> = { own_vehicle: 'Own vehicle', public_transit: 'Public transit', rideshare: 'Rideshare', bike: 'Bike', walk: 'Walk', carpool: 'Carpool', none: 'No transportation yet' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthYear(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}
const list = (codes: string[], labels: Record<string, string>) => codes.map((c) => labels[c] ?? c).join(', ');

/** What the export will contain, in plain words, for the "what's included" panel. */
export function describeIncluded(o: OpportunityProfileOptions): string[] {
  const out: string[] = [];
  if (o.includeName) out.push('Your name');
  if (o.includePhone) out.push('Your phone number');
  if (o.includeEmail) out.push('Your email address');
  if (o.includeZip) out.push('Your ZIP code');
  for (const [k, on] of Object.entries(o.sections)) if (on) out.push(({ experience: 'Work experience', education: 'Education', credentials: 'Certifications and licenses', skills: 'Skills', preferences: 'Job preferences', availability: 'Availability', transportation: 'Transportation' } as Record<string, string>)[k]);
  if (o.includePay) out.push('Your minimum hourly pay');
  return out;
}

export function buildOpportunityProfile(data: OpportunityProfileData, options: OpportunityProfileOptions = DEFAULT_PROFILE_OPTIONS, now = new Date()): DocumentSpec {
  const info = documentTypeInfo('opportunity_profile')!;
  const o = options;
  const blocks: DocBlock[] = [];
  const name = `${data.contact.first_name} ${data.contact.last_name}`.trim();

  blocks.push({ type: 'heading', text: o.includeName && name ? name : 'Opportunity Profile', level: 1 });
  if (o.includeName && name) blocks.push({ type: 'paragraph', text: 'Opportunity Profile' });
  const contact: { label: string; value: string }[] = [];
  if (o.includePhone && data.contact.phone) contact.push({ label: 'Phone', value: data.contact.phone });
  if (o.includeEmail && data.contact.email) contact.push({ label: 'Email', value: data.contact.email });
  if (o.includeZip && data.contact.zip_code) contact.push({ label: 'ZIP code', value: data.contact.zip_code });
  if (contact.length) blocks.push({ type: 'keyvalue', items: contact });

  if (o.sections.preferences && data.preferences && (data.preferences.desired_titles.length || data.preferences.employment_types.length)) {
    const items: { label: string; value: string }[] = [];
    if (data.preferences.desired_titles.length) items.push({ label: 'Looking for', value: data.preferences.desired_titles.join(', ') });
    if (data.preferences.employment_types.length) items.push({ label: 'Job type', value: list(data.preferences.employment_types, TYPE_LABEL) });
    if (data.preferences.workplace_types.length) items.push({ label: 'Workplace', value: list(data.preferences.workplace_types, PLACE_LABEL) });
    if (o.includePay && data.preferences.pay_min_hourly != null) items.push({ label: 'Minimum pay', value: `$${data.preferences.pay_min_hourly.toFixed(2)} per hour` });
    blocks.push({ type: 'heading', text: 'Job preferences', level: 2 }, { type: 'keyvalue', items });
  }

  if (o.sections.experience && data.work.length) {
    blocks.push({ type: 'heading', text: 'Work experience', level: 2 });
    for (const w of data.work) {
      blocks.push({ type: 'paragraph', text: `${w.job_title} · ${w.employer_name}` });
      blocks.push({ type: 'paragraph', text: `${monthYear(w.start_date)} – ${w.is_current ? 'Present' : monthYear(w.end_date)}${w.location_text ? ' · ' + w.location_text : ''}` });
      if (w.description) blocks.push({ type: 'paragraph', text: w.description });
    }
  }
  if (o.sections.education && data.education.length) {
    blocks.push({ type: 'heading', text: 'Education', level: 2 });
    blocks.push({ type: 'bullets', items: data.education.map((e) => `${CREDENTIAL_LABEL[e.credential] ?? e.credential} · ${e.school_name}${e.field_of_study ? ' · ' + e.field_of_study : ''}${e.end_year ? ' · ' + e.end_year : ''} (${STATUS_LABEL[e.status] ?? e.status})`) });
  }
  if (o.sections.credentials && data.credentials.length) {
    blocks.push({ type: 'heading', text: 'Certifications and licenses', level: 2 });
    blocks.push({ type: 'bullets', items: data.credentials.map((c) => `${c.name}${c.issuer ? ' · ' + c.issuer : ''}${c.issued_date ? ' · issued ' + monthYear(c.issued_date) : ''}${c.expires_date ? ' · expires ' + monthYear(c.expires_date) : ''}`) });
  }
  if (o.sections.skills && data.skills.length) {
    blocks.push({ type: 'heading', text: 'Skills', level: 2 }, { type: 'paragraph', text: data.skills.join(' · ') });
  }
  if (o.sections.availability && data.preferences && (data.preferences.available_days.length || data.preferences.shift_preferences.length)) {
    const items: { label: string; value: string }[] = [];
    if (data.preferences.available_days.length) items.push({ label: 'Days', value: list(data.preferences.available_days, DAY_LABEL) });
    if (data.preferences.shift_preferences.length) items.push({ label: 'Shifts', value: list(data.preferences.shift_preferences, SHIFT_LABEL) });
    if (data.preferences.earliest_start_date) items.push({ label: 'Can start', value: monthYear(data.preferences.earliest_start_date) });
    blocks.push({ type: 'heading', text: 'Availability', level: 2 }, { type: 'keyvalue', items });
  }
  if (o.sections.transportation && data.preferences && data.preferences.transportation_modes.length) {
    const items = [{ label: 'Getting to work', value: list(data.preferences.transportation_modes, MODE_LABEL) }];
    if (data.preferences.has_drivers_license != null) items.push({ label: "Driver's license", value: data.preferences.has_drivers_license ? 'Yes' : 'No' });
    blocks.push({ type: 'heading', text: 'Transportation', level: 2 }, { type: 'keyvalue', items });
  }
  if (blocks.length <= 2) blocks.push({ type: 'paragraph', text: 'Nothing has been added to this profile yet.' });

  return {
    documentType: 'opportunity_profile', sourceModule: info.module, sourceRecordId: null, templateId: info.templateId, templateVersion: info.templateVersion,
    title: 'Opportunity Profile', subject: 'Opportunity Profile', audience: o.audience, sensitivity: info.sensitivity, kind: info.kind, formats: info.formats,
    blocks, confirmedDataAt: now.toISOString(),
    // Fingerprint covers exactly what is exported (data the options select), so unrelated edits do not mark it stale.
    inputs: { data: sanitizeForFingerprint(data, o), options: o },
    footer: 'Prepared by FairPath from information entered by the member. FairPath does not verify this information.',
  };
}

function sanitizeForFingerprint(d: OpportunityProfileData, o: OpportunityProfileOptions) {
  return {
    name: o.includeName ? [d.contact.first_name, d.contact.last_name] : null,
    phone: o.includePhone ? d.contact.phone : null, email: o.includeEmail ? d.contact.email : null, zip: o.includeZip ? d.contact.zip_code : null,
    work: o.sections.experience ? d.work : null, education: o.sections.education ? d.education : null, credentials: o.sections.credentials ? d.credentials : null,
    skills: o.sections.skills ? d.skills : null,
    prefs: d.preferences ? {
      titles: o.sections.preferences ? d.preferences.desired_titles : null, types: o.sections.preferences ? d.preferences.employment_types : null,
      place: o.sections.preferences ? d.preferences.workplace_types : null, pay: o.includePay ? d.preferences.pay_min_hourly : null,
      days: o.sections.availability ? d.preferences.available_days : null, shifts: o.sections.availability ? d.preferences.shift_preferences : null,
      start: o.sections.availability ? d.preferences.earliest_start_date : null, modes: o.sections.transportation ? d.preferences.transportation_modes : null,
      dl: o.sections.transportation ? d.preferences.has_drivers_license : null,
    } : null,
  };
}

/** The member-facing "is this ready?" check: something must be included beyond the name. */
export function profileExportReady(d: OpportunityProfileData): { ready: boolean; reason: string } {
  const has = d.work.length || d.education.length || d.credentials.length || d.skills.length || d.preferences?.desired_titles.length;
  return has ? { ready: true, reason: '' } : { ready: false, reason: 'Add work experience, education, skills or job preferences first.' };
}

export { fingerprintOf };
