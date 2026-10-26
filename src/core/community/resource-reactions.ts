import type { ResourceReactionSummary } from '@/core/community/reaction-aggregates.ts';
import { supabase } from '@/lib/supabase';

import type { ResourceReactionKind } from '@/core/community/reaction-aggregates.ts';

export const RESOURCE_REACTIONS: { id: ResourceReactionKind; emoji: string; label: string }[] = [
  { id: 'helpful', emoji: '👍', label: 'Helpful' },
  { id: 'worked', emoji: '❤️', label: 'Worked for me' },
  { id: 'not_helpful', emoji: '👎', label: 'Not helpful' },
  { id: 'broken_link', emoji: '🔗', label: 'Broken link' },
  { id: 'outdated', emoji: '⚠️', label: 'Outdated information' },
];

export type { ResourceReactionKind, ResourceReactionSummary } from '@/core/community/reaction-aggregates.ts';
export { formatReactionAggregateLine } from '@/core/community/reaction-aggregates.ts';

const SENSITIVE_CATEGORY_SLUGS = new Set(['emergency_help', 'health_wellness']);

export function resourceCategoriesAreSensitive(categorySlugs: string[]): boolean {
  return categorySlugs.some((s) => SENSITIVE_CATEGORY_SLUGS.has(s));
}

function missingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return error.code === 'PGRST202' || msg.includes('does not exist') || msg.includes('could not find the function');
}

export async function resourceReactionsBackendReady(): Promise<boolean> {
  const { error } = await supabase.rpc('get_resource_reaction_summary', { p_resource_id: '00000000-0000-0000-0000-000000000000' });
  return !missingRelation(error);
}

export async function loadResourceReactionSummary(resourceId: string): Promise<ResourceReactionSummary | null> {
  const { data, error } = await supabase.rpc('get_resource_reaction_summary', { p_resource_id: resourceId });
  if (missingRelation(error)) return null;
  if (error) throw error;
  return (data ?? { available: false }) as ResourceReactionSummary;
}

export function reactionActionMessage(e: unknown): string {
  const text =
    e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (text.includes('SIGNED_OUT')) return 'Sign in to react.';
  if (text.includes('REACTION_RATE_LIMIT')) return 'You have shared a lot of feedback today. Try again tomorrow.';
  if (text.includes('RESOURCE_UNAVAILABLE')) return 'This resource is not available for feedback.';
  return 'Something went wrong. Please try again.';
}

export async function setResourceReaction(
  resourceId: string,
  reaction: ResourceReactionKind,
  anonymous = true,
): Promise<ResourceReactionSummary> {
  const { data, error } = await supabase.rpc('set_resource_reaction', {
    p_resource_id: resourceId,
    p_reaction: reaction,
    p_anonymous: anonymous,
  });
  if (error) throw error;
  return data as ResourceReactionSummary;
}

export async function clearResourceReaction(resourceId: string): Promise<ResourceReactionSummary> {
  const { data, error } = await supabase.rpc('clear_resource_reaction', { p_resource_id: resourceId });
  if (error) throw error;
  return data as ResourceReactionSummary;
}
