// Pathway registry: one FairPath app, six personalized pathways.
// Each pathway is data, not a separate app. The registry decides what a member can activate, what launch status is
// honest to show, and which audiences may ever see that pathway's data. Database RLS must enforce the same rules;
// this module is the shared, testable source for the app and for contract tests.

export type PathwayId =
  | 'reentry'
  | 'veterans'
  | 'housing_stability'
  | 'food'
  | 'giving'
  | 'safety_recovery';

/** Honest public status. Only 'live' may be presented as usable. */
export type LaunchStatus = 'live' | 'in_development' | 'planned';

/** Audiences that could ever receive a member's pathway-linked data. */
export type Audience = 'employer' | 'housing_provider' | 'donor' | 'partner_org' | 'case_manager';

/** Sensitive data categories. Each needs explicit, per-pathway consent before it is stored or shared. */
export type SensitiveScope =
  | 'criminal_history'
  | 'military_service'
  | 'housing_situation'
  | 'food_need'
  | 'financial_records'
  | 'safety_situation'
  | 'location';

export type Pathway = {
  id: PathwayId;
  name: string;
  status: LaunchStatus;
  /** Data this pathway may ask for, all optional, all consent-gated. */
  sensitiveScopes: SensitiveScope[];
  /** Audiences that may receive pathway-linked data after the member consents to that specific sharing. */
  shareableWith: Audience[];
  /** Whether location is shared by default. Must be false for every pathway. */
  defaultLocationSharing: false;
  /** Pathway-level privacy floor: when true, no partner or employer sees any pathway data, even with consent. */
  neverSharedExternally: boolean;
};

export const PATHWAYS: readonly Pathway[] = [
  {
    id: 'reentry',
    name: 'Reentry / Fair Chance',
    status: 'live',
    sensitiveScopes: ['criminal_history', 'financial_records'],
    shareableWith: ['employer', 'housing_provider', 'partner_org', 'case_manager'],
    defaultLocationSharing: false,
    neverSharedExternally: false,
  },
  {
    id: 'veterans',
    name: 'Veterans',
    status: 'in_development',
    sensitiveScopes: ['military_service'],
    shareableWith: ['employer', 'partner_org'],
    defaultLocationSharing: false,
    neverSharedExternally: false,
  },
  {
    id: 'housing_stability',
    name: 'Housing Stability',
    status: 'planned',
    sensitiveScopes: ['housing_situation', 'location'],
    shareableWith: ['housing_provider', 'partner_org', 'case_manager'],
    defaultLocationSharing: false,
    neverSharedExternally: false,
  },
  {
    id: 'food',
    name: 'Food & Food Rescue',
    status: 'planned',
    sensitiveScopes: ['food_need', 'location'],
    shareableWith: ['partner_org'],
    defaultLocationSharing: false,
    neverSharedExternally: false,
  },
  {
    id: 'giving',
    name: 'Giving',
    status: 'planned',
    sensitiveScopes: ['food_need', 'housing_situation'],
    shareableWith: [],
    defaultLocationSharing: false,
    neverSharedExternally: true,
  },
  {
    id: 'safety_recovery',
    name: 'Safety & Recovery',
    status: 'planned',
    sensitiveScopes: ['safety_situation', 'location'],
    shareableWith: [],
    defaultLocationSharing: false,
    neverSharedExternally: true,
  },
] as const;

export function pathwayById(id: string): Pathway | undefined {
  return PATHWAYS.find((p) => p.id === id);
}

/** A member may activate a pathway only if it is live or in development with a verified entry point. */
export function canActivate(pathway: Pathway): boolean {
  return pathway.status === 'live' || pathway.status === 'in_development';
}

/**
 * May a pathway's data be shared with this audience at all? A pathway-level floor. Per-member consent is still required
 * on top of this; the floor can only narrow access, never widen it.
 */
export function mayShareWith(pathway: Pathway, audience: Audience): boolean {
  if (pathway.neverSharedExternally) return false;
  return pathway.shareableWith.includes(audience);
}

/**
 * Pathways a member has actively activated. Activation is explicit and per pathway. Nothing is activated by browsing.
 */
export function activePathwaysFor(activated: readonly PathwayId[]): Pathway[] {
  const set = new Set(activated);
  return PATHWAYS.filter((p) => set.has(p.id) && canActivate(p));
}
