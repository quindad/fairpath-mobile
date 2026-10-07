// Veteran service profile. Every field is optional and consent-controlled. Browsing Veterans content requires none of them.
// Proof documents are requested only when a specific verified benefit or program needs them, never to browse.

export type ServiceProfileField =
  | 'branch'
  | 'service_component'
  | 'veteran_status'
  | 'service_dates'
  | 'pay_grade'
  | 'occupational_specialty'
  | 'skills_and_training'
  | 'military_certifications'
  | 'transition_goals'
  | 'education_interests'
  | 'employment_interests'
  | 'housing_needs'
  | 'benefits_navigation_needs';

export type FieldSpec = {
  field: ServiceProfileField;
  label: string;
  /** Required before this field is stored. Every field requires explicit consent. */
  requiresConsent: true;
  /** Used only for the stated purpose. Never shared with employers or landlords by default. */
  purpose: 'personalization' | 'translation' | 'benefit_navigation' | 'program_eligibility';
  /** Whether a verified program may request proof for this field. Proof is never required to browse. */
  proofMayBeRequested: boolean;
};

export const SERVICE_PROFILE_FIELDS: readonly FieldSpec[] = [
  { field: 'branch', label: 'Military branch', requiresConsent: true, purpose: 'personalization', proofMayBeRequested: false },
  { field: 'service_component', label: 'Service component', requiresConsent: true, purpose: 'personalization', proofMayBeRequested: false },
  { field: 'veteran_status', label: 'Veteran or transitioning service member status', requiresConsent: true, purpose: 'program_eligibility', proofMayBeRequested: true },
  { field: 'service_dates', label: 'Service dates', requiresConsent: true, purpose: 'program_eligibility', proofMayBeRequested: true },
  { field: 'pay_grade', label: 'Rank or pay grade', requiresConsent: true, purpose: 'translation', proofMayBeRequested: false },
  { field: 'occupational_specialty', label: 'MOS, AFSC, Navy rating or equivalent', requiresConsent: true, purpose: 'translation', proofMayBeRequested: false },
  { field: 'skills_and_training', label: 'Skills and training', requiresConsent: true, purpose: 'translation', proofMayBeRequested: false },
  { field: 'military_certifications', label: 'Military certifications', requiresConsent: true, purpose: 'translation', proofMayBeRequested: true },
  { field: 'transition_goals', label: 'Transition goals', requiresConsent: true, purpose: 'personalization', proofMayBeRequested: false },
  { field: 'education_interests', label: 'Education interests', requiresConsent: true, purpose: 'personalization', proofMayBeRequested: false },
  { field: 'employment_interests', label: 'Employment interests', requiresConsent: true, purpose: 'personalization', proofMayBeRequested: false },
  { field: 'housing_needs', label: 'Housing needs', requiresConsent: true, purpose: 'personalization', proofMayBeRequested: false },
  { field: 'benefits_navigation_needs', label: 'Benefits-navigation needs', requiresConsent: true, purpose: 'benefit_navigation', proofMayBeRequested: false },
] as const;

/** Browsing the Veterans pathway requires no profile field and no consent. */
export function requiredToBrowse(): ServiceProfileField[] {
  return [];
}

export type ConsentRecord = { field: ServiceProfileField; granted: boolean };

/** A field may be stored or used only with an active consent for that exact field. */
export function mayUseField(field: ServiceProfileField, consents: readonly ConsentRecord[]): boolean {
  return consents.some((c) => c.field === field && c.granted);
}
