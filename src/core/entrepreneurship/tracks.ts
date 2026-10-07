// Entrepreneurship Hub: tracks and milestones. Cross-pathway, open to everyone. No funding, grant or partnership
// is implied by any step here. Mentorship/program discovery links to outside organizations without claiming an
// official partnership unless one is confirmed.

export type TrackStep =
  | 'choose_idea' | 'validate_demand' | 'research_competitors' | 'choose_structure' | 'form_llc' | 'get_ein'
  | 'permits_and_licenses' | 'open_business_banking' | 'set_up_bookkeeping' | 'build_business_credit'
  | 'research_funding' | 'price_products' | 'market_the_business' | 'acquire_customers' | 'launch_and_operate';

export type TrackStepInfo = { id: TrackStep; title: string; description: string };

export const STARTUP_ACADEMY_TRACK: readonly TrackStepInfo[] = [
  { id: 'choose_idea', title: 'Choose a business idea', description: 'Narrow down what you want to offer and why.' },
  { id: 'validate_demand', title: 'Validate demand', description: 'Check whether people actually want this before you spend money.' },
  { id: 'research_competitors', title: 'Research competitors', description: 'See who else does this and how you would be different.' },
  { id: 'choose_structure', title: 'Choose a business structure', description: 'Sole proprietor, LLC, or another structure. Learn the tradeoffs.' },
  { id: 'form_llc', title: 'Understand LLC formation', description: 'What forming an LLC involves in your state.' },
  { id: 'get_ein', title: 'Obtain an EIN', description: 'A federal tax ID for your business, from the IRS directly and free.' },
  { id: 'permits_and_licenses', title: 'Permits and licenses', description: 'What your city, county or state may require for your business type.' },
  { id: 'open_business_banking', title: 'Open legitimate business banking', description: 'Keep business money separate from personal money.' },
  { id: 'set_up_bookkeeping', title: 'Set up bookkeeping', description: 'Track income and expenses from day one.' },
  { id: 'build_business_credit', title: 'Build business credit responsibly', description: 'What business credit is and how it differs from personal credit.' },
  { id: 'research_funding', title: 'Research funding and grants', description: 'Where to look, and how to tell a real program from a scam.' },
  { id: 'price_products', title: 'Price products and services', description: 'Cover your costs and your time.' },
  { id: 'market_the_business', title: 'Market a business', description: 'Low-cost ways to reach your first customers.' },
  { id: 'acquire_customers', title: 'Acquire customers', description: 'Turn interest into your first sales.' },
  { id: 'launch_and_operate', title: 'Launch and operate', description: 'What changes once you are actually running the business.' },
];

export type TrackProgress = { completedSteps: TrackStep[] };

export function trackPercent(progress: TrackProgress): number {
  if (STARTUP_ACADEMY_TRACK.length === 0) return 0;
  const valid = new Set(STARTUP_ACADEMY_TRACK.map((s) => s.id));
  const done = progress.completedSteps.filter((s) => valid.has(s)).length;
  return Math.round((done / STARTUP_ACADEMY_TRACK.length) * 100);
}

export function nextStep(progress: TrackProgress): TrackStepInfo | null {
  return STARTUP_ACADEMY_TRACK.find((s) => !progress.completedSteps.includes(s.id)) ?? null;
}

export function markStepComplete(progress: TrackProgress, step: TrackStep): TrackProgress {
  if (progress.completedSteps.includes(step)) return progress;
  if (!STARTUP_ACADEMY_TRACK.some((s) => s.id === step)) return progress;
  return { completedSteps: [...progress.completedSteps, step] };
}

/** Mentorship/program discovery entries. 'officialPartnership' is false unless a written agreement is on file. */
export type ProgramReference = { id: string; name: string; description: string; officialPartnership: boolean; link: string | null };

export const PROGRAM_REFERENCES: readonly ProgramReference[] = [
  {
    id: 'inmates-to-entrepreneurs',
    name: 'Inmates to Entrepreneurs',
    description: 'A free program teaching business basics to people with records. Mentioned because FairPath’s founder has participated in it.',
    officialPartnership: false,
    link: null,
  },
  {
    id: 'sba-resources',
    name: 'U.S. Small Business Administration resources',
    description: 'Free federal resources on starting and running a business.',
    officialPartnership: false,
    link: null,
  },
];
