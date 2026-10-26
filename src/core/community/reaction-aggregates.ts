export type ResourceReactionKind = 'helpful' | 'worked' | 'not_helpful' | 'broken_link' | 'outdated';

export type ResourceReactionSummary = {
  available: boolean;
  sensitive?: boolean;
  counts_suppressed?: boolean;
  total?: number | null;
  counts?: Partial<Record<ResourceReactionKind, number>> | null;
  my_reaction?: ResourceReactionKind | null;
  my_anonymous?: boolean;
};

/** Public-facing aggregate line — never exposes individual reactors. */
export function formatReactionAggregateLine(summary: ResourceReactionSummary): string {
  if (!summary.available) return '';
  if (summary.counts_suppressed) {
    return 'Community feedback helps keep listings accurate. Counts stay hidden on sensitive resources until enough responses exist.';
  }
  const c = summary.counts;
  if (!c) return 'Community feedback helps keep listings accurate.';
  const parts: string[] = [];
  if (c.helpful) parts.push(`${c.helpful} helpful`);
  if (c.worked) parts.push(`${c.worked} worked`);
  if (c.not_helpful) parts.push(`${c.not_helpful} not helpful`);
  if (c.broken_link) parts.push(`${c.broken_link} broken link`);
  if (c.outdated) parts.push(`${c.outdated} outdated`);
  if (!parts.length) return 'Be the first to share feedback on this resource.';
  return parts.join(' · ');
}
