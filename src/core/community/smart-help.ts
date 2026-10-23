import { marketplaceCategoriesForNeed, resourceSlugsForCommunityCategory } from './categories.ts';
import type { MarketplaceItem } from '../marketplace/marketplace-service.ts';

export type CommunityMatchHints = {
  resourceCategories: string[];
  marketplaceCategories: string[];
};

export function matchHintsForCategory(category: string): CommunityMatchHints {
  return {
    resourceCategories: resourceSlugsForCommunityCategory(category),
    marketplaceCategories: marketplaceCategoriesForNeed(category),
  };
}

/** Client-side relevance ranking for open marketplace rows (no justice or profile signals). */
export function rankMarketplaceForNeed(category: string, items: MarketplaceItem[], state?: string | null): MarketplaceItem[] {
  const cats = new Set(marketplaceCategoriesForNeed(category));
  const st = state?.trim().toUpperCase();
  return [...items]
    .map((item) => {
      let score = 0;
      if (cats.size === 0 || cats.has(item.category)) score += 3;
      if (category.startsWith('food') && item.is_food_rescue) score += 2;
      if (st && item.state?.toUpperCase() === st) score += 1;
      if (item.safe_pickup) score += 1;
      return { item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.item.created_at) - Date.parse(a.item.created_at))
    .map((x) => x.item);
}
