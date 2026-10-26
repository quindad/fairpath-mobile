/**
 * Member-facing map of every Signal (server AI) workflow the mobile app can trigger.
 * Used for discovery in the Assistant — not a second billing system; credits are spent on the server.
 */
export type SignalCategory = 'work' | 'housing' | 'credit' | 'records' | 'life' | 'business';

export type SignalCatalogEntry = {
  id: string;
  category: SignalCategory;
  title: string;
  description: string;
  /** Typical spend per tap (server `spend_ai_credits` cost). */
  creditCost: number;
  /** Open a FairPath screen where the button already lives. */
  route?: string;
  /** Free deterministic Assistant entry (no credit until enrich paths run). */
  assistantPrompt?: string;
};

export const SIGNAL_CATEGORY_LABEL: Record<SignalCategory, string> = {
  work: 'Work',
  housing: 'Housing',
  credit: 'Credit & money',
  records: 'Record relief',
  life: 'Next steps & resources',
  business: 'Business & marketplace',
};

/** Live today = client calls an Edge Function in src/core/ai/signal.ts */
export const SIGNAL_CATALOG: SignalCatalogEntry[] = [
  { id: 'focus', category: 'life', title: 'What should I focus on?', description: 'Looks at your FairPath activity and suggests honest next steps.', creditCost: 1, route: '/my-path' },
  { id: 'resources', category: 'life', title: 'Help with food, shelter, or bills', description: 'Grounded guidance toward resources — not a guarantee anything is open.', creditCost: 1, assistantPrompt: 'I need help with rent, utilities, or food while I get back on my feet' },
  { id: 'job_fit', category: 'work', title: 'Why might this job fit me?', description: 'On a job listing — explains requirements vs your profile.', creditCost: 1, route: '/find-jobs' },
  { id: 'cover_letter', category: 'work', title: 'Draft a cover letter', description: 'On a job listing — first draft you edit before you apply.', creditCost: 2, route: '/find-jobs' },
  { id: 'interview', category: 'work', title: 'Interview prep', description: 'On a job application — practice questions for that role.', creditCost: 1, route: '/job-applications' },
  { id: 'resume_bullets', category: 'work', title: 'Strengthen resume bullets', description: 'In Resume Studio — rephrases bullets you wrote, no invented jobs.', creditCost: 1, route: '/resume-studio' },
  { id: 'housing_fit', category: 'housing', title: 'Why might this home fit?', description: 'On a listing — screening and fit in plain language.', creditCost: 1, route: '/find-housing' },
  { id: 'housing_prep', category: 'housing', title: 'Application prep', description: 'On a housing application — what to double-check before submit.', creditCost: 1, route: '/housing-applications' },
  { id: 'credit_report', category: 'credit', title: 'Explain my credit report', description: 'Summarizes accounts and flags in your data — no score promises.', creditCost: 1, route: '/credit' },
  { id: 'credit_item', category: 'credit', title: 'Explain one flagged item', description: 'On a review item — why FairPath flagged it.', creditCost: 1, route: '/credit' },
  { id: 'dispute_draft', category: 'credit', title: 'Draft a dispute letter', description: 'Starts a letter you edit and send yourself.', creditCost: 2, route: '/credit/new-dispute' },
  { id: 'letter_explainer', category: 'credit', title: 'Explain a letter (photo)', description: 'Photo of mail or a notice — plain English, not legal advice.', creditCost: 2, route: '/letter-explainer' },
  { id: 'relief_case', category: 'records', title: 'Explain my relief case', description: 'On a Record Relief case — rules and timing in plain English.', creditCost: 1, route: '/record-relief' },
  { id: 'veteran_translate', category: 'work', title: 'Translate military experience', description: 'On Veterans — civilian wording for what you actually did.', creditCost: 1, route: '/veterans' },
  { id: 'marketplace_listing', category: 'business', title: 'Draft marketplace listing', description: 'When donating an item — description from your notes.', creditCost: 1, route: '/marketplace-list-item' },
  { id: 'business_idea', category: 'business', title: 'Feedback on a business idea', description: 'Startup Academy — grounded next steps, not a funding promise.', creditCost: 1, route: '/entrepreneurship' },
  { id: 'meeting_prep', category: 'work', title: 'Meeting prep', description: 'Before a scheduled meeting — agenda-style prep from real details.', creditCost: 1, route: '/meetings' },
];

/** Compact tools sheet — high-value workflows only (not the full grid). */
export function signalQuickTools(max = 8): SignalCatalogEntry[] {
  const pick = ['focus', 'resources', 'job_fit', 'housing_fit', 'credit_report', 'relief_case', 'letter_explainer', 'veteran_translate'];
  const out: SignalCatalogEntry[] = [];
  for (const id of pick) {
    const row = SIGNAL_CATALOG.find((e) => e.id === id);
    if (row) out.push(row);
    if (out.length >= max) break;
  }
  return out;
}

export function catalogByCategory(): { category: SignalCategory; label: string; items: SignalCatalogEntry[] }[] {
  const order: SignalCategory[] = ['life', 'work', 'housing', 'credit', 'records', 'business'];
  return order.map((category) => ({
    category,
    label: SIGNAL_CATEGORY_LABEL[category],
    items: SIGNAL_CATALOG.filter((e) => e.category === category),
  })).filter((g) => g.items.length > 0);
}
