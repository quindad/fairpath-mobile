// Distinguishes Direct Hire (FairPath Recruit) from FairPath Staffing opportunities for members. Defaults to
// direct_hire when a listing predates this field, so nothing silently becomes a staffing listing by omission.

export type ListingKind = 'direct_hire' | 'staffing';

export const LISTING_KIND_LABEL: Record<ListingKind, string> = {
  direct_hire: 'Direct Hire',
  staffing: 'FairPath Staffing',
};

export const LISTING_KIND_EXPLANATION: Record<ListingKind, string> = {
  direct_hire: 'You would be hired directly by this employer.',
  staffing: 'A temporary, contract or temp-to-hire assignment. FairPath and a payroll partner handle employment while you work for this client.',
};

/** A job row may not carry listing_kind yet (older rows, or before the backend field exists). Never guess staffing. */
export function resolveListingKind(raw: string | null | undefined): ListingKind {
  return raw === 'staffing' ? 'staffing' : 'direct_hire';
}
