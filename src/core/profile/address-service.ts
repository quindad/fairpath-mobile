import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';

export type AddressLabel = 'home' | 'mailing' | 'release' | 'business' | 'property' | 'prior' | 'other';
export type AddressVerificationState = 'self_reported' | 'user_confirmed' | 'needs_review' | 'verified';

export type Address = {
  id: string;
  label: AddressLabel;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  formatted: string | null;
  place_provider_id: string | null;
  source: string;
  verification_state: AddressVerificationState;
  created_at: string;
  updated_at: string;
};

const ADDRESS_COLUMNS = 'id,label,line1,line2,city,state,postal_code,country_code,start_date,end_date,is_current,formatted,place_provider_id,source,verification_state,created_at,updated_at';

export async function loadMyAddresses(): Promise<Address[]> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('addresses')
    .select(ADDRESS_COLUMNS)
    .eq('user_id', user.id)
    .order('is_current', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Address[];
}

/**
 * Returns the user's current 'home' address if one exists, else null.
 * This is the row the identity.address/identity.current_location
 * profile questions read from and write to during Step 1's dual-write.
 */
export async function loadCurrentHomeAddress(): Promise<Address | null> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('addresses')
    .select(ADDRESS_COLUMNS)
    .eq('user_id', user.id)
    .eq('label', 'home')
    .eq('is_current', true)
    .maybeSingle();
  if (error) throw error;
  return (data as Address | null) ?? null;
}

/**
 * Upserts the free-text current home address. Used by the dual-write
 * path in profile-service.ts when the user answers identity.address or
 * identity.current_location — the questionnaire only ever collects a
 * single free-text string today, so this writes into `formatted` and
 * leaves line1/city/state/postal_code for a future structured-address
 * UI to fill in. Fresh answers from a live user action are marked
 * self_reported, not needs_review (needs_review is reserved for
 * degraded backfilled data — Sterling decision #4).
 */
export async function upsertFreeTextHomeAddress(freeText: string): Promise<Address> {
  const user = await currentUser();
  const trimmed = freeText.trim();
  const existing = await loadCurrentHomeAddress();
  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await supabase
      .from('addresses')
      .update({ formatted: trimmed, verification_state: 'self_reported', updated_at: now })
      .eq('id', existing.id)
      .eq('user_id', user.id)
      .select(ADDRESS_COLUMNS)
      .single();
    if (error) throw error;
    return data as Address;
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: user.id,
      label: 'home',
      is_current: true,
      formatted: trimmed,
      source: 'user',
      verification_state: 'self_reported',
    })
    .select(ADDRESS_COLUMNS)
    .single();
  if (error) throw error;
  return data as Address;
}
