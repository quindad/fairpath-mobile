import { currentUser } from '@/core/supabase/current-user';
import { supabase } from '@/lib/supabase';

export type MarketStatus = 'full' | 'growing' | 'limited' | 'waitlist' | 'coming_soon';

export type MarketCoverage = {
  zip: string;
  marketCode: string | null;
  marketLabel: string | null;
  status: MarketStatus;
  statusNote: string | null;
  earlyAccessBenefitDays: number | null;
};

/** True when FairPath does not yet have enough verified opportunity inventory in this market — the case
 * that needs the Early Access experience instead of a plain "no results" empty state. */
export function isLowCoverage(status: MarketStatus): boolean {
  return status === 'waitlist' || status === 'coming_soon';
}

/** Server-determined coverage for a ZIP. Works for guests: FairPath never gates "do we even have this
 * market" behind sign-in. Throws on a malformed ZIP; callers should validate with isZip() first. */
export async function getMarketCoverage(zip: string): Promise<MarketCoverage> {
  const { data, error } = await supabase.rpc('get_market_coverage', { p_zip: zip });
  if (error) throw error;
  const c = data as { zip: string; market_code: string | null; market_label: string | null; status: MarketStatus; status_note: string | null; early_access_benefit_days: number | null };
  return { zip: c.zip, marketCode: c.market_code, marketLabel: c.market_label, status: c.status, statusNote: c.status_note, earlyAccessBenefitDays: c.early_access_benefit_days };
}

export type JoinEarlyAccessResult = { id: string; status: 'waitlisted' | 'notified' | 'converted'; alreadyEnrolled: boolean };

/** Signed-in only. Idempotent: joining twice for the same ZIP returns the existing enrollment. */
export async function joinEarlyAccess(zip: string, notificationConsent: boolean, referralSource?: string | null): Promise<JoinEarlyAccessResult> {
  await currentUser();
  const { data, error } = await supabase.rpc('join_early_access', { p_zip: zip, p_notification_consent: notificationConsent, p_referral_source: referralSource ?? null });
  if (error) throw error;
  const r = data as { id: string; status: 'waitlisted' | 'notified' | 'converted'; already_enrolled: boolean };
  return { id: r.id, status: r.status, alreadyEnrolled: r.already_enrolled };
}

export type EarlyAccessEnrollment = {
  id: string;
  zip: string;
  status: 'waitlisted' | 'notified' | 'converted';
  enrolledAt: string;
  convertedAt: string | null;
};

export async function myEarlyAccessEnrollments(): Promise<EarlyAccessEnrollment[]> {
  await currentUser();
  const { data, error } = await supabase.rpc('my_early_access_enrollments');
  if (error) throw error;
  return (data ?? []).map((r: { id: string; zip: string; status: 'waitlisted' | 'notified' | 'converted'; enrolled_at: string; converted_at: string | null }) => ({
    id: r.id, zip: r.zip, status: r.status, enrolledAt: r.enrolled_at, convertedAt: r.converted_at,
  }));
}
