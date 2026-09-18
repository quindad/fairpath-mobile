export type CanonicalAddress = {
  id: string;
  label: 'home' | 'mailing' | 'release' | 'business' | 'property' | 'other';
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  formatted: string;
  placeProviderId: string | null;
  userConfirmed: boolean;
};

export type AutofillField = {
  key: string;
  sourcePath: string;
  sensitive: boolean;
  requiresConfirmationBeforeSubmission: boolean;
};

export const CONSUMER_AUTOFILL_FIELDS: AutofillField[] = [
  { key: 'phone', sourcePath: 'identity.phone', sensitive: false, requiresConfirmationBeforeSubmission: false },
  { key: 'dateOfBirth', sourcePath: 'identity.date_of_birth', sensitive: true, requiresConfirmationBeforeSubmission: true },
  { key: 'address', sourcePath: 'identity.address', sensitive: true, requiresConfirmationBeforeSubmission: true },
  { key: 'education', sourcePath: 'employment.education_level', sensitive: false, requiresConfirmationBeforeSubmission: false },
  { key: 'skills', sourcePath: 'employment.skills', sensitive: false, requiresConfirmationBeforeSubmission: false },
];

export function shouldAutofill(field: AutofillField, value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}
