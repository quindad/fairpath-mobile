import type { OpportunityProfileData } from '@/core/documents/builders/opportunity-profile.ts';

const FORBIDDEN = /conviction|felony|record_relief|justice|expung|sealing|statute|case_number|docket/i;

export type ShareSectionKey =
  | 'summary'
  | 'experience'
  | 'education'
  | 'credentials'
  | 'skills'
  | 'preferences'
  | 'availability'
  | 'transportation';

export const SHARE_SECTION_LABELS: Record<ShareSectionKey, string> = {
  summary: 'Professional summary',
  experience: 'Work experience',
  education: 'Education',
  credentials: 'Certifications',
  skills: 'Skills',
  preferences: 'Career interests',
  availability: 'Availability',
  transportation: 'Transportation',
};

export type SharePreviewLine = { section: ShareSectionKey; lines: string[] };

/** Client-side mirror of what the server may attach — for member preview only. */
export function buildApplicationSharePreview(
  sections: readonly ShareSectionKey[],
  profile: OpportunityProfileData,
  headline: string,
): SharePreviewLine[] {
  const out: SharePreviewLine[] = [];
  for (const key of sections) {
    const lines: string[] = [];
    switch (key) {
      case 'summary': {
        if (headline.trim()) lines.push(`Headline: ${headline.trim()}`);
        const interests = profile.preferences?.desired_titles ?? [];
        if (interests.length) lines.push(`Career interests: ${interests.join(', ')}`);
        if (profile.contact.zip_code) lines.push(`Area: ZIP ${profile.contact.zip_code}`);
        break;
      }
      case 'experience':
        for (const w of profile.work.slice(0, 5)) {
          lines.push(`${w.job_title} at ${w.employer_name}`);
        }
        break;
      case 'education':
        for (const e of profile.education) lines.push(`${e.school_name} — ${e.credential}`);
        break;
      case 'credentials':
        for (const c of profile.credentials) lines.push(`${c.name}${c.issuer ? ` (${c.issuer})` : ''}`);
        break;
      case 'skills':
        if (profile.skills.length) lines.push(profile.skills.join(', '));
        break;
      case 'preferences': {
        const p = profile.preferences;
        if (p?.employment_types.length) lines.push(`Employment types: ${p.employment_types.join(', ')}`);
        if (p?.workplace_types.length) lines.push(`Workplace: ${p.workplace_types.join(', ')}`);
        break;
      }
      case 'availability': {
        const p = profile.preferences;
        if (p?.available_days.length) lines.push(`Days: ${p.available_days.join(', ')}`);
        if (p?.shift_preferences.length) lines.push(`Shifts: ${p.shift_preferences.join(', ')}`);
        break;
      }
      case 'transportation': {
        const p = profile.preferences;
        if (p?.transportation_modes.length) lines.push(`Transport: ${p.transportation_modes.join(', ')}`);
        if (p?.has_drivers_license != null) lines.push(p.has_drivers_license ? 'Has driver\'s license' : 'No driver\'s license');
        break;
      }
    }
    if (lines.length) out.push({ section: key, lines });
  }
  const blob = JSON.stringify(out);
  if (FORBIDDEN.test(blob)) throw new Error('Share preview must not include justice-record content');
  return out;
}
