export type IntroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
};

export const APP_INTRO_SLIDES: IntroSlide[] = [
  {
    id: 'welcome',
    eyebrow: 'WELCOME TO FAIRPATH',
    title: 'Opportunity has a path.',
    body: 'FairPath helps people navigating reentry, housing instability, and career change find jobs, homes, resources, and tools built for real life—not perfect records.',
  },
  {
    id: 'jobs',
    eyebrow: 'JOBS',
    title: 'Work that meets you where you are.',
    body: 'Search felony-friendly and veteran-friendly roles, save listings, and apply when you are ready—with an Opportunity Profile you control.',
    bullets: ['Browse openings without an account', 'Apply and track progress as a member'],
  },
  {
    id: 'housing',
    eyebrow: 'HOUSING',
    title: 'Homes and rentals you can explore safely.',
    body: 'Filter for second-chance and voucher-friendly listings, read details as a guest, and start applications when you create a member account.',
  },
  {
    id: 'resources',
    eyebrow: 'RESOURCES',
    title: 'Help near you.',
    body: 'Food, ID, legal aid, transportation, and community programs—searchable directories with plain-language details.',
  },
  {
    id: 'relief',
    eyebrow: 'RECORD RELIEF',
    title: 'Understand your record relief options.',
    body: 'FairPath explains screening results and next steps in your member workspace. The public checker on fairpathfwd.com is always available without an account.',
  },
  {
    id: 'ai',
    eyebrow: 'FAIRPATH SIGNAL',
    title: 'AI guidance on your terms.',
    body: 'Signal helps with cover letters, document summaries, and learning—using only what you choose to share. Personalized Signal requires a member account.',
  },
  {
    id: 'join',
    eyebrow: 'YOUR CHOICE',
    title: 'Explore first. Join when you are ready.',
    body: 'Browse jobs, housing, and resources without registering. Create a free account when you want to apply, save, message, or use your personal workspace.',
  },
];
