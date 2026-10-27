import type { ReadinessArea } from '@/core/models/readiness.ts';

/** Where members should edit employer-facing employment facts (canonical store). */
export const OPPORTUNITY_ROUTES_FOR_READINESS: Partial<Record<ReadinessArea, { title: string; body: string; route: string }>> = {
  employment: {
    title: 'Opportunity Profile',
    body: 'Skills, work history, education, and job preferences for applications live in your Opportunity Profile. FairPath Readiness uses a separate private questionnaire for screening — not a duplicate profile.',
    route: '/opportunity-profile',
  },
  documents: {
    title: 'Resume Studio',
    body: 'Build an ATS-friendly résumé from your Opportunity Profile when you are ready to apply.',
    route: '/resume-studio',
  },
};

/** Readiness question IDs that overlap conceptually with Opportunity Profile (prefill source is member_* on apply). */
export const READINESS_EMPLOYMENT_OVERLAP_IDS = [
  'employment.skills',
  'employment.education_level',
  'employment.licenses_certifications',
  'employment.desired_roles',
  'employment.transportation',
] as const;
