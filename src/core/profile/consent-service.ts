import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';

export type ConsentEventType =
  | 'terms_accepted'
  | 'privacy_accepted'
  | 'justice_history_disclosure_consent'
  | 'program_screening_consent'
  | 'marketing_opt_in'
  | 'marketing_opt_out'
  | 'data_deletion_requested'
  | 'other';

const CURRENT_TERMS_VERSION = 'v1';
const CURRENT_PRIVACY_VERSION = 'v1';

/**
 * Records a consent event in the append-only consent_events ledger and,
 * for terms/privacy specifically, also updates the denormalized
 * "current state" pointer columns on profiles so a fast check doesn't
 * need to query the ledger. Insert-only by design (see migration
 * 20260924_0008_consent_events.sql) — there is no update/delete here.
 */
export async function recordConsent(
  eventType: ConsentEventType,
  input: { documentVersion?: string; granted?: boolean; metadata?: Record<string, unknown> } = {},
) {
  const user = await currentUser();
  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from('consent_events').insert({
    user_id: user.id,
    event_type: eventType,
    document_version: input.documentVersion ?? null,
    granted: input.granted ?? true,
    metadata: input.metadata ?? {},
  });
  if (insertError) throw insertError;

  if (eventType === 'terms_accepted') {
    const { error } = await supabase
      .from('profiles')
      .update({ terms_accepted_version: input.documentVersion ?? CURRENT_TERMS_VERSION, terms_accepted_at: now })
      .eq('id', user.id);
    if (error) throw error;
  }
  if (eventType === 'privacy_accepted') {
    const { error } = await supabase
      .from('profiles')
      .update({ privacy_accepted_version: input.documentVersion ?? CURRENT_PRIVACY_VERSION, privacy_accepted_at: now })
      .eq('id', user.id);
    if (error) throw error;
  }
}

/** Convenience: records both terms and privacy acceptance for the sign-up checkbox. */
export async function recordSignUpConsent() {
  await recordConsent('terms_accepted', { documentVersion: CURRENT_TERMS_VERSION });
  await recordConsent('privacy_accepted', { documentVersion: CURRENT_PRIVACY_VERSION });
}

export { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION };
