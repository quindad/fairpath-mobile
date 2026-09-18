export type ConvictionCategory =
  | 'violent'
  | 'sexual'
  | 'drug'
  | 'property'
  | 'financial'
  | 'weapons'
  | 'driving'
  | 'other'
  | 'unknown';

export type ConvictionEntry = {
  id: string;
  offenseName: string;
  offenseCode: string | null;
  category: ConvictionCategory;
  felonyLevelOrClass: string | null;
  jurisdictionState: string;
  jurisdictionCounty: string | null;
  convictionDate: string | null;
  sentenceEndDate: string | null;
  incarcerationRelated: boolean | null;
  notes: string | null;
};

export type SupervisionEntry = {
  id: string;
  type: 'probation' | 'parole' | 'post_release_control' | 'other';
  jurisdictionState: string | null;
  endDate: string | null;
  employmentRestrictions: string[];
  housingRestrictions: string[];
  geographicRestrictions: string[];
};

export type RegistrationEntry = {
  id: string;
  type: 'sex_offender' | 'other';
  jurisdictionState: string | null;
  tierOrLevel: string | null;
  lifetime: boolean | null;
  endDate: string | null;
};

export type JusticeHistory = {
  convictions: ConvictionEntry[];
  supervision: SupervisionEntry[];
  registrations: RegistrationEntry[];
};

export function createEmptyConviction(id: string): ConvictionEntry {
  return {
    id,
    offenseName: '',
    offenseCode: null,
    category: 'unknown',
    felonyLevelOrClass: null,
    jurisdictionState: '',
    jurisdictionCounty: null,
    convictionDate: null,
    sentenceEndDate: null,
    incarcerationRelated: null,
    notes: null,
  };
}
