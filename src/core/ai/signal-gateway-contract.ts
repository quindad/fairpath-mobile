/**
 * Client contract for the unified FairPath AI Gateway (server-side orchestration).
 * Edge implementation reuses supabase/functions/_shared/core/ai-gateway/* for provider routing,
 * credits, and safety. Tool execution stays in typed FairPath services — never raw SQL from models.
 */
import type { IntentId } from '@/core/ai/intents.ts';

export type SignalGatewayToolId =
  | 'search_jobs'
  | 'search_housing'
  | 'search_resources'
  | 'my_path'
  | 'open_route'
  | 'record_relief_explain';

export type SignalGatewayToolCall = {
  toolId: SignalGatewayToolId;
  args: Record<string, unknown>;
  risk: 'read' | 'write';
};

export type SignalGatewayNavigationAction = {
  label: string;
  route: string;
  primary?: boolean;
};

export type SignalGatewayResponse = {
  intent: IntentId;
  assistantText: string;
  toolCalls: SignalGatewayToolCall[];
  actions: SignalGatewayNavigationAction[];
  citations: { label: string; url?: string; kind: string }[];
  creditsSpent: number;
  modelAssisted: boolean;
};

/** Validates in-app routes before navigation (no invented paths). */
export function isAllowedSignalRoute(route: string): boolean {
  return /^\/[a-z0-9][a-z0-9\-_/]*(\?[a-z0-9_\-=&%.]+)?$/i.test(route.trim());
}
