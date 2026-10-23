import type { StructuredNeed } from './needs-model.ts';
import type { OpportunityResult } from './types.ts';

const availabilityWeight: Record<OpportunityResult['availability'], number> = {
  confirmed_active: 5,
  contact_required: 4,
  listed_unverified: 3,
  eligibility_unknown: 2,
  pending_backend: 1,
  no_match: 0,
};

function urgencyBoost(need: StructuredNeed): number {
  if (need.urgency === 'today') return 3;
  if (need.urgency === 'this_week') return 2;
  return 1;
}

function transportFit(need: StructuredNeed, row: OpportunityResult): number {
  if (!need.constraints.noPersonalTransport) return 0;
  if (row.source === 'resource' && row.subtitle?.toLowerCase().includes('phone')) return 2;
  if (row.source === 'resource' && row.subtitle?.toLowerCase().includes('online')) return 2;
  if (row.source === 'marketplace' || row.source === 'food_rescue') return -2;
  if (row.source === 'resource' && row.category === 'transportation') return 3;
  return 0;
}

function categoryFit(need: StructuredNeed, row: OpportunityResult): number {
  const c = String(need.category);
  if (row.category === c) return 3;
  if (c.includes('food') && (row.source === 'food_rescue' || row.category === 'food')) return 2;
  return 0;
}

export function rankOpportunityResults(needs: StructuredNeed[], rows: OpportunityResult[]): OpportunityResult[] {
  const need = needs[0];
  return [...rows]
    .map((row) => {
      let score = availabilityWeight[row.availability] ?? 0;
      if (need) {
        score += urgencyBoost(need) * (row.availability === 'confirmed_active' ? 1.5 : 1);
        score += categoryFit(need, row);
        score += transportFit(need, row);
      }
      if (row.freshness === 'stale') score -= 2;
      if (row.distanceMiles != null && row.distanceMiles <= 10) score += 1;
      return { row, score };
    })
    .sort((a, b) => b.score - a.score || a.row.title.localeCompare(b.row.title))
    .map((x) => x.row);
}
