// Curated "insightful articles" for the Opportunities screen - real, sourced, external content (never
// fabricated), following the same pattern as src/core/credit/credit-education.ts: a plain static list, every
// card linking out to the real publisher. Each URL below was loaded and read live before being added here
// (2026-10-15). FairPath doesn't claim authorship - every card is clearly attributed to its real source.
export type ArticleCard = {
  id: string;
  title: string;
  summary: string;
  category: 'jobs' | 'credit' | 'housing' | 'education';
  source: { label: string; url: string };
};

export const CURATED_ARTICLES: ArticleCard[] = [
  {
    id: 'justice_impacted_job_search',
    title: 'Job search help for justice-impacted workers',
    summary: 'A Department of Labor-backed, step-by-step guide covering job search prep, local reentry programs, and work restrictions that may apply to certain convictions.',
    category: 'jobs',
    source: { label: 'CareerOneStop (U.S. Department of Labor)', url: 'https://www.careeronestop.org/JusticeImpacted/default.aspx' },
  },
  {
    id: 'explain_career_gap',
    title: 'How to explain a career gap in an interview',
    summary: 'Practical advice on talking about time away from work honestly and briefly, without letting the gap overshadow what you bring to the role.',
    category: 'jobs',
    source: { label: 'Indeed Career Advice', url: 'https://ca.indeed.com/career-advice/interviewing/career-gap' },
  },
  {
    id: 'second_chance_checking',
    title: 'Second chance checking accounts, explained',
    summary: 'How second chance bank accounts work for people turned down because of past banking history, including the tradeoffs on fees and features.',
    category: 'credit',
    source: { label: 'NerdWallet', url: 'https://www.nerdwallet.com/article/banking/second-chance-checking' },
  },
  {
    id: 'secured_credit_card_building',
    title: 'How to build credit with a secured credit card',
    summary: 'What a secured card actually does for your credit, how to pick one that reports to all three bureaus, and how to use it to graduate to an unsecured card.',
    category: 'credit',
    source: { label: 'NerdWallet', url: 'https://www.nerdwallet.com/credit-cards/learn/build-credit-with-secured-credit-card' },
  },
];

export function articlesByCategory(category?: ArticleCard['category']): ArticleCard[] {
  return category ? CURATED_ARTICLES.filter((a) => a.category === category) : CURATED_ARTICLES;
}
