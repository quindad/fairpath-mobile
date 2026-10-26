import type { InterpretedOpportunity, StructuredNeed } from './needs-model.ts';
import { resolveGrowthDiscovery } from './v1-pathways.ts';

export type PlannedNeedStep = {
  needLabel: string;
  route: string;
  actionLabel: string;
  urgency: StructuredNeed['urgency'];
  kind: StructuredNeed['kind'];
};

const URGENCY_RANK: Record<StructuredNeed['urgency'], number> = {
  today: 0,
  this_week: 1,
  flexible: 2,
};

function routeForNeed(need: StructuredNeed, rawQuery: string): PlannedNeedStep {
  if (need.kind === 'give') {
    return {
      needLabel: need.label,
      route: '/community/need-help',
      actionLabel: 'Post or manage a request',
      urgency: need.urgency,
      kind: need.kind,
    };
  }

  if (need.kind === 'growth') {
    const discovered = resolveGrowthDiscovery(String(need.category));
    const route = discovered.route ?? `/community/help-now?q=${encodeURIComponent(need.label)}`;
    return {
      needLabel: need.label,
      route,
      actionLabel: discovered.route ? 'Open FairPath pathway' : 'Search Help now',
      urgency: need.urgency,
      kind: need.kind,
    };
  }

  const q = encodeURIComponent(need.label || rawQuery.slice(0, 80));
  return {
    needLabel: need.label,
    route: `/community/help-now?q=${q}`,
    actionLabel: 'Search Help now',
    urgency: need.urgency,
    kind: need.kind,
  };
}

/** Deterministic ordered steps from a parsed multi-need sentence — no AI. */
export function planStepsFromInterpretation(interp: InterpretedOpportunity): PlannedNeedStep[] {
  const seen = new Set<string>();
  const steps: PlannedNeedStep[] = [];
  for (const need of interp.needs) {
    const step = routeForNeed(need, interp.rawQuery);
    const key = `${step.route}|${step.needLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push(step);
  }
  steps.sort((a, b) => {
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (u !== 0) return u;
    if (a.kind === 'essential' && b.kind !== 'essential') return -1;
    if (b.kind === 'essential' && a.kind !== 'essential') return 1;
    return a.needLabel.localeCompare(b.needLabel);
  });
  return steps;
}
