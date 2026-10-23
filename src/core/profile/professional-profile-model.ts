import type { OpportunityProfileData } from '@/core/documents/builders/opportunity-profile.ts';
import type { ContactInfo } from '@/core/profile/opportunity-service.ts';

/** Member-facing professional card — never includes justice or legal data. */
export type ProfessionalProfilePreview = {
  displayName: string;
  headline: string;
  locationLabel: string;
  careerInterests: string[];
  skills: string[];
  experience: { title: string; company: string; period: string; highlight: string | null }[];
  education: { school: string; credential: string; field: string | null }[];
  credentials: { name: string; issuer: string | null; selfReported: true }[];
  accomplishments: { label: string; selfReported: true }[];
};

const FORBIDDEN = /conviction|felony|misdemeanor|record_relief|justice|expung|sealing|statute|case_number|docket/i;

export function assertProfessionalPreviewSafe(text: string): void {
  if (FORBIDDEN.test(text)) {
    throw new Error('Professional preview must not include justice-record content');
  }
}

function monthYear(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${m[2]}/${m[1]}` : '';
}

export function deriveDefaultHeadline(careerInterests: string[], latestJobTitle: string | null): string {
  const primary = careerInterests[0]?.trim();
  if (primary) return primary;
  if (latestJobTitle?.trim()) return latestJobTitle.trim();
  return '';
}

export function buildProfessionalProfilePreview(
  contact: ContactInfo & { email: string; professional_headline?: string },
  profile: OpportunityProfileData,
): ProfessionalProfilePreview {
  const displayName = `${contact.first_name} ${contact.last_name}`.trim();
  const latestJob = profile.work[0];
  const headline =
    (contact.professional_headline ?? '').trim() ||
    deriveDefaultHeadline(profile.preferences?.desired_titles ?? [], latestJob?.job_title ?? null);

  const locationLabel = contact.zip_code ? `ZIP ${contact.zip_code}` : 'Location not set';

  const experience = profile.work.map((w) => ({
    title: w.job_title,
    company: w.employer_name,
    period: w.is_current
      ? `${monthYear(w.start_date)} – Present`
      : `${monthYear(w.start_date)} – ${monthYear(w.end_date)}`,
    highlight: w.description?.trim() || null,
  }));

  const education = profile.education.map((e) => ({
    school: e.school_name,
    credential: e.credential.replace(/_/g, ' '),
    field: e.field_of_study,
  }));

  const credentials = profile.credentials.map((c) => ({
    name: c.name,
    issuer: c.issuer,
    selfReported: true as const,
  }));

  const accomplishments: ProfessionalProfilePreview['accomplishments'] = [];
  for (const c of profile.credentials) {
    accomplishments.push({ label: `Credential: ${c.name}`, selfReported: true });
  }
  for (const w of profile.work) {
    if (w.description && w.description.length > 12) {
      accomplishments.push({ label: w.description.slice(0, 120), selfReported: true });
    }
  }

  const preview: ProfessionalProfilePreview = {
    displayName,
    headline,
    locationLabel,
    careerInterests: profile.preferences?.desired_titles ?? [],
    skills: profile.skills,
    experience,
    education,
    credentials,
    accomplishments: accomplishments.slice(0, 8),
  };

  assertProfessionalPreviewSafe(JSON.stringify(preview));
  return preview;
}
