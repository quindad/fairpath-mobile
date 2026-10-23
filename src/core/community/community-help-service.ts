import { supabase } from '@/lib/supabase';
import type { CommunityHelpCategoryId, CommunityHelpUrgency } from '@/core/community/categories';

export type CommunityHelpRequestRow = {
  id: string;
  category: string;
  description: string;
  household_size: number | null;
  urgency: string;
  city: string;
  state: string;
  postal_code: string | null;
  pickup_ok: boolean;
  delivery_preferred: boolean;
  status: string;
  expires_at: string;
  created_at: string;
  is_owner?: boolean;
};

export type CommunityHelpBoardRow = {
  id: string;
  category: string;
  description: string;
  urgency: string;
  city: string;
  state: string;
  pickup_ok: boolean;
  expires_at: string;
  created_at: string;
};

export type CommunityHelpOfferRow = {
  id: string;
  request_id: string;
  helper_id: string;
  marketplace_item_id: string | null;
  note: string | null;
  status: string;
  created_at: string;
};

function missingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return error.code === 'PGRST202' || msg.includes('does not exist') || msg.includes('could not find the function');
}

/** True when shared DEV has the community help migration applied. */
export async function communityHelpBackendReady(): Promise<boolean> {
  const { error } = await supabase.rpc('list_my_community_help_requests');
  return !missingRelation(error);
}

export async function createCommunityHelpRequest(input: {
  category: CommunityHelpCategoryId;
  description: string;
  householdSize?: number | null;
  urgency: CommunityHelpUrgency;
  city: string;
  state: string;
  postalCode?: string;
  pickupOk: boolean;
  deliveryPreferred: boolean;
  expiresAt: string;
}): Promise<CommunityHelpRequestRow> {
  const { data, error } = await supabase.rpc('member_create_community_help_request', {
    p_category: input.category,
    p_description: input.description.trim(),
    p_household_size: input.householdSize ?? null,
    p_urgency: input.urgency,
    p_city: input.city.trim(),
    p_state: input.state.trim().toUpperCase(),
    p_postal_code: input.postalCode?.trim() || null,
    p_pickup_ok: input.pickupOk,
    p_delivery_preferred: input.deliveryPreferred,
    p_expires_at: input.expiresAt,
  });
  if (error) throw error;
  return data as CommunityHelpRequestRow;
}

export async function loadMyCommunityHelpRequests(): Promise<CommunityHelpRequestRow[]> {
  const { data, error } = await supabase.rpc('list_my_community_help_requests');
  if (missingRelation(error)) return [];
  if (error) throw error;
  return (data ?? []) as CommunityHelpRequestRow[];
}

export async function loadCommunityHelpBoard(state?: string, category?: string): Promise<CommunityHelpBoardRow[]> {
  const { data, error } = await supabase.rpc('list_open_community_help_board', {
    p_state: state?.trim().toUpperCase() || null,
    p_category: category || null,
  });
  if (missingRelation(error)) return [];
  if (error) throw error;
  return (data ?? []) as CommunityHelpBoardRow[];
}

export async function getCommunityHelpRequest(id: string): Promise<CommunityHelpRequestRow | null> {
  const { data, error } = await supabase.rpc('member_get_community_help_request', { p_request_id: id });
  if (missingRelation(error)) return null;
  if (error) {
    if ((error.message ?? '').includes('NOT_FOUND')) return null;
    throw error;
  }
  const rows = (data ?? []) as CommunityHelpRequestRow[];
  return rows[0] ?? null;
}

export async function cancelCommunityHelpRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc('member_cancel_community_help_request', { p_request_id: id });
  if (error) throw error;
}

export async function fulfillCommunityHelpRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc('member_fulfill_community_help_request', { p_request_id: id });
  if (error) throw error;
}

export async function offerCommunityHelp(requestId: string, note?: string, marketplaceItemId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('member_offer_community_help', {
    p_request_id: requestId,
    p_note: note?.trim() || null,
    p_marketplace_item_id: marketplaceItemId ?? null,
  });
  if (error) throw error;
}

export async function respondCommunityHelpOffer(offerId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('member_respond_community_help_offer', {
    p_offer_id: offerId,
    p_accept: accept,
  });
  if (error) throw error;
}

/** Owner-only read of offers via RLS select (helpers see their own offers). */
export async function loadOffersForRequest(requestId: string): Promise<CommunityHelpOfferRow[]> {
  const { data, error } = await supabase
    .from('community_help_offers')
    .select('id,request_id,helper_id,marketplace_item_id,note,status,created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });
  if (missingRelation(error)) return [];
  if (error) throw error;
  return (data ?? []) as CommunityHelpOfferRow[];
}
