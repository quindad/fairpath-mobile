// The six United States Armed Forces branches, by official name. Branch identity is a skin on the shared FairPath design
// system: no official seals, no DoD or VA marks, and no permanent branch colors until the palette is formally approved.
// Until then every branch uses the shared FairPath lime accent and carries accentStatus 'pending_review'.

export type BranchId = 'army' | 'marine_corps' | 'navy' | 'air_force' | 'space_force' | 'coast_guard';

export type Branch = {
  id: BranchId;
  officialName: string;
  /** Components a service member may have served in for this branch. Reserve applies where the branch has one. */
  components: readonly ('active' | 'reserve' | 'national_guard')[];
  /** Accent used by the app. Always the shared brand lime until a branch palette is approved. */
  accentHex: '#A8F32C';
  accentStatus: 'pending_review';
  /** Official seals and insignia are never used in the app. */
  insigniaAllowed: false;
};

const RESERVE_CAPABLE = ['active', 'reserve', 'national_guard'] as const;
const NO_GUARD = ['active', 'reserve'] as const;

export const BRANCHES: readonly Branch[] = [
  { id: 'army', officialName: 'United States Army', components: RESERVE_CAPABLE, accentHex: '#A8F32C', accentStatus: 'pending_review', insigniaAllowed: false },
  { id: 'marine_corps', officialName: 'United States Marine Corps', components: NO_GUARD, accentHex: '#A8F32C', accentStatus: 'pending_review', insigniaAllowed: false },
  { id: 'navy', officialName: 'United States Navy', components: NO_GUARD, accentHex: '#A8F32C', accentStatus: 'pending_review', insigniaAllowed: false },
  { id: 'air_force', officialName: 'United States Air Force', components: RESERVE_CAPABLE, accentHex: '#A8F32C', accentStatus: 'pending_review', insigniaAllowed: false },
  { id: 'space_force', officialName: 'United States Space Force', components: NO_GUARD, accentHex: '#A8F32C', accentStatus: 'pending_review', insigniaAllowed: false },
  { id: 'coast_guard', officialName: 'United States Coast Guard', components: NO_GUARD, accentHex: '#A8F32C', accentStatus: 'pending_review', insigniaAllowed: false },
] as const;

export function branchById(id: string): Branch | undefined {
  return BRANCHES.find((b) => b.id === id);
}
