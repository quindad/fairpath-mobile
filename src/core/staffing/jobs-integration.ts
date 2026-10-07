// Jobs/Explore integration: the typed contract and fixtures for distinguishing Direct Hire from the three FairPath
// Staffing assignment types. jobs.listing_kind does not exist in the real database yet (see
// docs/proposed-migrations/20261021100000_staffing_architecture_DRAFT.sql), so resolveDisplayKind() NEVER guesses —
// a real job record with no listing_kind field stays 'unknown' and renders exactly as it does today. This is the
// single switch: once the backend field exists, flipping resolveDisplayKind to read it is the only change needed.

export type StaffingAssignmentKind = 'staffing_temp' | 'staffing_contract' | 'staffing_temp_to_hire';
export type JobDisplayKind = 'direct_hire' | StaffingAssignmentKind | 'unknown';

const STAFFING_KINDS: readonly string[] = ['staffing_temp', 'staffing_contract', 'staffing_temp_to_hire'];

/** A job record may not carry a recognizable kind yet. Unknown values render as 'unknown', never guessed as staffing. */
export function resolveDisplayKind(rawListingKind: string | null | undefined): JobDisplayKind {
  if (rawListingKind === 'direct_hire') return 'direct_hire';
  if (rawListingKind && STAFFING_KINDS.includes(rawListingKind)) return rawListingKind as StaffingAssignmentKind;
  return 'unknown';
}

export const JOB_DISPLAY_KIND_LABEL: Record<JobDisplayKind, string> = {
  direct_hire: 'Direct Hire',
  staffing_temp: 'FairPath Staffing · Temporary',
  staffing_contract: 'FairPath Staffing · Contract',
  staffing_temp_to_hire: 'FairPath Staffing · Temp-to-Hire',
  unknown: '', // unknown kinds show no badge at all, not a guessed one
};

// ---------------------------------------------------------------------
// Employment-type filter. Built and tested now; disabled against live search until the backend field exists.
// ---------------------------------------------------------------------
export type EmploymentTypeFilterValue = 'direct_hire' | 'temporary' | 'contract' | 'temp_to_hire' | null;

export type EmploymentTypeFilterState = { value: EmploymentTypeFilterValue; enabled: boolean };

/** Disabled by default. A caller must pass backendSupportsListingKind=true to ever enable it — never implied. */
export function initialEmploymentTypeFilter(backendSupportsListingKind: boolean): EmploymentTypeFilterState {
  return { value: null, enabled: backendSupportsListingKind };
}

/** Applies the chosen filter value. The caller is responsible for never calling this with a value when the filter
 * control is disabled — initialEmploymentTypeFilter() starts value at null precisely so that can't happen by accident. */
export function matchesEmploymentTypeFilter(kind: JobDisplayKind, filter: EmploymentTypeFilterValue): boolean {
  if (filter === null) return true;
  if (filter === 'direct_hire') return kind === 'direct_hire';
  const kindMap: Record<'temporary' | 'contract' | 'temp_to_hire', StaffingAssignmentKind> = {
    temporary: 'staffing_temp', contract: 'staffing_contract', temp_to_hire: 'staffing_temp_to_hire',
  };
  return kind === kindMap[filter];
}

// ---------------------------------------------------------------------
// Fixtures: demonstrate all four kinds without touching the real (field-less) jobs table.
// ---------------------------------------------------------------------
export type JobCardFixture = { id: string; title: string; companyName: string; location: string; listingKind: string };

export const JOB_CARD_FIXTURES: readonly JobCardFixture[] = [
  { id: 'fx-job-1', title: 'Office Administrator (DEV fixture)', companyName: 'Example Corp', location: 'Columbus, OH', listingKind: 'direct_hire' },
  { id: 'fx-job-2', title: 'Warehouse Associate (DEV fixture)', companyName: 'Example Logistics Co.', location: 'Columbus, OH', listingKind: 'staffing_temp' },
  { id: 'fx-job-3', title: 'IT Support Specialist (DEV fixture)', companyName: 'Example Tech Co.', location: 'Remote', listingKind: 'staffing_contract' },
  { id: 'fx-job-4', title: 'Assembly Technician (DEV fixture)', companyName: 'Example Manufacturing', location: 'Dayton, OH', listingKind: 'staffing_temp_to_hire' },
  { id: 'fx-job-5', title: 'Older listing, no kind recorded (DEV fixture)', companyName: 'Example Co.', location: 'Columbus, OH', listingKind: '' },
];
