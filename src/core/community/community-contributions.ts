import { supabase } from '@/lib/supabase';
import { containsPrivateContributionText, sanitizeContributionPayload } from '@/core/community/contribution-validation.ts';

export type ContributionKind = 'resource_add' | 'resource_edit' | 'record_relief_source';
export type ContributionStatus = 'pending' | 'approved' | 'rejected' | 'needs_more_info';

export type CommunityContributionRow = {
  id: string;
  kind: ContributionKind;
  status: ContributionStatus;
  resource_id: string | null;
  jurisdiction_code: string | null;
  display_name: string | null;
  anonymous_public: boolean;
  payload: Record<string, unknown>;
  created_at: string;
};

function missingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return error.code === 'PGRST202' || msg.includes('does not exist') || msg.includes('could not find the function');
}

export async function communityContributionsBackendReady(): Promise<boolean> {
  const { data, error } = await supabase.rpc('community_contributions_backend_ready');
  if (missingRelation(error)) return false;
  if (error) throw error;
  return Boolean(data);
}

export function contributionActionMessage(e: unknown): string {
  const text =
    e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (text.includes('SIGNED_OUT')) return 'Sign in to submit a contribution.';
  if (text.includes('PRIVATE_INFO_REJECTED')) return 'Remove case numbers, court docket details, or other private record information.';
  if (text.includes('CONTRIBUTION_RATE_LIMIT')) return 'You have sent several suggestions today. Please try again tomorrow.';
  if (text.includes('FORBIDDEN')) return 'You do not have permission to do that.';
  return 'Something went wrong. Please try again.';
}

export async function submitCommunityContribution(input: {
  kind: ContributionKind;
  payload: Record<string, unknown>;
  resourceId?: string | null;
  jurisdictionCode?: string | null;
  displayName?: string | null;
  anonymous?: boolean;
}): Promise<CommunityContributionRow> {
  const payload = sanitizeContributionPayload(input.payload);
  const blob = JSON.stringify(payload);
  if (containsPrivateContributionText(blob)) {
    throw new Error('PRIVATE_INFO_REJECTED');
  }
  const { data, error } = await supabase.rpc('submit_community_contribution', {
    p_kind: input.kind,
    p_payload: payload,
    p_resource_id: input.resourceId ?? null,
    p_jurisdiction_code: input.jurisdictionCode ?? null,
    p_display_name: input.displayName?.trim() || null,
    p_anonymous: input.anonymous ?? true,
  });
  if (error) throw error;
  return data as CommunityContributionRow;
}

export async function adminListCommunityContributions(status: ContributionStatus = 'pending'): Promise<CommunityContributionRow[]> {
  const { data, error } = await supabase.rpc('admin_list_community_contributions', { p_status: status, p_limit: 50 });
  if (error) throw error;
  return (data ?? []) as CommunityContributionRow[];
}

export async function adminReviewCommunityContribution(
  id: string,
  status: Exclude<ContributionStatus, 'pending'>,
  reason?: string,
): Promise<CommunityContributionRow> {
  const { data, error } = await supabase.rpc('admin_review_community_contribution', {
    p_id: id,
    p_status: status,
    p_reason: reason?.trim() || null,
  });
  if (error) throw error;
  return data as CommunityContributionRow;
}
