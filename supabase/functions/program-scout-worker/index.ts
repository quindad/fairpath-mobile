// Edge Function entry for program-scout-worker. Retrieval always runs when invoked; AI extraction is DISABLED
// unless PROGRAM_SCOUT_EXTRACTION_ENABLED=true AND ANTHROPIC_API_KEY are set (same discipline as
// extract-credit-report - nothing is sent to a model provider by default).
// Auth: shared secret header, same pattern as claim-correctional-transition (service-to-service call, not a
// user session) - cron/manual invocation only, never a public endpoint.
// Deploy (DEV only): npx supabase functions deploy program-scout-worker --project-ref znvhmuhojvwvjzmaqwff
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv, timingSafeEqual } from '../_shared/http.ts';
import { EXTRACTION_INSTRUCTIONS, EXTRACTION_TOOL_SCHEMA } from '../_shared/core/program-scout/extraction.ts';
import { handleRun, type SourceRow, type WorkerDeps } from './handler.ts';

const CADENCE_HOURS: Record<string, number> = { daily: 24, weekly: 24 * 7, monthly: 24 * 30, manual_only: 24 * 365 * 10 };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const secret = requireEnv('PROGRAM_SCOUT_INTEGRATION_SECRET');
  if (!secret) return json(501, { error: 'not_configured', detail: 'PROGRAM_SCOUT_INTEGRATION_SECRET is not set for this environment.' });
  if (!timingSafeEqual(req.headers.get('x-fairpath-integration-secret'), secret)) return json(401, { error: 'unauthorized' });

  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'server_misconfigured' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('PROGRAM_SCOUT_EXTRACTION_MODEL') ?? 'claude-sonnet-5';

  let sourceIds: string[] = [];
  try {
    const body = await req.text();
    if (body) {
      const parsed = JSON.parse(body) as { source_id?: unknown; source_ids?: unknown };
      if (typeof parsed.source_id === 'string') sourceIds = [parsed.source_id];
      else if (Array.isArray(parsed.source_ids)) sourceIds = parsed.source_ids.filter((x): x is string => typeof x === 'string');
    }
  } catch { return json(400, { error: 'invalid_json' }); }

  const deps: WorkerDeps = {
    extractionEnabled: () => requireEnv('PROGRAM_SCOUT_EXTRACTION_ENABLED') === 'true' && Boolean(apiKey),
    async loadSource(sourceId) {
      const { data } = await admin.from('program_sources').select('id,official_url,crawl_strategy,fixture_content,active,name,check_cadence,last_content_hash,failure_count,fixture_extraction').eq('id', sourceId).maybeSingle();
      return (data as SourceRow) ?? null;
    },
    async selectDueSources(limit) {
      const { data } = await admin.from('program_sources').select('id').eq('active', true).or('next_check_at.is.null,next_check_at.lte.' + new Date().toISOString()).order('next_check_at', { ascending: true, nullsFirst: true }).limit(limit);
      return (data ?? []).map((r) => r.id as string);
    },
    async recordRetrievalRun(sourceId, r) {
      const { data, error } = await admin.from('program_source_retrieval_runs').insert({
        source_id: sourceId, completed_at: new Date().toISOString(), status: r.status, http_status: r.httpStatus ?? null,
        content_hash: r.contentHash ?? null, retrieved_summary: r.summary ?? null, error_message: r.error ?? null,
      }).select('id').single();
      if (error) throw new Error('retrieval_run_insert_failed');
      return data.id as string;
    },
    async updateSourceAfterRun(sourceId, patch) {
      const now = new Date().toISOString();
      const update: Record<string, unknown> = { last_checked_at: now, next_check_at: patch.nextCheckAt, source_health: patch.healthy ? 'healthy' : 'degraded' };
      if (patch.healthy) { update.last_successful_retrieval_at = now; update.failure_count = 0; if (patch.contentHash) update.last_content_hash = patch.contentHash; }
      else { const { data } = await admin.from('program_sources').select('failure_count').eq('id', sourceId).maybeSingle(); update.failure_count = ((data?.failure_count as number) ?? 0) + 1; if (update.failure_count as number >= 3) update.source_health = 'failing'; }
      const { error } = await admin.from('program_sources').update(update).eq('id', sourceId);
      if (error) throw new Error('source_update_failed: ' + error.message);
    },
    async recordChangeEvent(sourceId, oldHash, newHash) {
      // Find the most recently promoted program/candidate tied to this source so the review item points somewhere useful.
      const { data: candidate } = await admin.from('program_candidates').select('id,promoted_program_id').eq('source_id', sourceId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { error } = await admin.from('program_change_events').insert({
        source_id: sourceId, program_id: candidate?.promoted_program_id ?? null, candidate_id: candidate?.id ?? null,
        change_type: 'new_document_version', old_value: { content_hash: oldHash }, new_value: { content_hash: newHash },
      });
      if (error) throw new Error('change_event_insert_failed: ' + error.message);
      if (candidate?.id) {
        const { error: queueError } = await admin.from('program_scout_review_queue').insert({ item_type: 'change_event', reference_id: candidate.id, reason: 'Source content changed since last retrieval - re-verification required before relying on the existing candidate/program.', priority: 'high' });
        if (queueError) throw new Error('review_queue_insert_failed: ' + queueError.message);
      }
      // Never silently preserve stale money claims - if this source already backs a promoted, live program,
      // mark every member/employer-facing match relying on it as stale so it can be flagged for re-verification.
      if (candidate?.promoted_program_id) {
        const { error: staleError } = await admin.rpc('program_scout_mark_matches_stale', { p_program_id: candidate.promoted_program_id, p_reason: 'source content changed since last retrieval' });
        if (staleError) throw new Error('mark_stale_failed: ' + staleError.message);
      }
    },
    async runExtraction(text) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey ?? '', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model, max_tokens: 2000, system: EXTRACTION_INSTRUCTIONS,
          tools: [{ name: 'record_candidate', description: 'Record the extracted program candidate facts.', input_schema: EXTRACTION_TOOL_SCHEMA }],
          tool_choice: { type: 'tool', name: 'record_candidate' },
          messages: [{ role: 'user', content: `Source text:\n\n${text}` }],
        }),
      });
      if (!res.ok) throw new Error('engine_http');
      const out = await res.json() as { content?: { type: string; input?: unknown }[] };
      return out.content?.find((c) => c.type === 'tool_use')?.input ?? null;
    },
    async insertCandidate(input) {
      const { data, error } = await admin.from('program_candidates').insert({
        source_id: input.sourceId, retrieval_run_id: input.retrievalRunId, lifecycle_status: 'extracted',
        program_name: input.program_name ?? null, program_domain: input.program_domain ?? null, program_subtype: input.program_subtype ?? null,
        administering_authority: input.administering_authority ?? null, jurisdiction_level: input.jurisdiction_level ?? null,
        jurisdiction_state: input.jurisdiction_state ?? null, target_recipient: input.target_recipient ?? null,
        benefit_type: input.benefit_type ?? null, benefit_amount: input.benefit_amount ?? null, benefit_minimum: input.benefit_minimum ?? null,
        benefit_maximum: input.benefit_maximum ?? null, benefit_percentage: input.benefit_percentage ?? null,
        effective_date: input.effective_date ?? null, expiration_date: input.expiration_date ?? null,
        application_period: input.application_period ?? null, funding_limited: input.funding_limited ?? false,
        eligibility_criteria: input.eligibility_criteria ?? null, required_documentation: input.required_documentation ?? null,
        application_process: input.application_process ?? null, source_section: input.source_section ?? null,
        extracted_at: new Date().toISOString(), extraction_confidence: input.confidence ?? null, extraction_method: 'ai_assisted',
        extraction_notes: input.uncertain_fields.length ? `Model-reported uncertain fields: ${input.uncertain_fields.join(', ')}` : null,
      }).select('id').single();
      if (error) throw new Error('candidate_insert_failed: ' + error.message);
      return data.id as string;
    },
    async evaluateCandidate(candidateId) {
      const { data, error } = await admin.rpc('program_scout_evaluate_candidate', { p_candidate_id: candidateId });
      if (error) throw new Error('evaluate_failed: ' + error.message);
      return data as 'rule_verified' | 'needs_review';
    },
    cadenceToNextCheck(cadence, now) {
      const hours = CADENCE_HOURS[cadence] ?? CADENCE_HOURS.monthly;
      return new Date(now.getTime() + hours * 3600 * 1000).toISOString();
    },
    now: () => new Date(),
  };

  try {
    const results = await handleRun(sourceIds, deps);
    return json(200, { results });
  } catch (e) {
    return json(500, { error: 'worker_failed', detail: e instanceof Error ? e.message : String(e) });
  }
});
