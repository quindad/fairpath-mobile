/** Plain-language orientation for people on tight budgets — not legal advice. */
export type PracticalHelpCard = {
  id: string;
  title: string;
  body: string;
  signalPrompt?: string;
  route?: string;
};

export const CREDIT_PRACTICAL_HELP: PracticalHelpCard[] = [
  {
    id: 'free_reports',
    title: 'Start with free official reports',
    body: 'You do not need to pay a third party to see what bureaus show. Use the official free report site, then upload or enter accounts here.',
    route: 'https://www.annualcreditreport.com',
  },
  {
    id: 'dispute_yourself',
    title: 'Disputes you can do yourself',
    body: 'FairPath helps you organize what you believe is wrong and draft letters you send. No one can promise an outcome — but you keep control of what goes out.',
    signalPrompt: 'Help me understand which of my flagged credit items might be worth disputing and why',
  },
  {
    id: 'utilities_and_rent',
    title: 'Rent and bills on your report',
    body: 'Some rental and utility data appears only when reported. If something looks unfamiliar, confirm whether it is yours before disputing.',
    signalPrompt: 'Explain my credit accounts in plain English and what I should verify first',
  },
  {
    id: 'scam_watch',
    title: 'Avoid repair scams',
    body: 'Be wary of large upfront fees or guaranteed score jumps. FairPath will not ask you to dispute accurate negative information just to charge you.',
    signalPrompt: 'What should I watch out for with credit repair offers?',
  },
];

export const RESUME_PRACTICAL_HELP: PracticalHelpCard[] = [
  {
    id: 'one_page',
    title: 'One strong page beats five weak ones',
    body: 'Lead with recent work, training, or programs. Short bullets that show reliability beat long job descriptions.',
  },
  {
    id: 'gaps',
    title: 'Employment gaps are common',
    body: 'Use a line for caregiving, health, incarceration, training, or job search — only what you choose to share. Signal can help phrase it without inventing jobs.',
    signalPrompt: 'Help me describe an employment gap honestly on my resume without making up experience',
  },
  {
    id: 'fair_chance',
    title: 'Fair-chance employers',
    body: 'Pair your resume with FairPath job search filters. Your resume should highlight skills and stability signals employers can evaluate fairly.',
    route: '/find-jobs',
  },
];
