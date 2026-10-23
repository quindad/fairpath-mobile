import type { OpportunityPillar } from './needs-model.ts';

/** Approved V1 opportunity expansions (excludes Neighbor Network and equipment library). */
export type V1PathwayId =
  | 'skills_exchange'
  | 'microbusiness'
  | 'education_scholarships'
  | 'family_center'
  | 'events_volunteering'
  | 'benefits_navigator'
  | 'health_wellness'
  | 'mentorship'
  | 'transportation'
  | 'community_drives';

export type V1Pathway = {
  id: V1PathwayId;
  pillar: OpportunityPillar;
  title: string;
  subtitle: string;
  /** Existing resource_categories slugs searched by the Opportunity Engine */
  resourceCategorySlugs: string[];
  /** FairPath route for discovery / next action (no fake listings) */
  primaryRoute: string;
  /** Optional prefilled help-now query */
  helpNowQuery?: string;
  /** Member-facing honesty note */
  coverageNote: string;
};

export const V1_PATHWAYS: readonly V1Pathway[] = [
  {
    id: 'skills_exchange',
    pillar: 'want_to_grow',
    title: 'Skills exchange',
    subtitle: 'Workshops, training programs, and Academy learning — register or contact providers.',
    resourceCategorySlugs: ['jobs', 'education'],
    primaryRoute: '/academy',
    helpNowQuery: 'skills training workshop',
    coverageNote: 'Matches verified training resources and Academy; not an open tutoring marketplace.',
  },
  {
    id: 'microbusiness',
    pillar: 'want_to_grow',
    title: 'Microbusiness',
    subtitle: 'Startup Academy, business training, and verified entrepreneurship resources.',
    resourceCategorySlugs: ['entrepreneurship', 'jobs'],
    primaryRoute: '/entrepreneurship',
    helpNowQuery: 'start a small business training',
    coverageNote: 'No guaranteed funding or customers; connects to real programs and tools.',
  },
  {
    id: 'education_scholarships',
    pillar: 'want_to_grow',
    title: 'Education & scholarships',
    subtitle: 'GED, certifications, trade programs, scholarships, and tuition help.',
    resourceCategorySlugs: ['education', 'money'],
    primaryRoute: '/opportunities',
    helpNowQuery: 'GED scholarship adult education',
    coverageNote: 'Uses Resource Scout data and opportunities registry; deadlines vary by provider.',
  },
  {
    id: 'family_center',
    pillar: 'need_help',
    title: 'Family opportunity center',
    subtitle: 'Childcare, parenting support, diapers, school supplies, and family programs.',
    resourceCategorySlugs: ['family', 'food', 'clothing'],
    primaryRoute: '/resources',
    helpNowQuery: 'childcare diapers school supplies',
    coverageNote: 'Community GIVE may supplement; children’s identities stay off public posts.',
  },
  {
    id: 'events_volunteering',
    pillar: 'can_help',
    title: 'Events & volunteering',
    subtitle: 'Workshops, nonprofit volunteering, and organization activities.',
    resourceCategorySlugs: ['education', 'health_wellness'],
    primaryRoute: '/community/can-help',
    helpNowQuery: 'volunteer this weekend',
    coverageNote: 'Discover and contact organizers; not a neighbor errand marketplace.',
  },
  {
    id: 'benefits_navigator',
    pillar: 'need_help',
    title: 'Benefits navigator',
    subtitle: 'SNAP, Medicaid, utilities, childcare benefits, and enrollment help.',
    resourceCategorySlugs: ['benefits', 'money', 'emergency_help'],
    primaryRoute: '/resources',
    helpNowQuery: 'SNAP Medicaid utility assistance',
    coverageNote: 'Shows official requirements where known; FairPath does not guarantee eligibility.',
  },
  {
    id: 'health_wellness',
    pillar: 'need_help',
    title: 'Health & wellness',
    subtitle: 'Clinics, dental, counseling, recovery support, and wellness programs.',
    resourceCategorySlugs: ['health_wellness'],
    primaryRoute: '/resources',
    helpNowQuery: 'clinic counseling recovery support',
    coverageNote: 'Navigation and referrals only — not diagnosis or medical records collection.',
  },
  {
    id: 'mentorship',
    pillar: 'want_to_grow',
    title: 'Mentorship',
    subtitle: 'Career, education, entrepreneurship, reentry, and financial literacy programs.',
    resourceCategorySlugs: ['jobs', 'education', 'entrepreneurship'],
    primaryRoute: '/resources',
    helpNowQuery: 'mentorship career program',
    coverageNote: 'Program-based contact only; no unrestricted private mentor messaging in V1.',
  },
  {
    id: 'transportation',
    pillar: 'need_help',
    title: 'Transportation',
    subtitle: 'Transit passes, vouchers, bicycle programs, and license restoration resources.',
    resourceCategorySlugs: ['transportation', 'id_documents'],
    primaryRoute: '/resources',
    helpNowQuery: 'bus pass transportation voucher',
    coverageNote: 'No ride-hailing or volunteer driver dispatch in V1.',
  },
  {
    id: 'community_drives',
    pillar: 'can_help',
    title: 'Community drives & impact',
    subtitle: 'Organization drives and donation needs via GIVE and participating programs.',
    resourceCategorySlugs: ['food', 'clothing', 'family'],
    primaryRoute: '/community',
    helpNowQuery: 'donation drive community impact',
    coverageNote: 'Tracks completed contributions where systems support it; no crowdfunding in V1.',
  },
] as const;

const BY_ID = new Map(V1_PATHWAYS.map((p) => [p.id, p]));

export function v1PathwayById(id: V1PathwayId): V1Pathway {
  const hit = BY_ID.get(id);
  if (!hit) throw new Error(`Unknown V1 pathway: ${id}`);
  return hit;
}

/** Map growth / pathway categories to resource slugs and in-app routes. */
export function resolveGrowthDiscovery(category: string): { resourceSlugs: string[]; route: string | null; pathwayId: V1PathwayId | null } {
  const key = String(category ?? '').trim().toLowerCase();
  if (key === 'record_relief') {
    return { resourceSlugs: ['legal', 'benefits'], route: '/record-relief', pathwayId: null };
  }
  if (key === 'legal') {
    const p = v1PathwayById('benefits_navigator');
    return { resourceSlugs: ['legal', ...p.resourceCategorySlugs], route: '/resources?q=legal%20help', pathwayId: 'benefits_navigator' };
  }
  if (key === 'housing') {
    const p = v1PathwayById('family_center');
    return { resourceSlugs: [...p.resourceCategorySlugs], route: '/find-housing', pathwayId: 'family_center' };
  }
  if (key === 'employment') {
    const p = v1PathwayById('skills_exchange');
    return { resourceSlugs: [...p.resourceCategorySlugs], route: '/find-jobs', pathwayId: 'skills_exchange' };
  }
  if (key === 'financial') {
    const p = v1PathwayById('benefits_navigator');
    return { resourceSlugs: [...p.resourceCategorySlugs], route: '/credit', pathwayId: 'benefits_navigator' };
  }

  const direct: Record<string, V1PathwayId> = {
    education: 'education_scholarships',
    entrepreneurship: 'microbusiness',
    skills_exchange: 'skills_exchange',
    microbusiness: 'microbusiness',
    education_scholarships: 'education_scholarships',
    family_center: 'family_center',
    events_volunteering: 'events_volunteering',
    benefits_navigator: 'benefits_navigator',
    health_wellness: 'health_wellness',
    mentorship: 'mentorship',
    transportation: 'transportation',
    community_drives: 'community_drives',
    volunteer: 'events_volunteering',
    benefits: 'benefits_navigator',
    health: 'health_wellness',
    mentorship_program: 'mentorship',
  };
  const pid = direct[key] ?? null;
  if (!pid) return { resourceSlugs: [], route: null, pathwayId: null };
  const p = v1PathwayById(pid);
  return { resourceSlugs: [...p.resourceCategorySlugs], route: p.primaryRoute, pathwayId: pid };
}
