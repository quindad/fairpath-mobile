// Shared runner used by every member-facing Signal Edge Function. One place that does the three things EVERY
// AI feature in this app must do, in order: spend a real credit (spend_ai_credits), run the gateway with a
// real adapter if a provider key is configured (otherwise no adapter at all, so it falls through honestly),
// and run the safety guard on whatever comes back. Callers only build the prompt and the adapter.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { json } from '../../http.ts';
import { runWorkflow, redactForTelemetry, type Adapter, type Capability, type Hop, type AdapterInput, type WorkflowId, type RunResult, type TelemetryEvent } from './gateway.ts';
import { WORKFLOW_SPECS } from './specs.ts';
import { guardOutput, fallbackTextFor } from './policy.ts';
import { edgeProviderHealth } from './provider-health.ts';
import { signalWorkflowTimeoutMs } from './provider-http.ts';
import { requireEnv } from '../../http.ts';

async function runWorkflowWithTimeout(args: Parameters<typeof runWorkflow>[0]): Promise<RunResult> {
  const ms = signalWorkflowTimeoutMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<RunResult>((resolve, reject) => {
    timer = setTimeout(() => reject({ kind: 'timeout' }), ms);
    runWorkflow(args).then(resolve, reject);
  });
  try {
    return await bound;
  } catch (e) {
    const failure = e as { kind?: string };
    if (failure.kind === 'timeout') return { ok: false, reason: 'exhausted' };
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type SignalCallArgs = {
  userClient: SupabaseClient;
  workflow: WorkflowId;
  cost: number;
  input: AdapterInput;
  /** Built by the caller from whatever provider env vars it has access to. Omit/empty to force the honest no-key fallback. */
  chain: Hop[];
  adapters: Partial<Record<Hop['provider'], Adapter>>;
  capabilities?: Partial<Record<Hop['provider'], Capability>>;
};

/** Returns a ready-to-send Response. Every Signal Edge Function should end with `return await runSignalCall(...)`. */
export async function runSignalCall(args: SignalCallArgs): Promise<Response> {
  const spec = WORKFLOW_SPECS[args.workflow];

  const { data: authData, error: authError } = await args.userClient.auth.getUser();
  if (authError || !authData?.user) {
    return json(401, { error: 'unauthorized' });
  }

  const { data: spend, error: spendError } = await args.userClient.rpc('spend_ai_credits', { p_workflow: args.workflow, p_cost: args.cost });
  if (spendError) {
    const reason = spendError.message || 'SPEND_FAILED';
    const status =
      reason.includes('permission denied') ? 401
        : reason.includes('SIGNED_OUT') ? 401
        : reason.includes('INSUFFICIENT_CREDITS') ? 402
        : reason.includes('GLOBAL_SPEND_LIMIT_TRIPPED') ? 503
        : 400;
    return json(status, { error: 'credit_spend_failed', reason });
  }
  const balance = (spend as { balance?: number } | null)?.balance ?? null;

  const telemetry: TelemetryEvent[] = [];
  const result = await runWorkflowWithTimeout({
    workflow: args.workflow,
    input: args.input,
    adapters: args.adapters,
    chainOverride: args.chain,
    capabilities: args.capabilities,
    health: { tracker: edgeProviderHealth, now: () => Date.now() },
    record: (e) => telemetry.push(e),
  });
  if (requireEnv('SIGNAL_TELEMETRY_LOG') === '1') {
    for (const e of telemetry) console.log(JSON.stringify(redactForTelemetry(e as unknown as Record<string, unknown>)));
  }

  if (!result.ok) return json(200, { text: fallbackTextFor(spec.kind), modelAssisted: false, balance });

  const guard = guardOutput(result.text);
  const text = guard.ok ? result.text : fallbackTextFor(spec.kind);
  return json(200, { text, modelAssisted: guard.ok, balance });
}

/** A single Anthropic Messages adapter, reused by every Signal workflow that isn't sensitive-document work. */
export function anthropicTextAdapter(apiKey: string): Adapter {
  return async ({ model, input }) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 600, system: input.system, messages: [{ role: 'user', content: input.user ?? '' }] }),
    });
    if (!res.ok) throw { kind: 'http', status: res.status };
    const out = await res.json() as { content?: { type: string; text?: string }[]; usage?: { input_tokens: number; output_tokens: number } };
    const text = out.content?.find((c) => c.type === 'text')?.text ?? '';
    if (!text) throw { kind: 'malformed_output' };
    return { text, inputTokens: out.usage?.input_tokens ?? 0, outputTokens: out.usage?.output_tokens ?? 0 };
  };
}

/** Builds the standard single-hop Anthropic chain, or an empty chain (honest fallback) when no key is set.
 * `sensitiveApproved` must be true for any workflow in SENSITIVE_WORKFLOWS (gateway.ts) -- the gateway drops
 * every hop that isn't approved for a sensitive workflow, even when no document is attached. */
export function anthropicChain(apiKey: string | null, model: string, sensitiveApproved = false): { chain: Hop[]; adapters: Partial<Record<Hop['provider'], Adapter>> } {
  if (!apiKey) return { chain: [], adapters: {} };
  return { chain: [{ provider: 'anthropic', model, sensitiveApproved }], adapters: { anthropic: anthropicTextAdapter(apiKey) } };
}
