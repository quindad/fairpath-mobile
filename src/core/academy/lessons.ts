import { STARTUP_ACADEMY_TRACK, type TrackStep } from '../entrepreneurship/tracks.ts';

export type LessonExercise = {
  id: string;
  label: string;
  /** Defaults to true — optional exercises do not block lesson completion. */
  required?: boolean;
};

export type LessonContent = {
  stepId: TrackStep;
  read: string;
  reflectPrompt: string;
  exercises: readonly LessonExercise[];
};

function lesson(
  stepId: TrackStep,
  read: string,
  reflectPrompt: string,
  exercises: readonly LessonExercise[],
): LessonContent {
  return { stepId, read, reflectPrompt, exercises };
}

/** Per-step lesson copy and exercise checklists (START-102). */
export const ACADEMY_LESSONS: readonly LessonContent[] = [
  lesson(
    'choose_idea',
    'Write down three problems you have noticed in your daily life or work. A business idea does not need to be original — it needs to solve something real for someone who will pay.',
    'Which problem would you still care about fixing six months from now, even if progress is slow?',
    [
      { id: 'list_three', label: 'I listed three possible problems or needs I could address.' },
      { id: 'one_customer', label: 'I named at least one type of person who has this problem (not “everyone”).' },
      { id: 'why_me', label: 'I wrote why I am interested in this idea personally.' },
    ],
  ),
  lesson(
    'validate_demand',
    'Before you spend on LLC fees, inventory, or ads, look for proof that people want what you plan to offer. Talk to people, read reviews of similar offers, and note what they complain about or praise.',
    'What is one low-cost way you could test interest this week (conversation, post, small offer)?',
    [
      { id: 'talked', label: 'I talked to or messaged at least two people who might be customers.' },
      { id: 'evidence', label: 'I wrote down what I learned (quotes, objections, or “not interested”).' },
      { id: 'next_test', label: 'I chose one small next test if demand still feels unclear.' },
    ],
  ),
  lesson(
    'research_competitors',
    'Search for businesses that solve a similar problem in your area or online. Note their prices, who they seem to target, and what reviews say they do well or poorly.',
    'What would make someone choose you instead of an existing option — or is the market already crowded for your idea?',
    [
      { id: 'found_three', label: 'I found at least three competitors or close alternatives.' },
      { id: 'compare', label: 'I compared price, audience, and one strength or weakness for each.' },
      { id: 'differentiator', label: 'I wrote one honest way I could be different or better for a niche.' },
    ],
  ),
  lesson(
    'choose_structure',
    'Sole proprietorship, LLC, and other structures change taxes, liability, and paperwork. Your state’s secretary of state or small-business site is the starting point — not a random blog.',
    'Which structure fits your risk level and whether you will have partners or employees soon?',
    [
      { id: 'researched', label: 'I read official guidance on at least two structures for my state.' },
      { id: 'pros_cons', label: 'I listed pros and cons for my top choice.' },
      { id: 'decision_or_question', label: 'I picked a structure or wrote questions for a qualified professional.' },
    ],
  ),
  lesson(
    'form_llc',
    'Forming an LLC usually means filing articles with your state and paying a fee. Requirements and names differ by state; use your state business portal for forms and fees.',
    'Do you know the exact state agency and fee schedule, or do you still need to look them up?',
    [
      { id: 'state_portal', label: 'I found my state’s official business filing portal or instructions.' },
      { id: 'name_check', label: 'I checked whether my desired business name is likely available.' },
      { id: 'filing_steps', label: 'I wrote the filing steps and estimated fees (from official sources).' },
    ],
  ),
  lesson(
    'get_ein',
    'An Employer Identification Number (EIN) is a free federal tax ID from the IRS. You apply on IRS.gov — avoid sites that charge for EIN “services” unless you knowingly choose paid help.',
    'Will you need an EIN now for banking or taxes, or only after you hire someone?',
    [
      { id: 'irs_source', label: 'I confirmed the free IRS application path (irs.gov).' },
      { id: 'info_ready', label: 'I gathered the information the IRS form will ask for.' },
      { id: 'applied_or_scheduled', label: 'I applied for an EIN or scheduled time to apply.' },
    ],
  ),
  lesson(
    'permits_and_licenses',
    'Cities, counties, and states license different activities — food, home-based business, contracting, and more. Your city clerk or state business office can tell you what applies to your address and industry.',
    'Which permits might apply to where you work and what you sell or do?',
    [
      { id: 'local_lookup', label: 'I looked up local business licensing for my city or county.' },
      { id: 'industry_rules', label: 'I checked industry-specific rules (health, zoning, professional license).' },
      { id: 'checklist', label: 'I made a checklist of permits to obtain before opening.' },
    ],
  ),
  lesson(
    'open_business_banking',
    'Separate business and personal money makes taxes and accountability easier. Banks often ask for formation documents and an EIN; compare fees and minimum balances before you open.',
    'Which account features matter most for you — low fees, branch access, or online tools?',
    [
      { id: 'compared_banks', label: 'I compared at least two business account options.' },
      { id: 'documents_list', label: 'I listed documents the bank will require from me.' },
      { id: 'open_or_appointment', label: 'I opened an account or booked an appointment to open one.' },
    ],
  ),
  lesson(
    'set_up_bookkeeping',
    'Track every dollar in and out from day one. You can start with a simple spreadsheet or app — consistency matters more than fancy software at first.',
    'How often will you update your books — weekly is a good default for a new business.',
    [
      { id: 'tool_chosen', label: 'I chose a spreadsheet, app, or ledger method.' },
      { id: 'categories', label: 'I defined basic categories (income, supplies, fees, etc.).' },
      { id: 'first_entry', label: 'I recorded at least one real or practice transaction.' },
    ],
  ),
  lesson(
    'build_business_credit',
    'Business credit is separate from personal credit and builds slowly through vendors and lenders who report to business bureaus. No one guarantees a score or line of credit — be wary of “instant business credit” pitches.',
    'What is one legitimate step you could take after you have steady business activity?',
    [
      { id: 'learn_basics', label: 'I read how business credit differs from personal credit.' },
      { id: 'vendor_plan', label: 'I identified one vendor or account that could report payment history.' },
      { id: 'no_scam', label: 'I noted red flags to avoid (upfront fees, guaranteed approvals).' },
    ],
  ),
  lesson(
    'research_funding',
    'Grants and loans have strict rules. Start with SBA.gov, your state economic development office, and known nonprofits — never pay upfront for a “guaranteed grant.”',
    'If you needed money tomorrow, would revenue, savings, or a small loan be realistic first?',
    [
      { id: 'real_sources', label: 'I bookmarked at least two legitimate funding information sources.' },
      { id: 'eligibility', label: 'I wrote whether grants or loans seem realistic for my stage.' },
      { id: 'scam_aware', label: 'I listed warning signs of funding scams.' },
    ],
  ),
  lesson(
    'price_products',
    'Price must cover costs, your time, and taxes — not just match the cheapest competitor. Write down unit costs and how long each sale takes you.',
    'What price would you need to earn a fair hourly rate on your smallest sale?',
    [
      { id: 'costs', label: 'I listed direct costs for one product or service.' },
      { id: 'time', label: 'I estimated time per sale including prep and delivery.' },
      { id: 'draft_price', label: 'I calculated a draft price and compared it to competitors.' },
    ],
  ),
  lesson(
    'market_the_business',
    'Marketing can be free or low-cost: tell your network, show up where your customers already are, and ask satisfied customers for referrals. Track what you tried and what happened.',
    'Where do your ideal customers already spend time online or in person?',
    [
      { id: 'channels', label: 'I picked one or two channels to focus on first.' },
      { id: 'message', label: 'I wrote a short plain-language description of what I offer.' },
      { id: 'one_action', label: 'I completed one marketing action (post, flyer, conversation, etc.).' },
    ],
  ),
  lesson(
    'acquire_customers',
    'First sales often come from people who already trust you. Follow up on interest, make buying easy, and deliver what you promised so word spreads.',
    'Who are three people you could ask for feedback or a first sale this month?',
    [
      { id: 'pipeline', label: 'I listed names or leads I can contact.' },
      { id: 'offer_clear', label: 'I made my offer and price clear in writing.' },
      { id: 'follow_up', label: 'I followed up with at least one lead or past conversation.' },
    ],
  ),
  lesson(
    'launch_and_operate',
    'Launching is not one day — it is repeating sales, fixing problems, and keeping records. Set a simple weekly review: money in, money out, and what to improve next.',
    'What is the one operational habit you will keep every week?',
    [
      { id: 'launch_check', label: 'I confirmed I can legally operate (structure, permits, banking as needed).' },
      { id: 'weekly_review', label: 'I scheduled a weekly business review on my calendar.' },
      { id: 'support', label: 'I noted where to get help (accountant, mentor, SBA resource).' },
    ],
  ),
];

const LESSON_BY_STEP = new Map(ACADEMY_LESSONS.map((l) => [l.stepId, l]));

/** Ensures catalog and lesson modules stay aligned. */
if (ACADEMY_LESSONS.length !== STARTUP_ACADEMY_TRACK.length) {
  throw new Error('ACADEMY_LESSONS must cover every STARTUP_ACADEMY_TRACK step.');
}
for (const step of STARTUP_ACADEMY_TRACK) {
  if (!LESSON_BY_STEP.has(step.id)) {
    throw new Error(`Missing lesson content for step: ${step.id}`);
  }
}

export function getLessonContent(stepId: TrackStep): LessonContent {
  const content = LESSON_BY_STEP.get(stepId);
  if (!content) throw new Error(`Unknown lesson step: ${stepId}`);
  return content;
}

export function getLessonContentOrNull(stepId: string): LessonContent | null {
  return LESSON_BY_STEP.get(stepId as TrackStep) ?? null;
}

export function requiredExerciseIds(content: LessonContent): string[] {
  return content.exercises.filter((e) => e.required !== false).map((e) => e.id);
}

export function totalRequiredExercisesAcrossTrack(): number {
  return ACADEMY_LESSONS.reduce((sum, l) => sum + requiredExerciseIds(l).length, 0);
}

export function validExerciseId(content: LessonContent, exerciseId: string): boolean {
  return content.exercises.some((e) => e.id === exerciseId);
}
