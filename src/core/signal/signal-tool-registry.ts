/**
 * Typed registry of Signal-capable platform actions.
 * Read tools may be invoked by orchestrator routes or Edge Functions.
 * Write tools always require an explicit member confirmation in UI before execution.
 */
export type SignalToolRisk = 'read' | 'write';

export type SignalToolDefinition = {
  id: string;
  risk: SignalToolRisk;
  title: string;
  summary: string;
  route?: string;
  edgeFunction?: string;
};

export const SIGNAL_READ_TOOLS: SignalToolDefinition[] = [
  { id: 'search_jobs', risk: 'read', title: 'Search jobs', summary: 'Fair-chance job search', route: '/find-jobs' },
  { id: 'search_housing', risk: 'read', title: 'Search housing', summary: 'Listings and filters', route: '/find-housing' },
  { id: 'search_resources', risk: 'read', title: 'Find resources', summary: 'Verified local services', route: '/resources' },
  { id: 'my_applications', risk: 'read', title: 'Job applications', summary: 'Your application status', route: '/job-applications' },
  { id: 'housing_applications', risk: 'read', title: 'Housing applications', summary: 'Drafts and submissions', route: '/housing-applications' },
  { id: 'my_path', risk: 'read', title: 'My Path', summary: 'Plan on this device', route: '/my-path' },
  { id: 'pathways', risk: 'read', title: 'Opportunity pathways', summary: 'Ten guided paths', route: '/grow' },
  { id: 'marketplace', risk: 'read', title: 'Marketplace', summary: 'Free local items', route: '/marketplace' },
  { id: 'community', risk: 'read', title: 'Community Exchange', summary: 'Need or offer help', route: '/community' },
  { id: 'record_relief', risk: 'read', title: 'Record Relief', summary: 'Cases and verified rules', route: '/record-relief' },
  { id: 'credit', risk: 'read', title: 'Credit Studio', summary: 'Reports and disputes', route: '/credit' },
  { id: 'credits_balance', risk: 'read', title: 'Signal credits', summary: 'Usage on your plan', route: '/fairpath-ai' },
];

export const SIGNAL_WRITE_TOOLS: SignalToolDefinition[] = [
  { id: 'submit_job_application', risk: 'write', title: 'Submit job application', summary: 'Only inside job apply flow with your confirmation', route: '/job-applications' },
  { id: 'submit_housing_application', risk: 'write', title: 'Submit housing application', summary: 'Review screen before submit', route: '/housing-applications' },
  { id: 'marketplace_claim', risk: 'write', title: 'Request marketplace claim', summary: 'Claim flow confirms pickup rules', route: '/marketplace-claims' },
  { id: 'community_request', risk: 'write', title: 'Post community request', summary: 'Compose and submit in Exchange', route: '/community/need-help/new' },
];

export function allSignalTools(): SignalToolDefinition[] {
  return [...SIGNAL_READ_TOOLS, ...SIGNAL_WRITE_TOOLS];
}
