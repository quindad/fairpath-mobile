import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export type MemberGateReason = 'apply' | 'save' | 'message' | 'member_feature';

const REASON_COPY: Record<MemberGateReason, string> = {
  apply: 'Applying or inquiring requires a FairPath member account so employers and housing partners know who they are hearing from.',
  save: 'Saving listings and searches is part of your member workspace.',
  message: 'Messaging and requests require a signed-in member account.',
  member_feature: 'This feature is part of your personal FairPath workspace.',
};

/** Returns true when a signed-in user is present; otherwise routes to Join with returnTo preserved. */
export async function requireMemberAccess(returnTo: string, reason: MemberGateReason = 'member_feature'): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  if (data.user) return true;
  const q = new URLSearchParams({ returnTo, reason });
  router.push((`/join?${q.toString()}`) as never);
  return false;
}

export function memberGateMessage(reason: MemberGateReason): string {
  return REASON_COPY[reason];
}
