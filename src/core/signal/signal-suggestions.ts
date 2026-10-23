import { SUGGESTIONS } from '@/core/ai/intents';
import { filterNextStepsForCapabilities, justiceToolsEnabled, loadMemberCapabilities, veteranToolsEnabled } from '@/core/profile/member-capabilities';
import { loadHomePersonalization } from '@/core/profile/home-personalization';
import { loadMemberSummary } from '@/core/profile/member-summary';
import { nextSteps } from '@/core/profile/next-step';

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

function defaultStarters(justice: boolean, veteran: boolean): string[] {
  const out = [
    'Show me what I should do next.',
    'Find jobs that fit my experience.',
    'Find housing opportunities.',
    'I need somewhere to stay tonight.',
    'Help me write a cover letter.',
  ];
  if (justice) out.splice(2, 0, 'Help me understand my record relief options.');
  if (veteran) out.splice(justice ? 3 : 2, 0, 'What veteran benefits and jobs should I look at?');
  return out;
}

/** Up to six conversation starters — goals and next-step aware when signed in. */
export async function loadSignalSuggestions(): Promise<string[]> {
  try {
    const [personalization, summary, caps] = await Promise.all([
      loadHomePersonalization().catch(() => null),
      loadMemberSummary().catch(() => null),
      loadMemberCapabilities().catch(() => null),
    ]);
    const justice = justiceToolsEnabled(caps);
    const veteran = veteranToolsEnabled(caps);
    const out: string[] = [];
    const step = summary ? filterNextStepsForCapabilities(nextSteps(summary), caps)[0] ?? null : null;
    if (step?.title) out.push(`Help me with: ${step.title}`);
    for (const goal of personalization?.goals ?? []) {
      if (goal === 'Reentry' && !justice) continue;
      if (goal === 'Veteran transition' && !veteran) continue;
      const p = GOAL_PROMPTS[goal];
      if (p && !out.includes(p)) out.push(p);
      if (out.length >= 6) break;
    }
    if (out.length < 4) {
      for (const s of defaultStarters(justice, veteran)) {
        if (!out.includes(s)) out.push(s);
        if (out.length >= 6) break;
      }
    }
    if (out.length) return out.slice(0, 6);
  } catch {
    /* fall through */
  }
  return [...new Set([...defaultStarters(false, false), ...SUGGESTIONS.slice(0, 4)])].slice(0, 6);
}
