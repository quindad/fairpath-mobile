#!/usr/bin/env node
/** Read-only DEV schema probe for integration sprint objects (linked db query). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const sql = `
select json_build_object(
  'tables', (
    select coalesce(json_agg(table_name order by table_name), '[]'::json)
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'resource_reactions','community_contributions','community_contribution_events',
        'member_opportunity_plan_items'
      )
  ),
  'community_backend_ready', (select public.community_contributions_backend_ready()),
  'profiles_experience_summary', (
    select exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='experience_summary'
    )
  )
) as report;
`;

const tmp = path.join(os.tmpdir(), `fairpath-probe-${process.pid}.sql`);
fs.writeFileSync(tmp, sql.trim(), 'utf8');
try {
  const r = spawnSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '--output-format', 'json', '-f', tmp],
    { encoding: 'utf8', shell: true, maxBuffer: 4 * 1024 * 1024 },
  );
  const combined = `${r.stdout || ''}\n${r.stderr || ''}`.trim();
  const cleaned = combined.replace(/^Initialising login role\.\.\.\s*/m, '').trim();
  if (r.status !== 0 && !cleaned.includes('"rows"')) {
    console.error(cleaned || 'supabase db query failed');
    process.exit(1);
  }
  const jsonStart = cleaned.indexOf('{');
  if (jsonStart < 0) {
    console.error(cleaned || 'empty supabase db query output');
    process.exit(1);
  }
  const parsed = JSON.parse(cleaned.slice(jsonStart));
  const row = parsed.rows?.[0]?.report ?? parsed.rows?.[0];
  console.log(JSON.stringify(row, null, 2));

  const need = ['resource_reactions', 'community_contributions', 'member_opportunity_plan_items'];
  const have = new Set(row?.tables ?? []);
  const missing = need.filter((t) => !have.has(t));
  if (missing.length || !row?.community_backend_ready) {
    console.error('INTEGRATION GAP:', missing.join(', ') || 'RPC not ready');
    process.exit(1);
  }
  console.log('Integration schema probe: OK');
} finally {
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }
}
