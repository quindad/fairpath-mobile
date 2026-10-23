import { SUGGESTIONS } from '@/core/ai/intents';
import { loadHomePersonalization } from '@/core/profile/home-personalization';
import { loadMemberSummary } from '@/core/profile/member-summary';
import { primaryNextStep } from '@/core/profile/next-step';

const GOAL_PROMPTS: Record<string, string> = {
  'Work & income': 'Find jobs that fit my experience.',
  Housing: 'Find housing opportunities near me.',
  'Food & essentials': 'Help me find food and essentials nearby.',
  Reentry: 'Help me understand my record relief options.',
  'Veteran transition': 'What veteran benefits and jobs should I look at?',
  'Learn new skills': 'Find education or training for my goals.',
  'Build a business': 'Build a plan to start my business.',
  'Give or help someone': 'How can I help someone in my community?',
};

const DEFAULT_STARTERS = [
  'Show me what I should do next.',
  'Find jobs that fit my experience.',
  'Help me understand my record relief options.',
  'Find housing opportunities.',
  'I need somewhere to stay tonight.',
  'Help me write a cover letter.',
] as const;

/** Up to six conversation starters — goals and next-step aware when signed in. */
export async function loadSignalSuggestions(): Promise<string[]> {
  try {
    const [personalization, summary] = await Promise.all([
      loadHomePersonalization().catch(() => null),
      loadMemberSummary().catch(() => null),
    ]);
    const out: string[] = [];
    const step = summary ? primaryNextStep(summary) : null;
    if (step?.title) out.push(`Help me with: ${step.title}`);
    for (const goal of personalization?.goals ?? []) {
      const p = GOAL_PROMPTS[goal];
      if (p && !out.includes(p)) out.push(p);
      if (out.length >= 6) break;
    }
    if (out.length < 4) {
      for (const s of DEFAULT_STARTERS) {
        if (!out.includes(s)) out.push(s);
        if (out.length >= 6) break;
      }
    }
    if (out.length) return out.slice(0, 6);
  } catch {
    /* fall through */
  }
  return [...new Set([...DEFAULT_STARTERS, ...SUGGESTIONS.slice(0, 4)])].slice(0, 6);
}
