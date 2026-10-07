// Veteran-to-Civilian Skills contract: feeds staffing matching with translated skills, never with identity. Branch,
// MOS/rating, and clearance are optional and voluntary; none of them is allowed to adjust a match score directly —
// only the resulting SKILLS list can. Reuses src/core/veterans/translation.ts's reviewed-only rule.

import { translateOccupation, type ReviewedTranslation } from '../veterans/translation.ts';
import type { BranchId } from '../veterans/branches.ts';
import type { MemberProfile } from './matching.ts';

export type VeteranPreparationInput = {
  branch: BranchId | null;
  occupationCode: string | null; // MOS/rating/AFSC, voluntarily provided
  clearanceStatus: string | null; // voluntarily provided; only ever shown where appropriate, never to a generic employer DTO
  leadershipExperienceText: string;
  logisticsExperienceText: string;
  technicalExperienceText: string;
  transitionGoalsText: string;
  credentials: readonly string[];
  civilianResumeText: string;
};

/**
 * Builds a MemberProfile (matching.ts's input type) from translated skills only. Nothing identity-shaped — branch,
 * occupation code, veteran status itself — is present anywhere in the output. Only a REVIEWED translation
 * contributes a skill; an unreviewed occupation code contributes nothing rather than a guess.
 */
export function buildMatchProfileFromVeteranPrep(
  input: VeteranPreparationInput,
  reviewedTranslations: readonly ReviewedTranslation[],
  base: Omit<MemberProfile, 'skills'>,
): MemberProfile {
  const translated =
    input.branch && input.occupationCode
      ? translateOccupation(input.branch, input.occupationCode, reviewedTranslations)
      : { status: 'not_reviewed' as const };
  const translatedSkills = translated.status === 'reviewed' ? translated.roles : [];
  return { ...base, skills: [...translatedSkills, ...input.credentials] };
}

/** Fields that must never appear in anything handed to matching.ts or a candidate submission. */
export const VETERAN_IDENTITY_FIELDS = ['branch', 'occupationCode', 'clearanceStatus'] as const;
