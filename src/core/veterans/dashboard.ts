// Veterans dashboard sections. Each section declares its honest status. Benefits navigation links to official programs
// and accredited assistance; FairPath never makes eligibility or benefit determinations.

export type SectionStatus = 'live' | 'in_development' | 'planned';

export type VeteranSection = {
  id: string;
  title: string;
  group: 'employment' | 'housing' | 'benefits' | 'entrepreneurship' | 'community';
  status: SectionStatus;
  /** Benefits sections may only point to official sources. */
  officialLinksOnly: boolean;
};

export const VETERAN_SECTIONS: readonly VeteranSection[] = [
  { id: 'skills_translation', title: 'Military-to-civilian skills', group: 'employment', status: 'in_development', officialLinksOnly: false },
  { id: 'veteran_employers', title: 'Veteran-friendly employers', group: 'employment', status: 'in_development', officialLinksOnly: false },
  { id: 'resume_translation', title: 'Resume translation', group: 'employment', status: 'in_development', officialLinksOnly: false },
  { id: 'interview_prep', title: 'Interview preparation', group: 'employment', status: 'planned', officialLinksOnly: false },
  { id: 'veteran_housing', title: 'Veteran housing resources', group: 'housing', status: 'in_development', officialLinksOnly: false },
  { id: 'benefits_navigation', title: 'Benefits navigation', group: 'benefits', status: 'in_development', officialLinksOnly: true },
  { id: 'business_resources', title: 'Veteran business resources', group: 'entrepreneurship', status: 'planned', officialLinksOnly: false },
  { id: 'transition_support', title: 'Transition and community support', group: 'community', status: 'in_development', officialLinksOnly: false },
];

/** Hard constant: this pathway never makes a benefit, eligibility or claim determination. */
export const BENEFIT_DETERMINATIONS_ALLOWED = false as const;

/** Whether a section may be presented as usable right now. */
export function sectionUsable(section: VeteranSection): boolean {
  return section.status === 'live';
}
