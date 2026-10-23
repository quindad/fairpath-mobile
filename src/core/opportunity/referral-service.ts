import { supabase } from '@/lib/supabase';

export type MemberReferralRow = {
  id: string;
  resource_id: string;
  organization_id: string;
  status: string;
  member_note: string | null;
  created_at: string;
};

function missingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return error.code === 'PGRST202' || msg.includes('does not exist') || msg.includes('could not find the function');
}

export async function memberReferralBackendReady(): Promise<boolean> {
  const { error } = await supabase.rpc('list_my_resource_referral_requests');
  return !missingRelation(error);
}

export async function submitResourceReferralRequest(resourceId: string, note?: string): Promise<MemberReferralRow> {
  const { data, error } = await supabase.rpc('member_submit_resource_referral_request', {
    p_resource_id: resourceId,
    p_member_note: note?.trim() || null,
  });
  if (error) throw error;
  return data as MemberReferralRow;
}

export async function loadMyResourceReferralRequests(): Promise<MemberReferralRow[]> {
  const { data, error } = await supabase.rpc('list_my_resource_referral_requests');
  if (missingRelation(error)) return [];
  if (error) throw error;
  return (data ?? []) as MemberReferralRow[];
}
