// Veterans dashboard sections. Each section declares its honest status. Benefits navigation links to official programs
// and accredited assistance; FairPath never makes eligibility or benefit determinations.

export type SectionStatus = 'live' | 'in_development' | 'planned';

export type OfficialLink = { label: string; url: string };

export type VeteranSection = {
  id: string;
  title: string;
  group: 'employment' | 'housing' | 'benefits' | 'entrepreneurship' | 'community';
  status: SectionStatus;
  /** Benefits sections may only point to official sources. */
  officialLinksOnly: boolean;
  /** In-app route this section opens, when it points at a real already-built feature. */
  route?: string;
  /** Official, non-FairPath links shown for officialLinksOnly sections. */
  links?: readonly OfficialLink[];
  /** One line answering "why is this here / why does it matter for my transition" -- shown on every card so
   * the dashboard reads as a coherent reason to be on FairPath, not a loose list of links. */
  why: string;
};

// Trimmed 2026-10-16 (Sterling): Jobs and Housing are no longer split into separate "felon app"/"veteran app"
// experiences -- Felony Friendly and Veteran Friendly are now filters sitting on the SAME shared Jobs and
// Housing boards everyone uses (see supabase/migrations/20261016100000_unified_jobs_housing_filters.sql and
// the lane/filter UI in find-jobs.tsx and find-housing.tsx). That made four of the old seven sections here pure
// duplicates of tools already reachable from Home (resume_translation -> Resume Studio, interview_prep ->
// Job Applications, business_resources -> Entrepreneurship are generic tools with no veteran-specific logic;
// veteran_employers and veteran_housing were just the Jobs/Housing filter under a different name). What's left
// below is only what's GENUINELY veteran-specific and can't just be a filter: occupation-code translation,
// official VA benefits links, and real veteran community organizations.
export const VETERAN_SECTIONS: readonly VeteranSection[] = [
  { id: 'skills_translation', title: 'Military-to-civilian skills', group: 'employment', status: 'live', officialLinksOnly: false, route: '#skills_translation', why: 'A job title like "11B" or "Hospital Corpsman" means nothing to a civilian hiring manager until it\'s translated into skills they recognize.' },
  {
    id: 'benefits_navigation', title: 'Benefits navigation', group: 'benefits', status: 'live', officialLinksOnly: true,
    why: 'VA benefits are real money and real healthcare you earned. FairPath never decides your claim, but it won\'t let you forget to look.',
    links: [
      { label: 'VA.gov — Explore benefits', url: 'https://www.va.gov/explore/' },
      { label: 'VA.gov — File a disability claim', url: 'https://www.va.gov/disability/' },
      { label: 'Find an accredited Veteran Service Officer (VSO)', url: 'https://www.va.gov/ogc/apps/accreditation/index.asp' },
      { label: 'eBenefits (legacy self-service portal)', url: 'https://www.ebenefits.va.gov/' },
    ],
  },
  {
    id: 'transition_support', title: 'Transition and community support', group: 'community', status: 'live', officialLinksOnly: true,
    why: 'The hardest part of transition usually isn\'t paperwork, it\'s losing the built-in community. These are real organizations built by and for veterans, not a generic search.',
    links: [
      { label: 'Team Rubicon — disaster response service teams', url: 'https://teamrubiconusa.org/' },
      { label: 'Team Red, White & Blue — local veteran fitness and community chapters', url: 'https://teamrwb.org/' },
      { label: 'Travis Manion Foundation — veteran mental health and leadership programs', url: 'https://www.travismanion.org/' },
      { label: 'Student Veterans of America — campus chapters for veterans in school', url: 'https://studentveterans.org/' },
      { label: 'VFW — Veterans of Foreign Wars local posts', url: 'https://www.vfw.org/' },
    ],
  },
];

/** Hard constant: this pathway never makes a benefit, eligibility or claim determination. */
export const BENEFIT_DETERMINATIONS_ALLOWED = false as const;

/** Whether a section may be presented as usable right now. */
export function sectionUsable(section: VeteranSection): boolean {
  return section.status === 'live';
}
