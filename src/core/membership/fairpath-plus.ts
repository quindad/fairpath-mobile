export type FairPathPlan = 'free' | 'plus';

export type MembershipBenefit = {
  id: string;
  title: string;
  description: string;
  plan: FairPathPlan;
  valueMessage?: string;
};

export { FAIRPATH_PLUS_MONTHLY_PRICE_USD } from '@/core/membership/plus-config';

export const MEMBERSHIP_BENEFITS: MembershipBenefit[] = [
  { id: 'marketplace_claims', title: 'More Marketplace claims', description: 'Free accounts include 1 claim per month. FairPath+ raises that to 7.', plan: 'plus' },
  { id: 'signal_credits', title: 'Signal for members', description: 'Personalized AI on jobs, housing, credit, and next steps uses monthly Signal credits. FairPath+ is designed to include a higher allowance when store billing connects.', plan: 'plus' },
  { id: 'core_free', title: 'Core FairPath (always free)', description: 'Job and housing search, applications, resources, Record Relief, and Credit Studio basics.', plan: 'free' },
  { id: 'assistant_free', title: 'Built-in Assistant', description: 'Guidance from your FairPath data and fixed rules—no subscription required.', plan: 'free' },
  { id: 'matching', title: 'Opportunity matching', description: 'Programs matched using the profile information you provide.', plan: 'free' },
];
