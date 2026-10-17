// The six United States Armed Forces branches, by official name. Branch identity is a skin on the shared
// FairPath design system: no official seals, no DoD or VA marks, ever (insigniaAllowed stays false for all
// six, permanently -- that line is not up for revisiting the same way the accent color was). The accent color
// below is a color commonly and publicly associated with each branch (e.g. Army black/gold, Navy blue/gold),
// not an official DoD-issued palette or insignia -- using an associated color in app UI is a materially
// different, lower-risk choice than using a seal or insignia, and is opt-in: a veteran can pick it or keep the
// default FairPath lime, so nothing changes unless they choose it (see veterans.tsx's color toggle).

export type BranchId = 'army' | 'marine_corps' | 'navy' | 'air_force' | 'space_force' | 'coast_guard';

export type Branch = {
  id: BranchId;
  officialName: string;
  /** Components a service member may have served in for this branch. Reserve applies where the branch has one. */
  components: readonly ('active' | 'reserve' | 'national_guard')[];
  /** A color commonly associated with this branch, offered as an opt-in accent -- never shown unless the
   * member explicitly turns it on. Not an official DoD palette or insignia. */
  accentHex: string;
  accentStatus: 'available_opt_in';
  /** Official seals and insignia are never used in the app. */
  insigniaAllowed: false;
};

const RESERVE_CAPABLE = ['active', 'reserve', 'national_guard'] as const;
const NO_GUARD = ['active', 'reserve'] as const;

export const BRANCHES: readonly Branch[] = [
  { id: 'army', officialName: 'United States Army', components: RESERVE_CAPABLE, accentHex: '#4B5320', accentStatus: 'available_opt_in', insigniaAllowed: false },
  { id: 'marine_corps', officialName: 'United States Marine Corps', components: NO_GUARD, accentHex: '#B71234', accentStatus: 'available_opt_in', insigniaAllowed: false },
  { id: 'navy', officialName: 'United States Navy', components: NO_GUARD, accentHex: '#000080', accentStatus: 'available_opt_in', insigniaAllowed: false },
  { id: 'air_force', officialName: 'United States Air Force', components: RESERVE_CAPABLE, accentHex: '#00308F', accentStatus: 'available_opt_in', insigniaAllowed: false },
  { id: 'space_force', officialName: 'United States Space Force', components: NO_GUARD, accentHex: '#1C2951', accentStatus: 'available_opt_in', insigniaAllowed: false },
  { id: 'coast_guard', officialName: 'United States Coast Guard', components: NO_GUARD, accentHex: '#003087', accentStatus: 'available_opt_in', insigniaAllowed: false },
] as const;

export function branchById(id: string): Branch | undefined {
  return BRANCHES.find((b) => b.id === id);
}
