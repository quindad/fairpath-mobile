export type AnswerSource =
  | 'user'
  | 'document_extraction'
  | 'partner_assisted'
  | 'imported';

export type VerificationState =
  | 'self_reported'
  | 'user_confirmed'
  | 'verified'
  | 'needs_review';

export type ProfileAnswer<T> = {
  value: T | null;
  source: AnswerSource;
  verificationState: VerificationState;
  updatedAt: string;
};

export type ConvictionRecord = {
  id: string;
  offenseName: ProfileAnswer<string>;
  offenseCode: ProfileAnswer<string>;
  jurisdictionState: ProfileAnswer<string>;
  jurisdictionCounty: ProfileAnswer<string>;
  convictionDate: ProfileAnswer<string>;
  disposition: ProfileAnswer<string>;
  felonyLevelOrClass: ProfileAnswer<string>;
  violentOffenseIndicator: ProfileAnswer<boolean>;
  sexualOffenseIndicator: ProfileAnswer<boolean>;
};

export type RegistrationAndRestrictionProfile = {
  sexOffenderRegistrationRequired: ProfileAnswer<boolean>;
  registrationJurisdiction: ProfileAnswer<string>;
  registrationTierOrLevel: ProfileAnswer<string>;
  registrationEndDate: ProfileAnswer<string>;
  supervisionStatus: ProfileAnswer<string>;
  supervisionEndDate: ProfileAnswer<string>;
  geographicRestrictions: ProfileAnswer<string[]>;
  employmentRestrictions: ProfileAnswer<string[]>;
  housingRestrictions: ProfileAnswer<string[]>;
};

export type ReleaseProfile = {
  currentlyIncarcerated: ProfileAnswer<boolean>;
  facilityName: ProfileAnswer<string>;
  expectedReleaseDate: ProfileAnswer<string>;
  actualReleaseDate: ProfileAnswer<string>;
  releaseCity: ProfileAnswer<string>;
  releaseState: ProfileAnswer<string>;
  workReleaseParticipation: ProfileAnswer<boolean>;
};

export type EmploymentEligibilityProfile = {
  desiredRoles: ProfileAnswer<string[]>;
  employmentTypes: ProfileAnswer<string[]>;
  skills: ProfileAnswer<string[]>;
  licensesAndCertifications: ProfileAnswer<string[]>;
  yearsExperience: ProfileAnswer<number>;
  educationLevel: ProfileAnswer<string>;
  transportationAccess: ProfileAnswer<string[]>;
  workAuthorizationConfirmed: ProfileAnswer<boolean>;
};

export type HousingEligibilityProfile = {
  desiredHousingTypes: ProfileAnswer<string[]>;
  householdSize: ProfileAnswer<number>;
  targetCities: ProfileAnswer<string[]>;
  monthlyIncomeRange: ProfileAnswer<string>;
  rentalHistoryAvailable: ProfileAnswer<boolean>;
  housingAssistance: ProfileAnswer<string[]>;
  accessibilityNeeds: ProfileAnswer<string[]>;
};

export type DocumentsProfile = {
  governmentId: ProfileAnswer<boolean>;
  socialSecurityCard: ProfileAnswer<boolean>;
  birthCertificate: ProfileAnswer<boolean>;
  resume: ProfileAnswer<boolean>;
  releaseDocuments: ProfileAnswer<boolean>;
  certifications: ProfileAnswer<string[]>;
};

export type ProgramScreeningProfile = {
  taxCreditScreeningConsent: ProfileAnswer<boolean>;
  programScreeningConsent: ProfileAnswer<boolean>;
  convictionOrReleaseDatesAvailable: ProfileAnswer<boolean>;
  benefitsCurrentlyReceiving: ProfileAnswer<string[]>;
};

export type EligibilityProfile = {
  userId: string;
  convictions: ConvictionRecord[];
  restrictions: RegistrationAndRestrictionProfile;
  release: ReleaseProfile;
  employment: EmploymentEligibilityProfile;
  housing: HousingEligibilityProfile;
  documents: DocumentsProfile;
  programs: ProgramScreeningProfile;
  createdAt: string;
  updatedAt: string;
};
