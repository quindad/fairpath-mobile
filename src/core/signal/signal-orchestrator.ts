/**
 * Client-side Signal tool orchestration: deterministic intent routing first, then capped read-only tool calls.
 * Write tools never execute here — UI must confirm and route to the owning workflow.
 */
import type { AiGateway, AiResponse, AiResultCard, AnswerPart, Provenance } from '../ai/orchestrator.ts';
import { loadMemberSearchLocation } from '../location/member-search-location.ts';
import { searchHousing } from '../housing/housing-service.ts';
import { searchJobs } from '../jobs/jobs-service.ts';
import { searchResources } from '../resources/resources-service.ts';
import { nextSteps } from '../profile/next-step.ts';
import { V1_PATHWAYS } from '../opportunity/v1-pathways.ts';
import { sanitizeToolQuery } from './signal-prompt-guard.ts';
import {
  MAX_READ_TOOL_STEPS,
  planReadToolsForQuestion,
  toolQueryForStep,
  type SignalToolStep,
} from './signal-tool-plan.ts';
import { actionsFromSourceRefs, mergeResponseActions } from './signal-result-actions.ts';
import {
  nearMeRequiresZip,
  resourceNeedHints,
  resourceSearchRpcParams,
  shouldKeepResourceResult,
} from './signal-resource-relevance.ts';

export {
  MAX_READ_TOOL_STEPS,
  detectWriteToolRequest,
  loadingMessageForPhase,
  planReadToolsForIntent,
  planReadToolsForQuestion,
  toolQueryForStep,
  type SignalToolStep,
} from './signal-tool-plan.ts';

export type SignalLoadingPhase = 'routing' | 'tools' | 'enrich' | null;

export type ReadToolResult = { parts: AnswerPart[]; extraRefs: Provenance['sourceRefs']; cards?: AiResultCard[] };

async function executeReadTool(
  toolId: string,
  question: string,
  gw: AiGateway,
  signal?: AbortSignal,
): Promise<ReadToolResult | null> {
  if (signal?.aborted) return null;
  const q = sanitizeToolQuery(toolQueryForStep(toolId, question));
  const loc = await loadMemberSearchLocation(question);

  switch (toolId) {
    case 'search_jobs': {
      const r = await searchJobs({
        query: q,
        limit: 3,
        secondChance: true,
        zip: loc.zip,
        radiusMiles: loc.radiusMiles,
      });
      if (signal?.aborted) return null;
      if (!r.jobs.length) {
        const locHint = loc.zip
          ? ` (searched near ZIP ${loc.zip}, ${loc.radiusMiles} mi)`
          : ' — add a ZIP in location settings or allow location for nearby results';
        return {
          parts: [{ text: `No published jobs matched that search right now${locHint}. Open job search to adjust filters.`, basis: 'app_state' }],
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
        cards: r.jobs.slice(0, 3).map((j) => {
          const place = j.city && j.state ? `${j.city}, ${j.state}` : j.location_text ?? 'See listing';
          return {
            kind: 'job' as const,
            recordId: j.id,
            title: j.title,
            subtitle: j.company_name,
            route: `/job/${j.id}`,
            detail: place,
          };
        }),
      };
    }
    case 'search_housing': {
      const r = await searchHousing({ query: q, limit: 3, zip: loc.zip, radiusMiles: loc.radiusMiles });
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
        cards: r.homes.slice(0, 3).map((h) => ({
          kind: 'housing' as const,
          recordId: h.id,
          title: h.title,
          subtitle: h.city && h.state ? `${h.city}, ${h.state}` : 'See listing',
          route: `/housing/${h.id}`,
          detail: h.rent_monthly ? `$${h.rent_monthly}/mo` : undefined,
        })),
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
    case 'search_resources': {
      if (nearMeRequiresZip(question, loc.zip)) {
        return {
          parts: [
            {
              text: 'To search near you, set a ZIP in location settings or allow device location — Signal will not guess with unrelated nationwide listings.',
              basis: 'app_state',
            },
          ],
          extraRefs: [{ kind: 'summary', id: 'resources_need_zip' }],
        };
      }
      const rpcParams = resourceSearchRpcParams(question, loc.zip);
      const r = await searchResources({
        query: rpcParams.query ?? q,
        zip: loc.zip ?? undefined,
        radiusMiles: loc.radiusMiles,
        category: rpcParams.category,
        includeNational: rpcParams.includeNational,
        limit: 8,
        urgent: /\b(today|tonight|emergency|urgent)\b/i.test(question),
      });
      if (signal?.aborted) return null;
      const resources = r.resources.filter((row) => shouldKeepResourceResult(row.title, row.categories, question));
      if (!resources.length) {
        const locHint = loc.zip ? ` near ZIP ${loc.zip}` : ' — try a ZIP or allow location';
        const hints = resourceNeedHints(question);
        const scope =
          hints.wantsTransport && hints.wantsJobs
            ? 'transportation or job-access programs'
            : hints.wantsTransport
              ? 'transportation programs'
              : 'verified resources';
        return {
          parts: [{ text: `No ${scope} matched${locHint}. Open Resource Center to search manually.`, basis: 'app_state' }],
          extraRefs: [{ kind: 'summary', id: 'resources_search_empty' }],
        };
      }
      const lines = resources.map((row) => {
        const place = row.nearest_location
          ? [row.nearest_location.city, row.nearest_location.state_code].filter(Boolean).join(', ')
          : row.is_national
            ? 'Nationwide'
            : 'See listing';
        const dist = row.distance_miles != null ? ` · ${row.distance_miles.toFixed(1)} mi` : '';
        return `• ${row.title} (${place}${dist})`;
      });
      const locLine = loc.zip ? `Near ZIP ${loc.zip}, ${loc.radiusMiles} mi — verified FairPath listings only.` : 'Verified FairPath listings (add ZIP for distance sorting).';
      return {
        parts: [
          { text: locLine, basis: 'app_state' },
          { text: lines.join('\n'), basis: 'app_state' },
        ],
        extraRefs: resources.slice(0, 5).map((row) => ({ kind: 'summary' as const, id: `resource:${row.id}` })),
        cards: resources.slice(0, 3).map((row) => {
          const place = row.nearest_location
            ? [row.nearest_location.city, row.nearest_location.state_code].filter(Boolean).join(', ')
            : row.is_national
              ? 'Nationwide'
              : 'See listing';
          const dist = row.distance_miles != null ? `${row.distance_miles.toFixed(1)} mi` : undefined;
          return {
            kind: 'resource' as const,
            recordId: row.id,
            title: row.title,
            subtitle: row.organization.name,
            route: `/resource/${row.id}`,
            detail: [place, dist].filter(Boolean).join(' · '),
          };
        }),
      };
    }
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
  const plan = planReadToolsForQuestion(question, response.intent).slice(0, MAX_READ_TOOL_STEPS);
  if (!plan.length) return { response, phase: null };

  const mergedParts: AnswerPart[] = [...response.parts];
  const refs: Provenance['sourceRefs'] = [...response.provenance.sourceRefs];
  const cards: AiResultCard[] = [...(response.resultCards ?? [])];
  let lastTool: string | undefined;

  for (const step of plan) {
    if (step.risk !== 'read') continue;
    lastTool = step.toolId;
    const out = await executeReadTool(step.toolId, question, gw, signal);
    if (!out) break;
    mergedParts.push(...out.parts);
    refs.push(...out.extraRefs);
    if (out.cards?.length) cards.push(...out.cards);
  }

  const toolActions = actionsFromSourceRefs(refs);
  const seenCardRoutes = new Set<string>();
  const dedupedCards = cards.filter((c) => {
    if (c.kind === 'resource' && !shouldKeepResourceResult(c.title, [], question)) return false;
    if (seenCardRoutes.has(c.route)) return false;
    seenCardRoutes.add(c.route);
    return true;
  });
  return {
    response: {
      ...response,
      parts: mergedParts,
      resultCards: dedupedCards.slice(0, 6),
      actions: mergeResponseActions(response.actions, toolActions),
      provenance: {
        ...response.provenance,
        engine: 'deterministic_router',
        sourceRefs: refs.slice(0, 40),
      },
    },
    phase: lastTool ? 'tools' : null,
  };
}
