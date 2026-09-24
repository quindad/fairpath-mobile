import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';

export type LocationSettings = {
  zip_code: string | null;
  search_radius_miles: number;
};

export const DEFAULT_SEARCH_RADIUS_MILES = 25;

/**
 * Reads/writes profiles.zip_code / search_radius_miles / location_captured_at
 * (supabase/migrations/20260924_0003_profiles_identity_location_consent.sql).
 *
 * This is the progressive-onboarding location capture (Sterling decision
 * #7): never required at account creation. Enforcing "location required
 * before location-based Jobs/Housing search" is Step 2/3 work (the
 * shared search RPC) and is not implemented here — this module only
 * makes the data capturable and readable.
 */
export async function loadLocationSettings(): Promise<LocationSettings> {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('zip_code,search_radius_miles')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return {
    zip_code: (data?.zip_code as string | null) ?? null,
    search_radius_miles: (data?.search_radius_miles as number | undefined) ?? DEFAULT_SEARCH_RADIUS_MILES,
  };
}

export async function saveLocationSettings(input: { zipCode: string; radiusMiles: number }): Promise<void> {
  const user = await currentUser();
  const { error } = await supabase
    .from('profiles')
    .update({
      zip_code: input.zipCode.trim(),
      search_radius_miles: input.radiusMiles,
      location_captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);
  if (error) throw error;
}
