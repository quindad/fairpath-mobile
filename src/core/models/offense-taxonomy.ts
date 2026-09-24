/**
 * PROVISIONAL 9-category justice-history offense taxonomy.
 *
 * Mirrors supabase/migrations/20260924_0002_offense_taxonomy.sql version 1,
 * seeded with status='provisional'. Do not treat this as final — the
 * category boundaries require legal/domain review (FairPath V1 Master
 * Product Blueprint, Sec. 16) before any production eligibility decision
 * may use them. Production use is additionally gated behind the
 * `justice_eligibility_engine_enabled` feature flag, which defaults to
 * false and must stay false until that review clears (Sterling decision #1).
 */

export type OffenseTaxonomyCategoryKey =
  | 'violence'
  | 'weapons'
  | 'drugs'
  | 'property_theft'
  | 'fraud_financial'
  | 'sex_offenses'
  | 'driving_vehicle'
  | 'public_order'
  | 'other';

export type OffenseTaxonomyCategoryDefinition = {
  key: OffenseTaxonomyCategoryKey;
  displayLabel: string;
  sortOrder: number;
};

export const OFFENSE_TAXONOMY_VERSION = 1;
export const OFFENSE_TAXONOMY_STATUS: 'provisional' = 'provisional';

export const OFFENSE_TAXONOMY_CATEGORIES: OffenseTaxonomyCategoryDefinition[] = [
  { key: 'violence', displayLabel: 'Violence', sortOrder: 1 },
  { key: 'weapons', displayLabel: 'Weapons', sortOrder: 2 },
  { key: 'drugs', displayLabel: 'Drugs', sortOrder: 3 },
  { key: 'property_theft', displayLabel: 'Property / Theft', sortOrder: 4 },
  { key: 'fraud_financial', displayLabel: 'Fraud / Financial', sortOrder: 5 },
  { key: 'sex_offenses', displayLabel: 'Sex Offenses', sortOrder: 6 },
  { key: 'driving_vehicle', displayLabel: 'Driving / Vehicle', sortOrder: 7 },
  { key: 'public_order', displayLabel: 'Public Order', sortOrder: 8 },
  { key: 'other', displayLabel: 'Other', sortOrder: 9 },
];
