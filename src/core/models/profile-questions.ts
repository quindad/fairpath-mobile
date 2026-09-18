import type { ReadinessArea } from './readiness';

export type QuestionInput =
  | 'text'
  | 'date'
  | 'yes_no'
  | 'single_select'
  | 'multi_select'
  | 'number';

export type QuestionPurpose =
  | 'matching'
  | 'autofill'
  | 'application'
  | 'program_screening'
  | 'pre_release'
  | 'document_readiness'
  | 'compliance';

export type ProfileQuestion = {
  id: string;
  area: ReadinessArea;
  label: string;
  helpText: string;
  input: QuestionInput;
  required: boolean;
  sensitive?: boolean;
  purposes: QuestionPurpose[];
  dependsOn?: {
    questionId: string;
    equals: string | boolean;
  };
};

export const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    id: 'identity.current_location',
    area: 'identity',
    label: 'Where are you currently located?',
    helpText: 'Used to find opportunities and resources near you.',
    input: 'text',
    required: true,
    purposes: ['matching', 'autofill'],
  },
  {
    id: 'release.currently_incarcerated',
    area: 'reentry',
    label: 'Are you currently incarcerated?',
    helpText: 'Helps FairPath tailor pre-release or community-based support.',
    input: 'yes_no',
    required: true,
    sensitive: true,
    purposes: ['pre_release', 'matching'],
  },
  {
    id: 'release.expected_release_date',
    area: 'reentry',
    label: 'What is your expected release date?',
    helpText: 'Used for pre-release planning and time-sensitive opportunity screening.',
    input: 'date',
    required: true,
    sensitive: true,
    purposes: ['pre_release', 'program_screening', 'matching'],
    dependsOn: { questionId: 'release.currently_incarcerated', equals: true },
  },
  {
    id: 'release.actual_release_date',
    area: 'reentry',
    label: 'What was your most recent release date?',
    helpText: 'May be relevant to program or incentive screening and reentry planning.',
    input: 'date',
    required: true,
    sensitive: true,
    purposes: ['program_screening', 'matching'],
    dependsOn: { questionId: 'release.currently_incarcerated', equals: false },
  },
  {
    id: 'convictions.has_felony',
    area: 'eligibility',
    label: 'Do you have a felony conviction?',
    helpText: 'Used to determine which opportunity screening questions FairPath should ask next.',
    input: 'yes_no',
    required: true,
    sensitive: true,
    purposes: ['matching', 'program_screening'],
  },
  {
    id: 'convictions.offense_name',
    area: 'eligibility',
    label: 'What offense were you convicted of?',
    helpText: 'Used for compatibility screening. This is not automatically shared with partners.',
    input: 'text',
    required: true,
    sensitive: true,
    purposes: ['matching', 'program_screening', 'compliance'],
    dependsOn: { questionId: 'convictions.has_felony', equals: true },
  },
  {
    id: 'restrictions.sex_offender_registration',
    area: 'eligibility',
    label: 'Are you currently required to register as a sex offender?',
    helpText: 'Some opportunities may have legal or program restrictions. FairPath uses this for compatibility screening and does not treat it as a general public profile field.',
    input: 'yes_no',
    required: true,
    sensitive: true,
    purposes: ['matching', 'compliance'],
  },
  {
    id: 'employment.desired_roles',
    area: 'employment',
    label: 'What kind of work are you looking for?',
    helpText: 'Improves job recommendations and application autofill.',
    input: 'multi_select',
    required: true,
    purposes: ['matching', 'autofill', 'application'],
  },
  {
    id: 'employment.transportation',
    area: 'employment',
    label: 'What transportation can you reliably use for work?',
    helpText: 'Helps avoid recommending jobs you cannot reasonably reach.',
    input: 'multi_select',
    required: true,
    purposes: ['matching'],
  },
  {
    id: 'housing.household_size',
    area: 'housing',
    label: 'How many people will live with you?',
    helpText: 'Used for housing compatibility and application autofill.',
    input: 'number',
    required: true,
    purposes: ['matching', 'autofill', 'application'],
  },
  {
    id: 'documents.government_id',
    area: 'documents',
    label: 'Do you currently have a government-issued photo ID?',
    helpText: 'Helps FairPath build your document-readiness checklist.',
    input: 'yes_no',
    required: true,
    purposes: ['document_readiness', 'pre_release'],
  },
  {
    id: 'programs.screening_consent',
    area: 'eligibility',
    label: 'Would you like FairPath to check information you provide against available employment and reentry incentive programs?',
    helpText: 'Screening can identify programs worth reviewing, but it does not guarantee eligibility or a tax benefit.',
    input: 'yes_no',
    required: true,
    purposes: ['program_screening'],
  },
];

export function getVisibleQuestions(
  answers: Record<string, unknown>,
): ProfileQuestion[] {
  return PROFILE_QUESTIONS.filter((question) => {
    if (!question.dependsOn) return true;
    return answers[question.dependsOn.questionId] === question.dependsOn.equals;
  });
}

export function getRequiredVisibleQuestions(
  answers: Record<string, unknown>,
): ProfileQuestion[] {
  return getVisibleQuestions(answers).filter((question) => question.required);
}
