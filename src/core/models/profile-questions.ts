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
  options?: string[];
  placeholder?: string;
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
    id: 'identity.date_of_birth',
    area: 'identity',
    label: 'What is your date of birth?',
    helpText: 'Used for application autofill and age-based eligibility checks when applicable.',
    input: 'date',
    required: true,
    sensitive: true,
    purposes: ['autofill', 'application', 'program_screening'],
  },
  {
    id: 'identity.phone',
    area: 'identity',
    label: 'What is your phone number?',
    helpText: 'Saved once for contact and application autofill.',
    input: 'text',
    required: true,
    purposes: ['autofill', 'application'],
  },
  {
    id: 'identity.address',
    area: 'identity',
    label: 'What is your current or planned home address?',
    helpText: 'Used for nearby opportunities, resources, and autofill. Address entry will use autocomplete where available.',
    input: 'text',
    required: true,
    sensitive: true,
    purposes: ['matching', 'autofill', 'application'],
  },
  {
    id: 'convictions.conviction_date',
    area: 'eligibility',
    label: 'When were you convicted?',
    helpText: 'Used for opportunity and program screening. This is not automatically shared with partners.',
    input: 'date',
    required: true,
    sensitive: true,
    purposes: ['matching', 'program_screening', 'compliance'],
    dependsOn: { questionId: 'convictions.has_felony', equals: true },
  },
  {
    id: 'convictions.jurisdiction_state',
    area: 'eligibility',
    label: 'In what state were you convicted?',
    helpText: 'Rules and programs can differ by jurisdiction.',
    input: 'single_select',
    required: true,
    sensitive: true,
    purposes: ['matching', 'program_screening', 'compliance'],
    options: ['Ohio','Maryland','Michigan','Pennsylvania','West Virginia','Indiana','Kentucky','Other'],
    dependsOn: { questionId: 'convictions.has_felony', equals: true },
  },
  {
    id: 'convictions.offense_code',
    area: 'eligibility',
    label: 'Do you know the statute or offense code?',
    helpText: 'Providing the exact code can improve screening accuracy. FairPath can later help extract it from permitted documents.',
    input: 'text',
    required: false,
    sensitive: true,
    purposes: ['matching', 'compliance'],
    dependsOn: { questionId: 'convictions.has_felony', equals: true },
  },
  {
    id: 'restrictions.supervision_status',
    area: 'eligibility',
    label: 'Are you currently on probation, parole, post-release control, or another form of supervision?',
    helpText: 'Some opportunities or plans may be affected by active supervision requirements.',
    input: 'single_select',
    required: true,
    sensitive: true,
    purposes: ['matching', 'pre_release', 'compliance'],
    options: ['None','Probation','Parole','Post-release control','Other'],
  },
  {
    id: 'employment.education_level',
    area: 'employment',
    label: 'What is the highest level of education you completed?',
    helpText: 'Improves job matching, resume creation, and application autofill.',
    input: 'single_select',
    required: true,
    purposes: ['matching', 'autofill', 'application'],
    options: ['Less than high school','High school diploma','GED','Some college','Associate degree','Bachelor’s degree','Graduate degree','Trade or vocational training'],
  },
  {
    id: 'employment.skills',
    area: 'employment',
    label: 'What skills do you have?',
    helpText: 'FairPath uses your skills for matching and can reuse them in resumes and applications.',
    input: 'multi_select',
    required: true,
    purposes: ['matching', 'autofill', 'application'],
    options: ['Customer service','Warehouse','Construction','Driving','Food service','Cleaning','Manufacturing','Sales','Office / admin','Technology','Skilled trades','Other'],
  },
  {
    id: 'employment.licenses_certifications',
    area: 'employment',
    label: 'What licenses or certifications do you have?',
    helpText: 'Helps identify jobs you may already be qualified to pursue.',
    input: 'multi_select',
    required: false,
    purposes: ['matching', 'autofill', 'application'],
    options: ['Driver license','CDL','Forklift','OSHA','ServSafe','STNA / CNA','Trade license','Other'],
  },
  {
    id: 'housing.target_cities',
    area: 'housing',
    label: 'Where are you looking for housing?',
    helpText: 'Used to prioritize housing opportunities in the places you can live.',
    input: 'multi_select',
    required: true,
    purposes: ['matching', 'autofill'],
    options: ['Current city','Nearby cities','Anywhere in my state','Open to relocating'],
  },
  {
    id: 'housing.monthly_income_range',
    area: 'housing',
    label: 'What is your current monthly household income range?',
    helpText: 'Used for housing compatibility and applicable program screening.',
    input: 'single_select',
    required: true,
    sensitive: true,
    purposes: ['matching', 'application', 'program_screening'],
    options: ['No current income','Under $1,000','$1,000–$1,999','$2,000–$2,999','$3,000–$4,999','$5,000+'],
  },
  {
    id: 'documents.social_security_card',
    area: 'documents',
    label: 'Do you have your Social Security card?',
    helpText: 'Helps FairPath identify documents you may need for work and other applications.',
    input: 'yes_no',
    required: true,
    sensitive: true,
    purposes: ['document_readiness', 'pre_release'],
  },
  {
    id: 'documents.birth_certificate',
    area: 'documents',
    label: 'Do you have a copy of your birth certificate?',
    helpText: 'Helps FairPath build your document-readiness plan.',
    input: 'yes_no',
    required: true,
    sensitive: true,
    purposes: ['document_readiness', 'pre_release'],
  },
  {
    id: 'documents.resume',
    area: 'documents',
    label: 'Do you have a current resume?',
    helpText: 'If not, FairPath AI can help build one from information you provide.',
    input: 'yes_no',
    required: true,
    purposes: ['document_readiness', 'application'],
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
    options: ['Full-time','Part-time','Temporary','Gig work','Remote','Open to anything'],
  },
  {
    id: 'employment.transportation',
    area: 'employment',
    label: 'What transportation can you reliably use for work?',
    helpText: 'Helps avoid recommending jobs you cannot reasonably reach.',
    input: 'multi_select',
    required: true,
    purposes: ['matching'],
    options: ['Own vehicle','Public transit','Ride from someone','Bike / walk','Rideshare','Employer transportation'],
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
