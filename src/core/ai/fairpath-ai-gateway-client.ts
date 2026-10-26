import { supabase } from '@/lib/supabase';
import type { IntentId } from '@/core/ai/intents.ts';

export type FairpathGatewayRouteResponse = {
  authenticated: boolean;
  intent: IntentId;
  tools: string[];
  routes: { label: string; route: string }[];
  location: { zip: string | null; radiusMiles: number | null };
  modelAssisted: false;
};

function missingFunction(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? '').toLowerCase();
  return msg.includes('not found') || msg.includes('404');
}

/** Server-side orchestration metadata (no credit spend). Falls back to null when Edge is not deployed. */
export async function fetchFairpathGatewayPlan(message: string): Promise<FairpathGatewayRouteResponse | null> {
  const { data, error } = await supabase.functions.invoke('fairpath-ai-gateway', { body: { message: message.trim() } });
  if (error && missingFunction(error)) return null;
  if (error) return null;
  if (!data || typeof data !== 'object') return null;
  return data as FairpathGatewayRouteResponse;
}
