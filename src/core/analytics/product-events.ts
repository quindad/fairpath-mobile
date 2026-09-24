import { supabase } from '@/lib/supabase';

/**
 * Shared product-analytics writer used by both the Jobs and Housing
 * services. Client-inserted, so treat as UX-instrumentation, not an
 * audit trail.
 */
export async function trackProductEvent(
  eventName: string,
  surface: string,
  entityId?: string | null,
  properties: Record<string, unknown> = {},
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('product_events').insert({
    user_id: user?.id ?? null,
    event_name: eventName,
    surface,
    entity_id: entityId ?? null,
    properties,
  });
  if (error) throw error;
}
