import type { CommunityHelpCategoryId, CommunityHelpUrgency } from '../community/categories.ts';

export type OpportunityPillar = 'need_help' | 'want_to_grow' | 'can_help';

export type GrowthTopic =
  | 'employment'
  | 'education'
  | 'entrepreneurship'
  | 'housing'
  | 'financial'
  | 'legal'
  | 'record_relief'
  | 'skills_exchange'
  | 'microbusiness'
  | 'education_scholarships'
  | 'family_center'
  | 'events_volunteering'
  | 'benefits_navigator'
  | 'health_wellness'
  | 'mentorship'
  | 'transportation'
  | 'community_drives'
  | 'benefits'
  | 'health'
  | 'volunteer';

export type NeedConstraints = {
  noPersonalTransport?: boolean;
  pickupOk?: boolean;
  deliveryPreferred?: boolean;
};

export type StructuredNeed = {
  /** Client session id for editing before submit */
  localId: string;
  kind: 'essential' | 'growth' | 'give';
  category: CommunityHelpCategoryId | GrowthTopic | 'volunteer';
  label: string;
  urgency: CommunityHelpUrgency;
  constraints: NeedConstraints;
  /** Member-entered; never inferred silently */
  householdSize?: number | null;
  quantityNote?: string | null;
};

export type OpportunityLocation = {
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  /** True when member has not provided location */
  missing: boolean;
};

export type InterpretedOpportunity = {
  pillar: OpportunityPillar;
  rawQuery: string;
  needs: StructuredNeed[];
  location: OpportunityLocation;
  /** Phrases we matched — shown for transparency */
  matchedSignals: string[];
};

export function newLocalId(): string {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
