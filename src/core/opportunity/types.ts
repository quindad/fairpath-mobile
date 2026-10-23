export type OpportunitySource = 'resource' | 'marketplace' | 'food_rescue' | 'route' | 'community';

export type AvailabilityConfidence =
  | 'confirmed_active'
  | 'listed_unverified'
  | 'eligibility_unknown'
  | 'contact_required'
  | 'pending_backend'
  | 'no_match';

export type OpportunityActionKind =
  | 'open_resource'
  | 'open_marketplace_item'
  | 'claim_marketplace_item'
  | 'open_route'
  | 'call'
  | 'open_website'
  | 'save_resource'
  | 'post_community_request'
  | 'request_referral'
  | 'add_to_plan';

export type OpportunityAction = {
  kind: OpportunityActionKind;
  label: string;
  route?: string;
  url?: string;
  phone?: string;
  resourceId?: string;
  itemId?: string;
  disabledReason?: string;
};

export type OpportunityResult = {
  dedupeKey: string;
  source: OpportunitySource;
  recordId: string;
  title: string;
  subtitle: string | null;
  category: string;
  availability: AvailabilityConfidence;
  freshness: string | null;
  distanceMiles: number | null;
  reason: string;
  primaryAction: OpportunityAction;
  secondaryActions: OpportunityAction[];
};

export type OpportunitySearchOutcome = {
  results: OpportunityResult[];
  fallbacks: OpportunityAction[];
  sourceErrors: Partial<Record<OpportunitySource, string>>;
  interpretedSummary: string;
};
