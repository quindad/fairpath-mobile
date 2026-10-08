// Pure retention sweep logic, deps-injected so it is testable offline (same pattern as
// extract-record-relief-case/handler.ts). This is where the ordering guarantee lives: a row is marked
// 'deleted' and scrubbed ONLY after Storage confirms the object was actually removed — never before, and
// never when storage_path is non-empty but removal failed. A row with no storage_path (nothing was ever
// stored) can be marked deleted directly, since there is nothing left to remove.

export type ExpiredUploadRow = { id: string; storage_path: string | null };

export type RetentionDeps = {
  checkToken(token: unknown): Promise<boolean>;
  listExpired(): Promise<ExpiredUploadRow[] | null>; // null signals a query failure
  removeFromStorage(path: string): Promise<{ ok: boolean }>;
  markDeleted(id: string): Promise<{ ok: boolean }>;
};

export type RetentionResult =
  | { status: 405; body: { error: 'method_not_allowed' } }
  | { status: 401; body: { error: 'unauthorized' } }
  | { status: 400; body: { error: 'invalid_json' } }
  | { status: 500; body: { error: 'query_failed' } }
  | { status: 200; body: { deleted: number; failed: number } };

export async function handleRetention(method: string, rawBody: string, d: RetentionDeps): Promise<RetentionResult> {
  if (method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'invalid_json' } };
  }
  const token = (parsed as { token?: unknown })?.token;
  if (!(await d.checkToken(token))) return { status: 401, body: { error: 'unauthorized' } };

  const rows = await d.listExpired();
  if (rows === null) return { status: 500, body: { error: 'query_failed' } };

  let deleted = 0;
  let failed = 0;
  for (const row of rows) {
    if (!row.storage_path) {
      const r = await d.markDeleted(row.id);
      r.ok ? deleted++ : failed++;
      continue;
    }
    const removed = await d.removeFromStorage(row.storage_path);
    if (!removed.ok) {
      failed++;
      continue; // never mark deleted when the object is still in Storage — retried on the next sweep
    }
    const marked = await d.markDeleted(row.id);
    marked.ok ? deleted++ : failed++;
  }
  return { status: 200, body: { deleted, failed } };
}
