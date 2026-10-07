// Candidate submission projection: what FairPath sends a client about a candidate. An explicit allowlist, same
// pattern as member-view.ts. The source object below represents the member's FULL internal profile on purpose —
// the projection function must work correctly even when handed everything, because in production it will be.

export type FullMemberProfile = {
  memberId: string;
  displayName: string;
  relevantExperience: string;
  skills: readonly string[];
  credentials: readonly string[];
  resumeText: string;
  availabilityText: string;
  locationPreference: string;
  preparationStatus: 'not_started' | 'in_progress' | 'ready';
  // Sensitive data that exists on a real member profile and must NEVER reach a candidate submission unless the
  // member has explicitly and separately opted to share it (veteranStatusSharedByMember is the one legitimate path).
  reentryPathwayActive: boolean;
  convictionDetails: string | null;
  veteranStatus: boolean;
  veteranStatusSharedByMember: boolean; // the ONLY condition under which veteran status may appear
  disabilityInfo: string | null;
  recoveryInfo: string | null;
  housingSituation: string | null;
  caseManagementNotes: string | null;
  creditInformation: Record<string, unknown> | null;
  unrelatedDocumentRefs: readonly string[];
  privateAiConversationRefs: readonly string[];
};

export type CandidateSubmission = {
  memberId: string;
  displayName: string;
  relevantExperience: string;
  skills: readonly string[];
  credentials: readonly string[];
  resumeText: string;
  availabilityText: string;
  locationPreference: string;
  preparationStatus: FullMemberProfile['preparationStatus'];
  veteranStatus: boolean | null; // null = not shared; true only when the member explicitly opted in
};

/**
 * The only function allowed to turn a full member profile into something a client sees. Builds the output field by
 * field from an explicit allowlist — it is structurally impossible for this function to forward a field it does not
 * name, no matter what extra properties the input object carries.
 */
export function buildCandidateSubmission(p: FullMemberProfile): CandidateSubmission {
  return {
    memberId: p.memberId,
    displayName: p.displayName,
    relevantExperience: p.relevantExperience,
    skills: p.skills,
    credentials: p.credentials,
    resumeText: p.resumeText,
    availabilityText: p.availabilityText,
    locationPreference: p.locationPreference,
    preparationStatus: p.preparationStatus,
    veteranStatus: p.veteranStatusSharedByMember ? p.veteranStatus : null,
  };
}

/** Fields that must never appear anywhere in a CandidateSubmission, under any circumstance. */
export const FORBIDDEN_SUBMISSION_FIELDS = [
  'reentryPathwayActive', 'convictionDetails', 'disabilityInfo', 'recoveryInfo', 'housingSituation',
  'caseManagementNotes', 'creditInformation', 'unrelatedDocumentRefs', 'privateAiConversationRefs',
] as const;
