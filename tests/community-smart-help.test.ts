import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { marketplaceCategoriesForNeed, resourceSlugsForCommunityCategory } from '../src/core/community/categories.ts';
import { rankMarketplaceForNeed } from '../src/core/community/smart-help.ts';
import { validateFoodListingText } from '../src/core/community/food-listing-rules.ts';

describe('community smart help', () => {
  it('maps groceries to food resources and marketplace Food category', () => {
    assert.deepEqual(resourceSlugsForCommunityCategory('groceries'), ['food']);
    assert.deepEqual(marketplaceCategoriesForNeed('groceries'), ['Food']);
  });

  it('ranks in-state food rescue listings higher', () => {
    const items = [
      { id: '1', category: 'Furniture', city: 'A', state: 'OH', is_food_rescue: false, safe_pickup: true, created_at: '2026-01-01T00:00:00Z' },
      { id: '2', category: 'Food', city: 'B', state: 'OH', is_food_rescue: true, safe_pickup: true, created_at: '2026-01-02T00:00:00Z' },
    ] as never[];
    const ranked = rankMarketplaceForNeed('groceries', items, 'OH');
    assert.equal(ranked[0]?.id, '2');
  });

  it('blocks homemade meal language in food listings', () => {
    const r = validateFoodListingText('Extra dinner', 'Homemade lasagna leftovers from tonight');
    assert.equal(r.ok, false);
  });
});
