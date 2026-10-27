/**
 * Resource search + card filtering for multi-need Signal prompts (jobs + transportation, etc.).
 * Edge fairpath-ai-gateway mirrors this logic in supabase/functions/_shared/signal/resource-relevance.ts.
 */

export type ResourceNeedHints = {
  wantsJobs: boolean;
  wantsTransport: boolean;
  wantsHousing: boolean;
  wantsFood: boolean;
  wantsCreditOrMoney: boolean;
  wantsNearMe: boolean;
};

export function resourceNeedHints(question: string): ResourceNeedHints {
  const t = (question ?? '').toLowerCase();
  return {
    wantsJobs: /\b(job|jobs|work|employ|hire|career)\b/.test(t),
    wantsTransport: /\b(transport|transportation|ride|bus|transit|no car|driver.?s?\s*license)\b/.test(t),
    wantsHousing: /\b(hous|rent|apartment|shelter|stay)\b/.test(t),
    wantsFood: /\b(food|grocer|hungry|meal)\b/.test(t),
    wantsCreditOrMoney: /\b(credit|loan|debt|bank|checking|savings|financial|budget)\b/.test(t),
    wantsNearMe: /\bnear me\b|\baround me\b|\bclose by\b|\bnearby\b/.test(t),
  };
}

export type ResourceSearchRpcParams = {
  query: string | null;
  category: string | null;
  includeNational: boolean;
};

/** RPC args for search_resources — avoids nationwide financial backfill on local multi-need prompts. */
export function resourceSearchRpcParams(question: string, zip: string | null | undefined): ResourceSearchRpcParams {
  const hints = resourceNeedHints(question);
  if (hints.wantsTransport) {
    return {
      query: 'transportation transit job ride',
      category: 'transportation',
      includeNational: false,
    };
  }
  if (hints.wantsFood) {
    return { query: 'food assistance', category: 'food', includeNational: !zip && !hints.wantsNearMe };
  }
  const includeNational = Boolean(zip) ? false : !hints.wantsNearMe;
  return { query: question.trim().slice(0, 200) || null, category: null, includeNational };
}

export function isIrrelevantFinancialResource(title: string, categories: string[] = []): boolean {
  const cats = categories.map((c) => c.toLowerCase());
  if (cats.some((c) => c === 'credit' || c === 'money' || c === 'banking')) return true;
  return /\b(credit builder|credit counseling|financial coach|checking account|savings account|personal loan|debt coach|budget coach)\b/i.test(
    title,
  );
}

const TRANSPORT_JOB_CATEGORIES = new Set(['transportation', 'jobs', 'employment']);

/** Drop unrelated financial listings when the member asked for jobs and/or transportation. */
export function shouldKeepResourceResult(title: string, categories: string[] = [], question: string): boolean {
  const hints = resourceNeedHints(question);
  if (isIrrelevantFinancialResource(title, categories) && !hints.wantsCreditOrMoney) return false;

  if (hints.wantsTransport && !hints.wantsFood && !hints.wantsCreditOrMoney) {
    const cats = categories.map((c) => c.toLowerCase());
    const categoryOk = cats.some((c) => TRANSPORT_JOB_CATEGORIES.has(c));
    const titleOk = /\b(transit|ride|bus|transport|bike|mobility|driver|license|job ride|fare pass)\b/i.test(title);
    if (!categoryOk && !titleOk) return false;
  }
  return true;
}

export function nearMeRequiresZip(question: string, zip: string | null | undefined): boolean {
  const hints = resourceNeedHints(question);
  if (!hints.wantsNearMe) return false;
  return !zip || !/^\d{5}$/.test(zip);
}

/** Deterministic copy when a near-me prompt cannot run a local resource search. */
export function nearMeLocationNudgePart(): { text: string; basis: 'app_state' } {
  return {
    text: 'You asked for results near you, but FairPath does not have a saved ZIP or device location yet. Set a ZIP to search nearby jobs and transportation programs — we will not backfill with unrelated nationwide listings.',
    basis: 'app_state',
  };
}
