import type { IntentId } from '../ai/intents.ts';
import { SIGNAL_WRITE_TOOLS, type SignalToolDefinition } from './signal-tool-registry.ts';

export const MAX_READ_TOOL_STEPS = 3;

export type SignalToolStep = { toolId: string; risk: 'read' | 'write' };

export function planReadToolsForIntent(intent: IntentId): SignalToolStep[] {
  switch (intent) {
    case 'find_jobs':
      return [{ toolId: 'search_jobs', risk: 'read' }];
    case 'find_housing':
      return [{ toolId: 'search_housing', risk: 'read' }];
    case 'find_resources':
      return [{ toolId: 'search_resources', risk: 'read' }];
    case 'next_steps':
      return [{ toolId: 'my_path', risk: 'read' }];
    case 'help':
      return [{ toolId: 'pathways', risk: 'read' }];
    default:
      return [];
  }
}

function addStep(steps: SignalToolStep[], toolId: string) {
  if (!steps.some((s) => s.toolId === toolId)) steps.push({ toolId, risk: 'read' });
}

/** Multi-need planning from natural language (e.g. jobs + transportation). */
export function planReadToolsForQuestion(question: string, intent: IntentId): SignalToolStep[] {
  const t = (question ?? '').toLowerCase();
  const steps: SignalToolStep[] = [];

  const wantsJobs = intent === 'find_jobs' || /\b(job|jobs|work|employ|hire|career)\b/.test(t);
  const wantsHousing = intent === 'find_housing' || /\b(hous|rent|apartment|shelter)\b/.test(t);
  const wantsResources =
    intent === 'find_resources' ||
    /\b(food|grocer|transport|transportation|ride|bus pass|childcare|daycare|benefit|utility|legal help|veteran resource)\b/.test(t);

  if (wantsJobs) addStep(steps, 'search_jobs');
  if (wantsHousing) addStep(steps, 'search_housing');
  if (wantsResources) addStep(steps, 'search_resources');
  if (intent === 'next_steps') addStep(steps, 'my_path');
  if (!steps.length) {
    for (const s of planReadToolsForIntent(intent)) addStep(steps, s.toolId);
  }
  if (!steps.length && intent === 'help') addStep(steps, 'pathways');

  return steps.slice(0, MAX_READ_TOOL_STEPS);
}

export function toolQueryForStep(toolId: string, question: string): string {
  const t = question.trim();
  if (toolId === 'search_jobs') {
    return t.replace(/\band\b[^.]*?(transport|transportation|ride|bus)[^.]*/gi, '').trim() || t;
  }
  if (toolId === 'search_resources') {
    if (/\b(transport|transportation|ride|bus pass|no car)\b/i.test(t)) return 'transportation assistance';
    if (/\b(childcare|daycare)\b/i.test(t)) return 'childcare';
    if (/\b(food|grocer|hungry)\b/i.test(t)) return 'food assistance';
    if (/\b(veteran)\b/i.test(t)) return 'veteran benefits';
  }
  return t;
}

const WRITE_PATTERNS: { toolId: string; patterns: RegExp[] }[] = [
  { toolId: 'submit_job_application', patterns: [/\b(submit|send)\b.*\b(job )?application\b/i] },
  { toolId: 'submit_housing_application', patterns: [/\b(submit|send)\b.*\bhousing\b.*\bapplication\b/i] },
  { toolId: 'marketplace_claim', patterns: [/\b(claim|reserve)\b.*\bmarketplace\b/i, /\bclaim\b.*\b(item|listing)\b/i] },
  { toolId: 'community_request', patterns: [/\b(post|publish|submit)\b.*\b(community|exchange)\b.*\b(request|need)\b/i] },
];

export function detectWriteToolRequest(text: string): SignalToolDefinition | null {
  const t = (text ?? '').trim();
  if (!t) return null;
  for (const row of WRITE_PATTERNS) {
    if (row.patterns.some((p) => p.test(t))) {
      return SIGNAL_WRITE_TOOLS.find((w) => w.id === row.toolId) ?? null;
    }
  }
  return null;
}

export function loadingMessageForPhase(phase: 'routing' | 'tools' | 'enrich' | null, toolId?: string): string {
  if (phase === 'routing') return 'Routing your question…';
  if (phase === 'enrich') return 'Checking Signal guidance…';
  if (phase === 'tools' && toolId === 'search_jobs') return 'Searching live job listings…';
  if (phase === 'tools' && toolId === 'search_housing') return 'Searching housing listings…';
  if (phase === 'tools' && toolId === 'search_resources') return 'Searching verified resources…';
  if (phase === 'tools') return 'Loading your FairPath data…';
  return 'Signal is thinking…';
}
