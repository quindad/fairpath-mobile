import { supabase } from '@/lib/supabase';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/core/profile/consent-service';

export type ConsentProfileSlice = {
  terms_accepted_at?: string | null;
  terms_accepted_version?: string | null;
  privacy_accepted_at?: string | null;
  privacy_accepted_version?: string | null;
};

export function profileHasCurrentDocumentConsent(profile: ConsentProfileSlice | null | undefined): boolean {
  return Boolean(
    profile?.terms_accepted_at &&
      profile?.privacy_accepted_at &&
      profile.terms_accepted_version === CURRENT_TERMS_VERSION &&
      profile.privacy_accepted_version === CURRENT_PRIVACY_VERSION,
  );
}

async function ledgerHasCurrentDocumentConsent(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('consent_events')
    .select('event_type, document_version, granted')
    .eq('user_id', userId)
    .in('event_type', ['terms_accepted', 'privacy_accepted']);
  if (error || !data?.length) return false;
  const has = (eventType: 'terms_accepted' | 'privacy_accepted', version: string) =>
    data.some((row) => row.event_type === eventType && row.granted !== false && row.document_version === version);
  return has('terms_accepted', CURRENT_TERMS_VERSION) && has('privacy_accepted', CURRENT_PRIVACY_VERSION);
}

/** Profile pointers first; if missing, trust the append-only ledger and backfill profiles. */
export async function hasCurrentDocumentConsent(
  userId: string,
  profile?: ConsentProfileSlice | null,
): Promise<boolean> {
  if (profileHasCurrentDocumentConsent(profile)) return true;
  if (!(await ledgerHasCurrentDocumentConsent(userId))) return false;
  const now = new Date().toISOString();
  await supabase
    .from('profiles')
    .update({
      terms_accepted_at: now,
      terms_accepted_version: CURRENT_TERMS_VERSION,
      privacy_accepted_at: now,
      privacy_accepted_version: CURRENT_PRIVACY_VERSION,
    })
    .eq('id', userId);
  return true;
}
