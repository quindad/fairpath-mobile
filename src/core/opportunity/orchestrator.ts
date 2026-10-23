import { resourceSlugsForCommunityCategory } from '../community/categories.ts';
import { rankMarketplaceForNeed } from '../community/smart-help.ts';
import { loadMarketplace, type MarketplaceItem } from '../marketplace/marketplace-service.ts';
import { resolveResourceNeeds, searchResources, type ResourceSummary } from '../resources/resources-service.ts';
import { dedupeOpportunityResults } from './dedupe.ts';
import { interpretOpportunityQuery } from './intent-parser.ts';
import type { InterpretedOpportunity, OpportunityLocation, StructuredNeed } from './needs-model.ts';
import { rankOpportunityResults } from './ranking.ts';
import type { AvailabilityConfidence, OpportunityAction, OpportunityResult, OpportunitySearchOutcome, OpportunitySource } from './types.ts';
import { resolveGrowthDiscovery } from './v1-pathways.ts';

function resourceAvailability(r: ResourceSummary): AvailabilityConfidence {
  if (r.freshness === 'expired') return 'no_match';
  if (r.freshness === 'stale') return 'listed_unverified';
  if (r.eligibility_summary) return 'eligibility_unknown';
  if (r.nearest_location?.phone || r.official_source_url) return 'contact_required';
  return 'listed_unverified';
}

function resourceToResult(r: ResourceSummary, reason: string): OpportunityResult {
  const phone = r.nearest_location?.phone ?? null;
  const actions: OpportunityAction[] = [
    { kind: 'open_resource', label: 'View details', route: `/resource/${r.id}`, resourceId: r.id },
    { kind: 'save_resource', label: 'Save', route: `/resource/${r.id}`, resourceId: r.id },
  ];
  if (phone) actions.push({ kind: 'call', label: 'Call', phone });
  if (r.official_source_url) actions.push({ kind: 'open_website', label: 'Open website', url: r.official_source_url });
  return {
    dedupeKey: `resource:${r.id}`,
    source: 'resource',
    recordId: r.id,
    title: r.title,
    subtitle: r.organization.name,
    category: r.categories[0] ?? 'resource',
    availability: resourceAvailability(r),
    freshness: r.freshness,
    distanceMiles: r.distance_miles,
    reason,
    primaryAction: actions[0],
    secondaryActions: actions.slice(1),
  };
}

function marketplaceAvailability(item: MarketplaceItem): AvailabilityConfidence {
  return item.status === 'available' && item.moderation_status === 'approved' ? 'confirmed_active' : 'listed_unverified';
}

function marketplaceToResult(item: MarketplaceItem, source: 'marketplace' | 'food_rescue', reason: string): OpportunityResult {
  return {
    dedupeKey: `marketplace:${item.id}`,
    source,
    recordId: item.id,
    title: item.title,
    subtitle: `${item.city}, ${item.state}${item.pickup_area ? ` · ${item.pickup_area}` : ''}`,
    category: item.category.toLowerCase(),
    availability: marketplaceAvailability(item),
    freshness: item.best_by_note,
    distanceMiles: null,
    reason,
    primaryAction: { kind: 'open_marketplace_item', label: 'View listing', route: `/market-item/${item.id}`, itemId: item.id },
    secondaryActions: [
      { kind: 'claim_marketplace_item', label: 'Request item', route: `/market-item/${item.id}`, itemId: item.id },
    ],
  };
}

function growthRouteForNeed(need: StructuredNeed): OpportunityResult | null {
  const discovered = resolveGrowthDiscovery(String(need.category));
  if (discovered.route) {
    return {
      dedupeKey: `route:${discovered.route}:${need.category}`,
      source: 'route',
      recordId: discovered.route,
      title: need.label,
      subtitle: 'FairPath V1 pathway',
      category: String(need.category),
      availability: 'contact_required',
      freshness: null,
      distanceMiles: null,
      reason: `Matched your goal: ${need.label}`,
      primaryAction: { kind: 'open_route', label: 'Open', route: discovered.route },
      secondaryActions: [
        { kind: 'open_route', label: 'All pathways', route: '/grow' },
        { kind: 'add_to_plan', label: 'Add to My Path plan', route: '/my-path' },
      ],
    };
  }
  const legacy: Record<string, { route: string; title: string }> = {
    employment: { route: '/find-jobs', title: 'Find jobs on FairPath' },
    education: { route: '/opportunities', title: 'Education & scholarships' },
    entrepreneurship: { route: '/entrepreneurship', title: 'Startup Academy' },
    housing: { route: '/find-housing', title: 'Find housing' },
    record_relief: { route: '/record-relief', title: 'Record Relief checker' },
    financial: { route: '/credit', title: 'Credit Studio' },
    legal: { route: '/resources?q=legal%20help', title: 'Search legal & ID resources' },
  };
  const hit = legacy[String(need.category).trim().toLowerCase()] ?? null;
  if (!hit) return null;
  return {
    dedupeKey: `route:${hit.route}:${need.category}`,
    source: 'route',
    recordId: hit.route,
    title: hit.title,
    subtitle: 'FairPath V1 pathway',
    category: String(need.category),
    availability: 'contact_required',
    freshness: null,
    distanceMiles: null,
    reason: `Matched your goal: ${need.label}`,
    primaryAction: { kind: 'open_route', label: 'Open', route: hit.route },
    secondaryActions: [
      { kind: 'open_route', label: 'All pathways', route: '/grow' },
      { kind: 'add_to_plan', label: 'Add to My Path plan', route: '/my-path' },
    ],
  };
}

async function fetchResources(need: StructuredNeed, location: OpportunityLocation, query: string): Promise<ResourceSummary[]> {
  const slugs = new Set<string>();
  if (need.kind === 'essential') slugs.add(resourceSlugsForCommunityCategory(String(need.category))[0] ?? 'emergency_assistance');
  try {
    const resolved = await resolveResourceNeeds(query);
    for (const r of resolved) for (const c of r.category_slugs) slugs.add(c);
  } catch {
    /* guest-safe fallback */
  }
  const urgent = need.urgency === 'today';
  const batches = await Promise.all(
    [...slugs].slice(0, 3).map((category) =>
      searchResources({
        zip: location.zip ?? undefined,
        category,
        urgent,
        radiusMiles: location.zip ? 25 : 50,
        limit: 8,
      }).catch(() => ({ resources: [], total: 0, hasMore: false })),
    ),
  );
  return batches.flatMap((b) => b.resources);
}

async function fetchMarketplace(need: StructuredNeed, location: OpportunityLocation): Promise<{ regular: MarketplaceItem[]; rescue: MarketplaceItem[] }> {
  const loc = [location.city, location.state].filter(Boolean).join(', ') || location.zip || '';
  const food = String(need.category).includes('food') || need.category === 'groceries';
  const [regular, rescue] = await Promise.all([
    loadMarketplace({ location: loc, category: food ? 'Food' : undefined }).catch(() => []),
    food ? loadMarketplace({ location: loc, foodRescueOnly: true }).catch(() => []) : Promise.resolve([]),
  ]);
  const ranked = rankMarketplaceForNeed(String(need.category), regular, location.state);
  return { regular: ranked, rescue };
}

export async function searchOpportunities(input: {
  needs: StructuredNeed[];
  location: OpportunityLocation;
  rawQuery?: string;
}): Promise<OpportunitySearchOutcome> {
  const sourceErrors: Partial<Record<OpportunitySource, string>> = {};
  const results: OpportunityResult[] = [];
  const query = input.rawQuery?.trim() || input.needs.map((n) => n.label).join(' ');

  for (const need of input.needs) {
    if (need.kind === 'growth') {
      const route = growthRouteForNeed(need);
      if (route) results.push(route);
      const { resourceSlugs } = resolveGrowthDiscovery(String(need.category));
      if (resourceSlugs.length) {
        try {
          const batches = await Promise.all(
            resourceSlugs.slice(0, 3).map((category) =>
              searchResources({
                zip: input.location.zip ?? undefined,
                category,
                urgent: need.urgency === 'today',
                radiusMiles: input.location.zip ? 25 : 50,
                limit: 6,
              }).catch(() => ({ resources: [], total: 0, hasMore: false })),
            ),
          );
          for (const r of batches.flatMap((b) => b.resources)) {
            results.push(resourceToResult(r, `Program match for ${need.label}`));
          }
        } catch (e) {
          sourceErrors.resource = e instanceof Error ? e.message : 'Resource search failed';
        }
      }
    }
    if (need.kind === 'give') {
      results.push({
        dedupeKey: 'route:/marketplace-list-item',
        source: 'route',
        recordId: '/marketplace-list-item',
        title: 'List free items to give',
        subtitle: 'FairPath Marketplace',
        category: 'give',
        availability: 'contact_required',
        freshness: null,
        distanceMiles: null,
        reason: 'You said you want to give something away',
        primaryAction: { kind: 'open_route', label: 'List an item', route: '/marketplace-list-item' },
        secondaryActions: [{ kind: 'open_route', label: 'Browse requests', route: '/community/can-help' }],
      });
      continue;
    }

    let resources: ResourceSummary[] = [];
    try {
      resources = await fetchResources(need, input.location, query);
    } catch (e) {
      sourceErrors.resource = e instanceof Error ? e.message : 'Resource search failed';
    }
    for (const r of resources) {
      results.push(resourceToResult(r, `Resource match for ${need.label}`));
    }

    let regular: MarketplaceItem[] = [];
    let rescue: MarketplaceItem[] = [];
    try {
      const m = await fetchMarketplace(need, input.location);
      regular = m.regular;
      rescue = m.rescue;
    } catch (e) {
      sourceErrors.marketplace = e instanceof Error ? e.message : 'Marketplace search failed';
    }
    for (const item of regular.slice(0, 6)) {
      results.push(marketplaceToResult(item, 'marketplace', `Free item match for ${need.label}`));
    }
    for (const item of rescue.slice(0, 6)) {
      results.push(marketplaceToResult(item, 'food_rescue', `Food Rescue match for ${need.label}`));
    }

    if (need.constraints.noPersonalTransport) {
      const transportResources = await searchResources({
        zip: input.location.zip ?? undefined,
        category: 'transportation',
        urgent: need.urgency === 'today',
        limit: 5,
      }).catch(() => ({ resources: [] }));
      for (const r of transportResources.resources ?? []) {
        results.push(resourceToResult(r, 'Transportation may help with your mobility constraint'));
      }
    }
  }

  const deduped = dedupeOpportunityResults(results);
  const ranked = rankOpportunityResults(input.needs, deduped);

  const fallbacks: OpportunityAction[] = [
    { kind: 'post_community_request', label: 'Post a community request', route: '/community/need-help/new' },
    { kind: 'open_route', label: 'Search all resources', route: '/resources' },
    { kind: 'open_route', label: 'Browse free Marketplace', route: '/marketplace' },
  ];

  if (ranked.length === 0) {
    fallbacks.unshift({
      kind: 'post_community_request',
      label: 'Tell the community what you need',
      route: '/community/need-help/new',
    });
  }

  return {
    results: ranked.slice(0, 24),
    fallbacks,
    sourceErrors,
    interpretedSummary: input.needs.map((n) => n.label).join(' · '),
  };
}

export function interpretAndSearch(
  rawQuery: string,
  location: OpportunityLocation,
): Promise<{ interpretation: InterpretedOpportunity; outcome: OpportunitySearchOutcome }> {
  const interpretation = interpretOpportunityQuery(rawQuery, location);
  return searchOpportunities({ needs: interpretation.needs, location, rawQuery }).then((outcome) => ({
    interpretation,
    outcome,
  }));
}
