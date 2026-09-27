// Pure form rules for the Opportunity Profile editors (no imports, so scripts can execute them under Node).
// The database enforces the same rules (CHECK constraints + triggers); these give members clear messages first.

export type FieldErrors = Record<string, string>;

/** "MM/DD/YYYY" (the shared date picker's value) -> "YYYY-MM-DD"; null when not a real date. */
export function isoFromText(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((text ?? '').trim());
  if (!m) return null;
  const [mm, dd, yyyy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}
export function textFromIso(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}

const todayIso = (now: Date) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const len = (s: string, min: number, max: number) => s.trim().length >= min && s.trim().length <= max;

export type WorkForm = { job_title: string; employer_name: string; location_text: string; start_text: string; end_text: string; is_current: boolean; description: string };
export function validateWork(f: WorkForm, now = new Date()): FieldErrors {
  const e: FieldErrors = {};
  if (!len(f.job_title, 2, 120)) e.job_title = 'Enter the job title (2 to 120 characters).';
  if (!len(f.employer_name, 2, 120)) e.employer_name = 'Enter the employer name.';
  if (f.location_text.length > 120) e.location_text = 'Keep the location under 120 characters.';
  if (f.description.length > 1000) e.description = 'Keep the description under 1,000 characters.';
  const start = isoFromText(f.start_text);
  if (!start) e.start_text = 'Choose when you started.';
  else if (start > todayIso(now)) e.start_text = 'Start date cannot be in the future.';
  if (!f.is_current) {
    const end = isoFromText(f.end_text);
    if (!end) e.end_text = 'Choose when you left, or mark this as your current job.';
    else if (end > todayIso(now)) e.end_text = 'End date cannot be in the future.';
    else if (start && end < start) e.end_text = 'End date must be after the start date.';
  }
  return e;
}

export type EducationForm = { school_name: string; credential: string; field_of_study: string; start_year: string; end_year: string; status: string };
export const CREDENTIAL_OPTIONS = [
  { value: 'high_school', label: 'High school diploma' }, { value: 'ged', label: 'GED' }, { value: 'trade_certificate', label: 'Trade certificate' },
  { value: 'associate', label: 'Associate degree' }, { value: 'bachelor', label: "Bachelor's degree" }, { value: 'graduate', label: 'Graduate degree' }, { value: 'other', label: 'Other' },
];
export function validateEducation(f: EducationForm, now = new Date()): FieldErrors {
  const e: FieldErrors = {};
  if (!len(f.school_name, 2, 120)) e.school_name = 'Enter the school or program name.';
  if (!CREDENTIAL_OPTIONS.some((o) => o.value === f.credential)) e.credential = 'Choose the type of credential.';
  if (f.field_of_study.length > 120) e.field_of_study = 'Keep this under 120 characters.';
  const maxYear = now.getFullYear() + 8;
  const sy = f.start_year.trim() ? Number(f.start_year) : null;
  const ey = f.end_year.trim() ? Number(f.end_year) : null;
  if (sy !== null && (!Number.isInteger(sy) || sy < 1950 || sy > maxYear)) e.start_year = 'Enter a 4-digit year.';
  if (ey !== null && (!Number.isInteger(ey) || ey < 1950 || ey > maxYear)) e.end_year = 'Enter a 4-digit year.';
  if (!e.start_year && !e.end_year && sy !== null && ey !== null && ey < sy) e.end_year = 'End year must be after the start year.';
  return e;
}

export type CredentialForm = { credential_type: string; name: string; issuer: string; issued_text: string; expires_text: string };
export function validateCredential(f: CredentialForm, now = new Date()): FieldErrors {
  const e: FieldErrors = {};
  if (!['certification', 'license'].includes(f.credential_type)) e.credential_type = 'Choose certification or license.';
  if (!len(f.name, 2, 140)) e.name = 'Enter the name (2 to 140 characters).';
  if (f.issuer.length > 140) e.issuer = 'Keep this under 140 characters.';
  const issued = f.issued_text.trim() ? isoFromText(f.issued_text) : null;
  const expires = f.expires_text.trim() ? isoFromText(f.expires_text) : null;
  if (f.issued_text.trim() && !issued) e.issued_text = 'Choose a valid issue date.';
  else if (issued && issued > todayIso(now)) e.issued_text = 'Issue date cannot be in the future.';
  if (f.expires_text.trim() && !expires) e.expires_text = 'Choose a valid expiration date.';
  else if (issued && expires && expires < issued) e.expires_text = 'Expiration must be after the issue date.';
  return e;
}

export function validateSkill(text: string, existing: string[]): string | null {
  const t = text.trim();
  if (t.length < 2) return 'Enter a skill (at least 2 characters).';
  if (t.length > 60) return 'Keep a skill under 60 characters.';
  if (existing.some((s) => s.trim().toLowerCase() === t.toLowerCase())) return 'You already added that skill.';
  return null;
}

export const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full time' }, { value: 'part_time', label: 'Part time' }, { value: 'temporary', label: 'Temporary' },
  { value: 'contract', label: 'Contract' }, { value: 'seasonal', label: 'Seasonal' },
];
export const WORKPLACE_TYPES = [{ value: 'on_site', label: 'On site' }, { value: 'remote', label: 'Remote' }, { value: 'hybrid', label: 'Hybrid' }];
export const DAYS = [
  { value: 'mon', label: 'Mon' }, { value: 'tue', label: 'Tue' }, { value: 'wed', label: 'Wed' }, { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' }, { value: 'sat', label: 'Sat' }, { value: 'sun', label: 'Sun' },
];
export const SHIFTS = [
  { value: 'morning', label: 'Mornings' }, { value: 'afternoon', label: 'Afternoons' }, { value: 'evening', label: 'Evenings' },
  { value: 'overnight', label: 'Overnight' }, { value: 'weekends', label: 'Weekends' },
];
export const TRANSPORT = [
  { value: 'own_vehicle', label: 'Own vehicle' }, { value: 'public_transit', label: 'Public transit' }, { value: 'rideshare', label: 'Rideshare' },
  { value: 'bike', label: 'Bike' }, { value: 'walk', label: 'Walk' }, { value: 'carpool', label: 'Carpool' }, { value: 'none', label: 'None right now' },
];

export function parseTitles(text: string): string[] {
  return [...new Set(text.split(/[,\n]/).map((t) => t.trim()).filter(Boolean))].slice(0, 5);
}
export function validateTitles(titles: string[], raw: string): string | null {
  const total = new Set(raw.split(/[,\n]/).map((t) => t.trim()).filter(Boolean)).size;
  if (total > 5) return 'List up to 5 roles.';
  if (titles.some((t) => t.length > 60)) return 'Keep each role under 60 characters.';
  return null;
}
export function parsePay(text: string): { value: number | null; error: string | null } {
  const t = text.trim().replace(/^\$/, '');
  if (!t) return { value: null, error: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1000) return { value: null, error: 'Enter an hourly amount between 0 and 1,000.' };
  return { value: Math.round(n * 100) / 100, error: null };
}

export const SECTION_ROUTES: Record<string, { route: string; title: string }> = {
  contact: { route: '/opportunity-profile/contact', title: 'Contact details' },
  location: { route: '/location-setup', title: 'Where you want to work' },
  work_experience: { route: '/opportunity-profile/experience', title: 'Work experience' },
  education: { route: '/opportunity-profile/education', title: 'Education' },
  skills: { route: '/opportunity-profile/skills', title: 'Skills' },
  preferences: { route: '/opportunity-profile/preferences', title: 'Job preferences' },
  availability: { route: '/opportunity-profile/availability', title: 'Availability' },
  transportation: { route: '/opportunity-profile/transportation', title: 'Transportation' },
  credentials: { route: '/opportunity-profile/credentials', title: 'Certifications and licenses' },
};

/** Deterministic: the first incomplete section, in the fixed order the database reports them. */
export function nextProfileStep(sections: { section_key: string; is_complete: boolean; label: string; sort_order: number }[]): { key: string; label: string; route: string } | null {
  const next = [...sections].sort((a, b) => a.sort_order - b.sort_order).find((s) => !s.is_complete);
  if (!next) return null;
  return { key: next.section_key, label: next.label, route: SECTION_ROUTES[next.section_key]?.route ?? '/opportunity-profile' };
}
