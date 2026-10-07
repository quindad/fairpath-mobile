// Fair-chance matching, applied to staffing. Wraps src/core/matching/fair-chance.ts rather than reimplementing it:
// the criminal-history disclosure rule is identical. This module adds the staffing-specific factors (location,
// schedule, skills, experience, credentials) that fair-chance.ts has no concept of, and keeps them strictly
// separate from the disclosure-gated restriction outcome.

import { explainMatch, type EmployerPolicy, type MemberDisclosure, type MatchOutcome } from '../matching/fair-chance.ts';

export type StaffingFactor = { kind: 'location' | 'schedule' | 'skill' | 'experience' | 'credential' | 'preference'; met: boolean; detail: string };

export type StaffingMatchExplanation = {
  outcome: MatchOutcome; // from fair-chance.ts; never invented here
  reason: string;
  factors: StaffingFactor[]; // explainable, member-disclosed-only inputs
};

export type AssignmentRequirements = {
  location: string;
  scheduleText: string;
  requiredSkills: readonly string[];
  minExperienceYears: number | null;
  requiredCredentials: readonly string[];
};

export type MemberProfile = {
  preferredLocations: readonly string[];
  availabilityText: string;
  skills: readonly string[];
  experienceYears: number | null;
  credentials: readonly string[];
};

/**
 * Explains fit using only disclosed facts. Never infers undisclosed criminal history (that rule lives entirely in
 * fair-chance.ts's explainMatch and is not re-derived here). Never returns an outcome that reads as a hiring
 * decision; the employer or staffing recruiter still decides.
 */
export function explainStaffingMatch(
  policy: EmployerPolicy,
  disclosure: MemberDisclosure,
  req: AssignmentRequirements,
  profile: MemberProfile,
): StaffingMatchExplanation {
  const base = explainMatch(policy, disclosure);
  const factors: StaffingFactor[] = [
    { kind: 'location', met: profile.preferredLocations.includes(req.location), detail: `Location: ${req.location}` },
    { kind: 'schedule', met: profile.availabilityText === req.scheduleText, detail: `Schedule: ${req.scheduleText}` },
    ...req.requiredSkills.map((s) => ({ kind: 'skill' as const, met: profile.skills.includes(s), detail: `Skill: ${s}` })),
    {
      kind: 'experience',
      met: req.minExperienceYears === null || (profile.experienceYears ?? 0) >= req.minExperienceYears,
      detail: req.minExperienceYears === null ? 'No minimum experience stated' : `Requires ${req.minExperienceYears}+ years`,
    },
    ...req.requiredCredentials.map((c) => ({ kind: 'credential' as const, met: profile.credentials.includes(c), detail: `Credential: ${c}` })),
  ];
  return { outcome: base.outcome, reason: base.reason, factors };
}

/** No staffing match output may ever be phrased as a hiring or placement decision. */
export const BANNED_DECISION_PHRASES = [/you (are|were) hired/i, /you (are|were) rejected/i, /guaranteed placement/i, /you will be placed/i];
