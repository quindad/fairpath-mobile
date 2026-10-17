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

/** Record document acceptance via the authenticated RPC; preserve other append-only events. */
export async function recordConsent(
  eventType: ConsentEventType,
  input: { documentVersion?: string; granted?: boolean; metadata?: Record<string, unknown> } = {},
) {
  const user = await currentUser();
  if (eventType === 'terms_accepted' || eventType === 'privacy_accepted') {
    const { error } = await supabase.rpc('record_document_consent', {
      p_event_type: eventType,
      p_document_version: input.documentVersion ?? (eventType === 'terms_accepted' ? CURRENT_TERMS_VERSION : CURRENT_PRIVACY_VERSION),
      p_granted: input.granted ?? true,
    });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('consent_events').insert({
    user_id: user.id,
    event_type: eventType,
    document_version: input.documentVersion ?? null,
    granted: input.granted ?? true,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

/** Convenience: records both terms and privacy acceptance for the sign-up checkbox. */
export async function recordSignUpConsent() {
  await recordConsent('terms_accepted', { documentVersion: CURRENT_TERMS_VERSION });
  await recordConsent('privacy_accepted', { documentVersion: CURRENT_PRIVACY_VERSION });
}

export { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION };
