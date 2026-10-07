// AI Business Builder foundation: an editable business plan and startup budget built from member-entered numbers.
// No financial guarantee or grant assurance is ever generated. Every figure is labeled as the member's own estimate.

export type BudgetLine = { label: string; monthlyUsd: number };

export type StartupBudget = {
  oneTimeCosts: BudgetLine[];
  monthlyCosts: BudgetLine[];
  expectedMonthlyRevenue: number;
};

export type BudgetSummary = {
  totalOneTimeUsd: number;
  totalMonthlyCostsUsd: number;
  monthlyNetUsd: number;
  monthsToCoverStartupCosts: number | null; // null when monthly net is not positive
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarizeBudget(b: StartupBudget): BudgetSummary {
  const totalOneTimeUsd = round2(b.oneTimeCosts.reduce((s, l) => s + Math.max(0, l.monthlyUsd), 0));
  const totalMonthlyCostsUsd = round2(b.monthlyCosts.reduce((s, l) => s + Math.max(0, l.monthlyUsd), 0));
  const monthlyNetUsd = round2(Math.max(0, Math.max(0, b.expectedMonthlyRevenue) - totalMonthlyCostsUsd));
  return {
    totalOneTimeUsd,
    totalMonthlyCostsUsd,
    monthlyNetUsd,
    monthsToCoverStartupCosts: monthlyNetUsd > 0 ? Math.ceil(totalOneTimeUsd / monthlyNetUsd) : null,
  };
}

export type PlanSection = { id: string; title: string; prompt: string; content: string };

/** A blank, editable plan outline. No section is pre-filled with invented facts about the member's business. */
export function blankBusinessPlan(): PlanSection[] {
  return [
    { id: 'summary', title: 'Business summary', prompt: 'What does your business do, in one or two sentences?', content: '' },
    { id: 'customers', title: 'Who you serve', prompt: 'Who are your first customers, specifically?', content: '' },
    { id: 'offer', title: 'What you offer', prompt: 'What exactly are you selling, and what makes it different?', content: '' },
    { id: 'pricing', title: 'Pricing', prompt: 'What will you charge, and why?', content: '' },
    { id: 'marketing', title: 'Reaching customers', prompt: 'How will people find out about you?', content: '' },
    { id: 'operations', title: 'Day to day', prompt: 'What does running the business look like week to week?', content: '' },
    { id: 'milestones', title: 'First 90 days', prompt: 'What are the first three things you need to do?', content: '' },
  ];
}

export function updateSection(plan: readonly PlanSection[], id: string, content: string): PlanSection[] {
  return plan.map((s) => (s.id === id ? { ...s, content: content.slice(0, 2000) } : s));
}

export const PLAN_DISCLAIMER =
  'This plan reflects what you entered. FairPath does not guarantee funding, grant approval, profitability or business success.';
