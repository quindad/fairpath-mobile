import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dedupeOpportunityResults } from '../src/core/opportunity/dedupe.ts';
import { rankOpportunityResults } from '../src/core/opportunity/ranking.ts';
import type { StructuredNeed } from '../src/core/opportunity/needs-model.ts';
import type { OpportunityResult } from '../src/core/opportunity/types.ts';

const need: StructuredNeed = {
  localId: '1',
  kind: 'essential',
  category: 'groceries',
  label: 'Groceries',
  urgency: 'today',
  constraints: { noPersonalTransport: true },
};

describe('opportunity orchestrator helpers', () => {
  it('dedupes identical resource keys keeping stronger availability', () => {
    const rows: OpportunityResult[] = [
      { dedupeKey: 'resource:a', source: 'resource', recordId: 'a', title: 'A', subtitle: null, category: 'food', availability: 'listed_unverified', freshness: null, distanceMiles: null, reason: 'x', primaryAction: { kind: 'open_resource', label: 'View', route: '/resource/a' }, secondaryActions: [] },
      { dedupeKey: 'resource:a', source: 'resource', recordId: 'a', title: 'A', subtitle: null, category: 'food', availability: 'contact_required', freshness: null, distanceMiles: null, reason: 'y', primaryAction: { kind: 'open_resource', label: 'View', route: '/resource/a' }, secondaryActions: [] },
    ];
    const out = dedupeOpportunityResults(rows);
    assert.equal(out.length, 1);
    assert.equal(out[0].availability, 'contact_required');
  });

  it('deprioritizes marketplace when member lacks transportation', () => {
    const rows: OpportunityResult[] = [
      { dedupeKey: 'marketplace:1', source: 'marketplace', recordId: '1', title: 'Food box', subtitle: 'Pickup', category: 'food', availability: 'confirmed_active', freshness: null, distanceMiles: null, reason: 'm', primaryAction: { kind: 'open_marketplace_item', label: 'View', route: '/market-item/1' }, secondaryActions: [] },
      { dedupeKey: 'resource:2', source: 'resource', recordId: '2', title: 'Transit help', subtitle: 'By phone', category: 'transportation', availability: 'contact_required', freshness: 'fresh', distanceMiles: 2, reason: 't', primaryAction: { kind: 'open_resource', label: 'View', route: '/resource/2' }, secondaryActions: [] },
    ];
    const ranked = rankOpportunityResults([need], rows);
    assert.equal(ranked[0].source, 'resource');
  });
});
