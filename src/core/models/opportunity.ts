export type OpportunityKind = 'job' | 'housing';

export type OpportunityStatus = 'draft' | 'published' | 'paused' | 'closed';

export type Opportunity = {
  id: string;
  kind: OpportunityKind;
  title: string;
  locationText: string | null;
  status: OpportunityStatus;
  createdAt: string;
  updatedAt: string;
};
