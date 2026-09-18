export type FairPathPlan = 'free' | 'plus';

export type MembershipBenefit = {
  id: string;
  title: string;
  description: string;
  plan: FairPathPlan;
  valueMessage?: string;
};

export const FAIRPATH_PLUS_MONTHLY_PRICE_USD = 2;

export const MEMBERSHIP_BENEFITS: MembershipBenefit[] = [
  { id: 'marketplace_claims', title: 'More Marketplace claims', description: 'Get up to 7 included Marketplace claims per month.', plan: 'plus' },
  { id: 'fasttrack_discount', title: 'Save on FastTrack', description: 'Save $10 on each eligible FastTrack housing application.', plan: 'plus', valueMessage: 'One FastTrack use can save more than several months of membership.' },
  { id: 'ai_resume', title: 'AI resume help', description: 'Build and improve resumes from your FairPath profile.', plan: 'plus' },
  { id: 'ai_applications', title: 'AI application help', description: 'Reuse confirmed profile information and get guided application assistance.', plan: 'plus' },
  { id: 'ai_interviews', title: 'AI interview practice', description: 'Practice interviews tailored to the opportunity.', plan: 'plus' },
  { id: 'credit_plan', title: 'Credit improvement tools', description: 'Understand credit factors and build a user-directed action plan.', plan: 'plus' },
  { id: 'matching', title: 'Opportunity matching', description: 'See opportunities matched using the profile information you provide.', plan: 'free' },
  { id: 'resources', title: 'Resource navigation', description: 'Find FairPath resources and support.', plan: 'free' },
];
