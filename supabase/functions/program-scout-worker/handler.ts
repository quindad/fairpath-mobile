// Program Scout worker: pure orchestration logic, no I/O (mirrors extract-credit-report/handler.ts). Takes one
// or more source ids (or, with none given, asks deps for the currently-due sources), and for each: retrieves,
// hashes, detects change, extracts (if enabled), inserts a candidate, and runs the conservative verification
// gate. It NEVER promotes a candidate to a real program - that stays a separate, explicitly-invoked step
// (program_scout_promote_candidate), so nothing this worker does alone can make a new claim appear to a member
// or employer.
import { retrieve, contentHash, type SourceForRetrieval } from '../_shared/core/program-scout/adapters.ts';
import { validateCandidateExtraction, type CandidateExtraction } from '../_shared/core/program-scout/extraction.ts';

export type SourceRow = SourceForRetrieval & { id: string; active: boolean; name: string; check_cadence: string; last_content_hash: string | null; failure_count: number; fixture_extraction: unknown | null };
export type SourceResult = {
  source_id: string;
  outcome: 'skipped_inactive' | 'retrieval_failed' | 'retrieved_no_extraction' | 'extraction_failed' | 'extraction_invalid' | 'candidate_created';
  retrieval_run_id?: string;
  changed?: boolean;
  candidate_id?: string;
  gate_result?: 'rule_verified' | 'needs_review';
  extraction_source?: 'live_ai' | 'deterministic_fixture';
  detail?: string;
};

export type WorkerDeps = {
  extractionEnabled(): boolean;
  loadSource(sourceId: string): Promise<SourceRow | null>;
  selectDueSources(limit: number): Promise<string[]>;
  recordRetrievalRun(sourceId: string, r: { status: 'success' | 'failure'; httpStatus?: number; contentHash?: string; summary?: string; error?: string }): Promise<string>;
  updateSourceAfterRun(sourceId: string, patch: { healthy: boolean; contentHash?: string; nextCheckAt: string }): Promise<void>;
  recordChangeEvent(sourceId: string, oldHash: string, newHash: string): Promise<void>;
  runExtraction(text: string): Promise<unknown | null>;
  insertCandidate(input: { sourceId: string; retrievalRunId: string } & CandidateExtraction): Promise<string>;
  evaluateCandidate(candidateId: string): Promise<'rule_verified' | 'needs_review'>;
  cadenceToNextCheck(cadence: string, now: Date): string;
  now(): Date;
};

export async function processSource(sourceId: string, deps: WorkerDeps): Promise<SourceResult> {
  const source = await deps.loadSource(sourceId);
  if (!source || !source.active) return { source_id: sourceId, outcome: 'skipped_inactive' };

  const retrieval = await retrieve(source);
  if (!retrieval.ok) {
    await deps.recordRetrievalRun(sourceId, { status: 'failure', httpStatus: retrieval.httpStatus, error: retrieval.reason });
    await deps.updateSourceAfterRun(sourceId, { healthy: false, nextCheckAt: deps.cadenceToNextCheck(source.check_cadence, deps.now()) });
    return { source_id: sourceId, outcome: 'retrieval_failed', detail: retrieval.reason };
  }

  const hash = await contentHash(retrieval.text);
  const changed = source.last_content_hash !== null && source.last_content_hash !== hash;
  if (changed) await deps.recordChangeEvent(sourceId, source.last_content_hash as string, hash);

  const runId = await deps.recordRetrievalRun(sourceId, { status: 'success', httpStatus: retrieval.httpStatus, contentHash: hash, summary: retrieval.text.slice(0, 500) });
  await deps.updateSourceAfterRun(sourceId, { healthy: true, contentHash: hash, nextCheckAt: deps.cadenceToNextCheck(source.check_cadence, deps.now()) });

  // Deterministic fixture extraction proves the FULL candidate-creation/validation/gate/review-queue code path
  // today, with no model call, using explicit DEV test data - distinct from "nothing extracted" (the honest
  // state for every real source while no model credential is configured) and never used for a real source.
  const usingFixtureExtraction = source.fixture_extraction !== null && source.fixture_extraction !== undefined;
  if (!usingFixtureExtraction && !deps.extractionEnabled()) {
    return { source_id: sourceId, outcome: 'retrieved_no_extraction', retrieval_run_id: runId, changed };
  }

  let raw: unknown;
  try {
    raw = usingFixtureExtraction ? source.fixture_extraction : await deps.runExtraction(retrieval.text);
  } catch (e) {
    return { source_id: sourceId, outcome: 'extraction_failed', retrieval_run_id: runId, changed, detail: e instanceof Error ? e.message : String(e) };
  }
  const outcome = validateCandidateExtraction(raw);
  if (!outcome.ok) return { source_id: sourceId, outcome: 'extraction_invalid', retrieval_run_id: runId, changed, detail: outcome.reason };

  const candidateId = await deps.insertCandidate({ sourceId, retrievalRunId: runId, ...outcome.candidate });
  const gateResult = await deps.evaluateCandidate(candidateId);
  return { source_id: sourceId, outcome: 'candidate_created', retrieval_run_id: runId, changed, candidate_id: candidateId, gate_result: gateResult, extraction_source: usingFixtureExtraction ? 'deterministic_fixture' : 'live_ai' };
}

export async function handleRun(sourceIds: string[], deps: WorkerDeps): Promise<SourceResult[]> {
  const ids = sourceIds.length ? sourceIds : await deps.selectDueSources(3); // conservative: at most 3 sources per invocation
  const results: SourceResult[] = [];
  for (const id of ids) results.push(await processSource(id, deps)); // sequential, not parallel - avoid hammering sources
  return results;
}
