// FairPath AI gateway: provider-neutral routing, failover policy, and privacy-safe telemetry.
// Pure logic, no I/O. Provider SDK/HTTP details live behind adapters passed in by the caller.
//
// Business code asks for a WORKFLOW (what it is trying to do), never a provider. The chain is resolved from
// configuration (see config.ts). Failover happens only for transient infrastructure failures, never for
// authorization, entitlement, privacy, malformed input, unsafe requests, unsupported input, or malformed model
// output - repeating those to another vendor would re-send data or mask a bug.

import { estimateCostMicroUsd, type PriceTable } from './cost.ts';

export type ProviderId = 'openai' | 'anthropic' | 'google';
export type Capability = { document: boolean; image: boolean };

export const WORKFLOWS = {
  signal_daily_brief: 'signal_daily_brief',
  bottleneck_analysis: 'bottleneck_analysis',
  opportunity_intelligence: 'opportunity_intelligence',
  executive_brief: 'executive_brief',
  impact_summary: 'impact_summary',
  board_update: 'board_update',
  job_writer: 'job_writer',
  interview_kit: 'interview_kit',
  candidate_followup: 'candidate_followup',
  retention_intelligence: 'retention_intelligence',
  employer_trust_explainer: 'employer_trust_explainer',
  workforce_report: 'workforce_report',
  housing_listing_writer: 'housing_listing_writer',
  housing_queue_intelligence: 'housing_queue_intelligence',
  provider_followup: 'provider_followup',
  housing_outcomes: 'housing_outcomes',
  case_plan_goal_builder: 'case_plan_goal_builder',
  milestone_builder: 'milestone_builder',
  referral_intelligence: 'referral_intelligence',
  supervisor_brief: 'supervisor_brief',
  campaign_writer: 'campaign_writer',
  member_signal: 'member_signal',
  requisition_draft: 'requisition_draft',
  staffing_daily_brief: 'staffing_daily_brief',
  candidate_preparation: 'candidate_preparation',
  job_fit_explanation: 'job_fit_explanation',
  staffing_operations_summary: 'staffing_operations_summary',
  housing_criteria_explainer: 'housing_criteria_explainer',
  renter_preparation: 'renter_preparation',
  program_scout: 'program_scout',
  structured_extraction: 'structured_extraction',
  credit_report_extraction: 'credit_report_extraction',
  credit_report_explanation: 'credit_report_explanation',
  document_extraction: 'document_extraction',
  document_vision: 'document_vision',
  dispute_letter_draft: 'dispute_letter_draft',
  resume_bullet_draft: 'resume_bullet_draft',
  marketplace_listing_draft: 'marketplace_listing_draft',
} as const;
export type WorkflowId = (typeof WORKFLOWS)[keyof typeof WORKFLOWS];

export type Hop = { provider: ProviderId; model: string; sensitiveApproved: boolean };

/** Sensitive workflows are the only ones allowed to carry a document. Everything else is text-only. */
export const SENSITIVE_WORKFLOWS: ReadonlySet<WorkflowId> = new Set<WorkflowId>(['credit_report_extraction', 'credit_report_explanation', 'document_extraction', 'document_vision']);

export type DocumentPart = { mime: string; base64: string };
export type SchemaSpec = { name: string; parameters: Record<string, unknown> };
export type AdapterInput = { system?: string; user?: string; document?: DocumentPart; schema?: SchemaSpec; maxTokens?: number };

export type ProviderFailure =
  | { kind: 'http'; status: number }
  | { kind: 'timeout' }
  | { kind: 'network' }
  | { kind: 'authorization' }
  | { kind: 'entitlement' }
  | { kind: 'privacy_restriction' }
  | { kind: 'unsafe_request' }
  | { kind: 'malformed_input' }
  | { kind: 'unsupported_input' }
  | { kind: 'malformed_output' };

export function classifyError(e: ProviderFailure): 'transient' | 'permanent' {
  if (e.kind === 'timeout' || e.kind === 'network') return 'transient';
  if (e.kind === 'http') return e.status === 429 || e.status >= 500 ? 'transient' : 'permanent';
  return 'permanent';
}

export function decideNext(args: { error: ProviderFailure; remainingHops: number }): 'fallback' | 'fail' {
  if (classifyError(args.error) === 'permanent') return 'fail';
  return args.remainingHops > 0 ? 'fallback' : 'fail';
}

export type AdapterResult = { text: string; structured?: unknown; inputTokens: number; outputTokens: number };
export type Adapter = (req: { model: string; input: AdapterInput }) => Promise<AdapterResult>;

export type TelemetryEvent = {
  workflow: WorkflowId; provider: ProviderId; model: string; latencyMs: number;
  outcome: 'ok' | 'transient_failure' | 'permanent_failure' | 'skipped';
  fallback: boolean; inputTokens?: number; outputTokens?: number;
  /** Short, fixed code only (never free text). */
  reason?: 'circuit_open' | 'no_adapter' | 'malformed_output' | 'capability_missing';
  costMicroUsd?: number;
};

export type RunResult =
  | { ok: true; text: string; structured?: unknown; provider: ProviderId; model: string; fallbackUsed: boolean }
  | { ok: false; reason: 'exhausted' | 'permanent_failure' };

export async function runWorkflow(args: {
  workflow: WorkflowId; input: AdapterInput; adapters: Partial<Record<ProviderId, Adapter>>; record: (e: TelemetryEvent) => void;
  /** The resolved chain (from config). Sensitive workflows must only ever be given sensitive-approved hops. */
  chainOverride: Hop[];
  /** Optional provider-health tracker. When omitted, every provider in the chain is attempted. */
  health?: { tracker: HealthLike; now: () => number };
  /** What each provider can actually accept. A provider without a capability is skipped, never sent the input. */
  capabilities?: Partial<Record<ProviderId, Capability>>;
  /** Optional price table (micro-USD per million tokens). Unknown models record no cost. */
  prices?: PriceTable;
}): Promise<RunResult> {
  const chain = args.chainOverride.filter((h) => !SENSITIVE_WORKFLOWS.has(args.workflow) || h.sensitiveApproved);
  const needs = args.input.document ? (args.input.document.mime.startsWith('image/') ? 'image' : 'document') : null;
  let fallbackUsed = false;
  for (let i = 0; i < chain.length; i++) {
    const hop = chain[i];
    const adapter = args.adapters[hop.provider];
    const now = args.health?.now() ?? 0;
    if (needs && !(args.capabilities?.[hop.provider]?.[needs])) {
      args.record({ workflow: args.workflow, provider: hop.provider, model: hop.model, latencyMs: 0, outcome: 'skipped', fallback: fallbackUsed, reason: 'capability_missing' });
      continue;
    }
    if (args.health && !args.health.tracker.isAvailable(hop.provider, now)) {
      args.record({ workflow: args.workflow, provider: hop.provider, model: hop.model, latencyMs: 0, outcome: 'skipped', fallback: fallbackUsed, reason: 'circuit_open' });
      continue;
    }
    if (!adapter) {
      args.record({ workflow: args.workflow, provider: hop.provider, model: hop.model, latencyMs: 0, outcome: 'skipped', fallback: fallbackUsed, reason: 'no_adapter' });
      continue;
    }
    const started = Date.now();
    try {
      const res = await adapter({ model: hop.model, input: args.input });
      args.health?.tracker.recordOutcome(hop.provider, 'success', now);
      const costMicroUsd = args.prices ? estimateCostMicroUsd({ model: hop.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens }, args.prices) ?? undefined : undefined;
      args.record({ workflow: args.workflow, provider: hop.provider, model: hop.model, latencyMs: Date.now() - started, outcome: 'ok', fallback: fallbackUsed, inputTokens: res.inputTokens, outputTokens: res.outputTokens, costMicroUsd });
      return { ok: true, text: res.text, structured: res.structured, provider: hop.provider, model: hop.model, fallbackUsed };
    } catch (raw) {
      const failure = raw as ProviderFailure;
      const transient = classifyError(failure) === 'transient';
      args.health?.tracker.recordOutcome(hop.provider, transient ? 'transient' : failure.kind === 'malformed_output' ? 'malformed' : 'permanent', now);
      args.record({ workflow: args.workflow, provider: hop.provider, model: hop.model, latencyMs: Date.now() - started, outcome: transient ? 'transient_failure' : 'permanent_failure', fallback: fallbackUsed });
      if (decideNext({ error: failure, remainingHops: chain.length - 1 - i }) === 'fail') {
        return { ok: false, reason: transient ? 'exhausted' : 'permanent_failure' };
      }
      fallbackUsed = true;
    }
  }
  return { ok: false, reason: 'exhausted' };
}

const TELEMETRY_KEYS = ['provider', 'model', 'latencyMs', 'outcome', 'inputTokens', 'outputTokens', 'workflow', 'fallback', 'reason', 'costMicroUsd'] as const;

/** Structural type so the runner never imports a concrete tracker. */
export type HealthLike = {
  isAvailable(provider: ProviderId, now: number): boolean;
  recordOutcome(provider: ProviderId, outcome: 'success' | 'transient' | 'permanent' | 'malformed', now: number): void;
};
/** Telemetry is an allow-list of non-content fields. Anything else (prompts, documents, responses) is dropped. */
export function redactForTelemetry(e: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of TELEMETRY_KEYS) if (k in e && (e[k] === null || ['string', 'number', 'boolean'].includes(typeof e[k]))) out[k] = e[k];
  return out;
}
