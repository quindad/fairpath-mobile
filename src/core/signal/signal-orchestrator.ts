/**
 * Client-side Signal tool orchestration: deterministic intent routing first, then capped read-only tool calls.
 * Write tools never execute here — UI must confirm and route to the owning workflow.
 */
import type { AiGateway, AiResponse, AnswerPart, Provenance } from '../ai/orchestrator.ts';
import { searchHousing } from '../housing/housing-service.ts';
import { searchJobs } from '../jobs/jobs-service.ts';
import { nextSteps } from '../profile/next-step.ts';
import { V1_PATHWAYS } from '../opportunity/v1-pathways.ts';
import { sanitizeToolQuery } from './signal-prompt-guard.ts';
import {
  MAX_READ_TOOL_STEPS,
  planReadToolsForIntent,
  type SignalToolStep,
} from './signal-tool-plan.ts';

export {
  MAX_READ_TOOL_STEPS,
  detectWriteToolRequest,
  loadingMessageForPhase,
  planReadToolsForIntent,
  type SignalToolStep,
} from './signal-tool-plan.ts';

export type SignalLoadingPhase = 'routing' | 'tools' | 'enrich' | null;

export type ReadToolResult = { parts: AnswerPart[]; extraRefs: Provenance['sourceRefs'] };

async function executeReadTool(
  toolId: string,
  question: string,
  gw: AiGateway,
  signal?: AbortSignal,
): Promise<ReadToolResult | null> {
  if (signal?.aborted) return null;
  const q = sanitizeToolQuery(question);

  switch (toolId) {
    case 'search_jobs': {
      const r = await searchJobs({ query: q, limit: 3, secondChance: true });
      if (signal?.aborted) return null;
      if (!r.jobs.length) {
        return {
          parts: [{ text: 'No published jobs matched that search right now. Open job search to adjust filters or location.', basis: 'app_state' }],
          extraRefs: [{ kind: 'summary', id: 'jobs_search_empty' }],
        };
      }
      const lines = r.jobs.map((j) => {
        const place = j.city && j.state ? `${j.city}, ${j.state}` : j.location_text ?? 'Location on listing';
        return `• ${j.title} at ${j.company_name} (${place})`;
      });
      return {
        parts: [
          {
            text: `Live results (${Math.min(r.jobs.length, r.total)} shown of ${r.total}):`,
            basis: 'app_state',
          },
          { text: lines.join('\n'), basis: 'app_state' },
        ],
        extraRefs: r.jobs.slice(0, 3).map((j) => ({ kind: 'summary' as const, id: `job:${j.id}` })),
      };
    }
    case 'search_housing': {
      const r = await searchHousing({ query: q, limit: 3 });
      if (signal?.aborted) return null;
      if (!r.homes.length) {
        return {
          parts: [{ text: 'No housing listings matched that search. Open housing search to change ZIP, rent, or filters.', basis: 'app_state' }],
          extraRefs: [{ kind: 'summary', id: 'housing_search_empty' }],
        };
      }
      const lines = r.homes.map((h) => {
        const rent = h.rent_monthly ? `$${h.rent_monthly}/mo` : 'Rent on listing';
        return `• ${h.title} — ${h.city}, ${h.state} (${rent})`;
      });
      return {
        parts: [
          { text: `Live listings (${Math.min(r.homes.length, r.total)} of ${r.total}):`, basis: 'app_state' },
          { text: lines.join('\n'), basis: 'app_state' },
        ],
        extraRefs: r.homes.slice(0, 3).map((h) => ({ kind: 'summary' as const, id: `housing:${h.id}` })),
      };
    }
    case 'my_path': {
      if (!(await gw.signedIn())) {
        return {
          parts: [{ text: 'Sign in to see personalized next steps from your FairPath summary.', basis: 'app_state' }],
          extraRefs: [],
        };
      }
      const summary = await gw.summary();
      if (signal?.aborted) return null;
      const steps = nextSteps(summary).slice(0, 3);
      if (!steps.length) {
        return {
          parts: [{ text: 'Your summary has no urgent next steps right now. Explore pathways or add a goal on My Path.', basis: 'app_state' }],
          extraRefs: [{ kind: 'summary', id: 'member' }],
        };
      }
      return {
        parts: [
          { text: 'From your member summary (same rules as My Path):', basis: 'app_state' },
          { text: steps.map((s) => `• ${s.title}: ${s.body}`).join('\n'), basis: 'app_state' },
        ],
        extraRefs: [{ kind: 'summary', id: 'member' }],
      };
    }
    case 'pathways': {
      const sample = V1_PATHWAYS.slice(0, 4).map((p) => `• ${p.title}: ${p.subtitle}`).join('\n');
      return {
        parts: [
          { text: 'Ten guided opportunity pathways (V1):', basis: 'app_state' },
          { text: sample, basis: 'app_state' },
          { text: 'Open Grow to browse all pathways; each links to real routes and verified resources only.', basis: 'rule' },
        ],
        extraRefs: [{ kind: 'summary', id: 'v1_pathways' }],
      };
    }
    case 'search_resources':
      return {
        parts: [{ text: 'Use Search resources below for verified services. Signal does not invent providers.', basis: 'rule' }],
        extraRefs: [],
      };
    default:
      return null;
  }
}

export async function enrichWithReadTools(
  response: AiResponse,
  question: string,
  gw: AiGateway,
  signal?: AbortSignal,
): Promise<{ response: AiResponse; phase: SignalLoadingPhase }> {
  const plan = planReadToolsForIntent(response.intent).slice(0, MAX_READ_TOOL_STEPS);
  if (!plan.length) return { response, phase: null };

  const mergedParts: AnswerPart[] = [...response.parts];
  const refs: Provenance['sourceRefs'] = [...response.provenance.sourceRefs];
  let lastTool: string | undefined;

  for (const step of plan) {
    if (step.risk !== 'read') continue;
    lastTool = step.toolId;
    const out = await executeReadTool(step.toolId, question, gw, signal);
    if (!out) break;
    mergedParts.push(...out.parts);
    refs.push(...out.extraRefs);
  }

  return {
    response: {
      ...response,
      parts: mergedParts,
      provenance: {
        ...response.provenance,
        engine: 'deterministic_router',
        sourceRefs: refs.slice(0, 40),
      },
    },
    phase: lastTool ? 'tools' : null,
  };
}
