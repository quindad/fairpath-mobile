export type FairPathAICapability =
  | 'profile_completion'
  | 'document_extraction'
  | 'resume_builder'
  | 'cover_letter'
  | 'interview_prep'
  | 'application_assist'
  | 'job_match_explainer'
  | 'housing_match_explainer'
  | 'reentry_plan'
  | 'resource_navigation'
  | 'credit_education'
  | 'credit_action_plan';

export type AIActionRisk = 'assistive' | 'review_required' | 'restricted';

export type AICapabilityPolicy = {
  capability: FairPathAICapability;
  risk: AIActionRisk;
  plusEligible: boolean;
  requiresUserConfirmation: boolean;
};

export const FAIRPATH_AI_CAPABILITIES: AICapabilityPolicy[] = [
  { capability: 'profile_completion', risk: 'assistive', plusEligible: false, requiresUserConfirmation: true },
  { capability: 'document_extraction', risk: 'review_required', plusEligible: true, requiresUserConfirmation: true },
  { capability: 'resume_builder', risk: 'assistive', plusEligible: true, requiresUserConfirmation: true },
  { capability: 'cover_letter', risk: 'assistive', plusEligible: true, requiresUserConfirmation: true },
  { capability: 'interview_prep', risk: 'assistive', plusEligible: true, requiresUserConfirmation: false },
  { capability: 'application_assist', risk: 'review_required', plusEligible: true, requiresUserConfirmation: true },
  { capability: 'job_match_explainer', risk: 'assistive', plusEligible: false, requiresUserConfirmation: false },
  { capability: 'housing_match_explainer', risk: 'assistive', plusEligible: false, requiresUserConfirmation: false },
  { capability: 'reentry_plan', risk: 'review_required', plusEligible: true, requiresUserConfirmation: true },
  { capability: 'resource_navigation', risk: 'assistive', plusEligible: false, requiresUserConfirmation: false },
  { capability: 'credit_education', risk: 'assistive', plusEligible: true, requiresUserConfirmation: false },
  { capability: 'credit_action_plan', risk: 'review_required', plusEligible: true, requiresUserConfirmation: true },
];
