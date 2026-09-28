// FairPath AI: deterministic intent recognition (pure, no imports).
//
// The assistant maps what a member says to a REAL workflow. Recognition is rule-based and explainable, so it behaves the
// same with or without an AI model, and it can never invent a capability. Anything unrecognized falls back to an honest
// "here is what I can help with" answer.

export type IntentId =
  | 'safety' | 'need_shelter' | 'find_resources' | 'finish_profile' | 'credit_review' | 'credit_why_flagged' | 'credit_build_dispute' | 'credit_dispute_status'
  | 'relief_can_i_clear' | 'relief_when_eligible' | 'relief_paperwork' | 'relief_coverage' | 'housing_requirements' | 'find_jobs' | 'my_jobs' | 'find_housing' | 'my_housing'
  | 'create_resume' | 'my_resumes' | 'my_meetings' | 'next_steps' | 'documents' | 'market_coverage' | 'help';

export type Intent = { id: IntentId; task: string; label: string; patterns: RegExp[]; priority: number };

const T = (s: string) => s;
export const INTENTS: Intent[] = [
  { id: 'safety', task: 'navigation', label: T('Safety'), priority: 100,
    patterns: [/\b(suicid|kill myself|end my life|hurt myself|self.?harm|want to die)\b/i, /\b(being abused|abusing me|domestic violence|not safe|unsafe at home|in danger|someone is hurting)\b/i] },
  { id: 'need_shelter', task: 'resource_search', label: T('Somewhere to stay'), priority: 90,
    patterns: [/\b(somewhere|place|need|nowhere)\b.*\b(stay|sleep|go tonight)\b/i, /\b(shelter|homeless|sleeping outside|on the street|nowhere to (go|sleep|stay))\b/i, /\bstay tonight\b/i] },
  { id: 'credit_why_flagged', task: 'credit_explain', label: T('Why was this flagged'), priority: 80,
    patterns: [/\bwhy\b.*\b(flag|mark|highlight|list)\w*\b/i, /\bwhy did you (flag|mark)\b/i] },
  { id: 'credit_build_dispute', task: 'dispute_help', label: T('Build a dispute letter'), priority: 80,
    patterns: [/\b(build|write|create|make|draft|prepare)\b.*\b(dispute|letter)\b/i, /\bdispute letter\b/i] },
  { id: 'credit_review', task: 'credit_explain', label: T('Review a credit report'), priority: 70,
    patterns: [/\b(review|look at|check|go over|analy[sz]e|understand)\b.*\bcredit\b/i, /\bcredit (report|repair|builder)\b/i] },
  { id: 'relief_when_eligible', task: 'relief_countdown', label: T('When might I be eligible'), priority: 78,
    patterns: [/\bwhen\b.*\b(eligible|expunge|expungement|clear|seal|sealed)\b/i, /\b(how long|countdown|waiting period)\b/i] },
  { id: 'relief_paperwork', task: 'relief_explain', label: T('What paperwork do I need'), priority: 76,
    patterns: [/\b(what|which)\b.*\b(paperwork|forms?)\b/i, /\b(paperwork|filing packet|court forms?)\b/i, /\bhow do i file\b/i] },
  { id: 'relief_can_i_clear', task: 'relief_explain', label: T('Can I clear this record'), priority: 72,
    patterns: [/\b(clear|expunge|seal|erase|wipe)\b.*\b(record|conviction|charge|case)\b/i, /\b(expungement|record relief|sealing)\b/i, /\bcan i (clear|expunge|seal)\b/i] },
  { id: 'finish_profile', task: 'profile_help', label: T('Finish my profile'), priority: 70,
    patterns: [/\b(finish|complete|fill|update|improve|build)\b.*\bprofile\b/i, /\b(my )?profile\b.*\b(help|incomplete|done)\b/i] },
  { id: 'housing_requirements', task: 'resource_search', label: T('Housing program requirements'), priority: 68,
    patterns: [/\bwhat do i need\b.*\b(housing|program|apply)\b/i, /\b(required|requirements|what to bring)\b.*\b(housing|program|documents?)\b/i] },
  { id: 'credit_dispute_status', task: 'dispute_status', label: T('Check my dispute status'), priority: 74,
    patterns: [/\b(dispute)\b.*\b(status|update|where|track|progress)\b/i, /\b(response|reply)\b.*\b(dispute|bureau|furnisher)\b/i] },
  { id: 'relief_coverage', task: 'relief_coverage', label: T('Which states are covered'), priority: 82,
    patterns: [/\b(which|what)\b.*\b(states?|jurisdictions?)\b.*\bcover/i, /\bcoverage\b.*\b(state|record relief)\b/i] },
  { id: 'find_jobs', task: 'jobs_search', label: T('Find jobs'), priority: 65,
    patterns: [/\b(find|search|look for|show)\b.*\bjobs?\b/i, /\bjob (search|opening|listing)s?\b/i] },
  { id: 'my_jobs', task: 'jobs_status', label: T('My applications'), priority: 66,
    patterns: [/\b(my|saved)\b.*\b(job )?applications?\b/i, /\bsaved jobs?\b/i, /\bapplication status\b/i] },
  { id: 'create_resume', task: 'resume_create', label: T('Create a resume'), priority: 70,
    patterns: [/\b(build|create|make|start|write)\b.*\bresume\b/i, /\bresume studio\b/i] },
  { id: 'my_resumes', task: 'resume_status', label: T('My resumes'), priority: 68,
    patterns: [/\b(my|edit|download|export)\b.*\bresume/i, /\bresumes?\b.*\b(saved|list|versions?)\b/i] },
  { id: 'my_meetings', task: 'meetings_status', label: T('My meetings'), priority: 68,
    patterns: [/\b(my|next|upcoming|schedule)\b.*\b(meeting|appointment|interview)s?\b/i, /\b(meeting|appointment)s?\b.*\b(coming up|scheduled)\b/i] },
  { id: 'find_housing', task: 'housing_search', label: T('Find housing'), priority: 64,
    patterns: [/\b(find|search|look for|show)\b.*\bhousing\b/i, /\b(apartment|rental)s?\b.*\b(find|search|near)\b/i] },
  { id: 'my_housing', task: 'housing_status', label: T('My housing applications'), priority: 65,
    patterns: [/\b(my|saved)\b.*\bhousing\b.*\bapplications?\b/i, /\bsaved (homes?|housing)\b/i] },
  { id: 'next_steps', task: 'next_steps', label: T('Show my next steps'), priority: 60,
    patterns: [/\b(next steps?|what (should|do) i do|what now|where do i start|show my next)\b/i] },
  { id: 'documents', task: 'document_help', label: T('My documents'), priority: 55,
    patterns: [/\b(export|download|print|pdf|my documents|save (a )?copy)\b/i] },
  { id: 'market_coverage', task: 'market_coverage_status', label: T('Is FairPath in my area'), priority: 67,
    patterns: [/\bis fairpath\b.*\b(my area|my zip|available|here)\b/i, /\b(when|is)\b.*\bfairpath\b.*\b(launch|come|available|coverage)\b/i,
      /\b(early access|waitlist)\b.*\b(status|my)\b/i, /\bam i on\b.*\bwaitlist\b/i, /\bis my (area|zip|market)\b.*\bcovered\b/i] },
  { id: 'find_resources', task: 'resource_search', label: T('Find help'), priority: 30,
    patterns: [/\b(need|looking for|find|where can i get|help with)\b/i] },
];

/** The starter phrases the UI offers (each is matched by the rules above). */
export const SUGGESTIONS = [
  'I need somewhere to stay tonight',
  'Help me finish my profile',
  'Review my credit report',
  'Why did you flag this account?',
  'Build my dispute letter',
  'Can I clear this record?',
  'When might I become eligible?',
  'What paperwork do I need?',
  'Show my next steps',
];

export function matchIntent(text: string): { intent: Intent | null; hits: number } {
  const t = (text ?? '').trim().slice(0, 500);
  if (!t) return { intent: null, hits: 0 };
  let best: { intent: Intent; score: number; hits: number } | null = null;
  for (const intent of INTENTS) {
    const hits = intent.patterns.filter((p) => p.test(t)).length;
    if (!hits) continue;
    const score = intent.priority * 10 + hits;
    if (!best || score > best.score) best = { intent, score, hits };
  }
  return best ? { intent: best.intent, hits: best.hits } : { intent: null, hits: 0 };
}
