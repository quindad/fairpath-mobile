#!/usr/bin/env node
/**
 * Compare linked DEV migration history vs local supabase/migrations (read-only).
 * Does NOT repair or push. Emits a reconciliation plan for human review.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const localDir = 'supabase/migrations';
const local = fs
  .readdirSync(localDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.replace(/_.*$/, '').replace('.sql', '') || f.split('_')[0])
  .map((f) => {
    const m = f.match(/^(\d+)/);
    return m ? m[1] : null;
  })
  .filter(Boolean);

const localSet = new Set(
  fs
    .readdirSync(localDir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.split('_')[0]),
);

const r = spawnSync('npx', ['supabase', 'migration', 'list', '--linked'], {
  encoding: 'utf8',
  shell: true,
  maxBuffer: 10 * 1024 * 1024,
});
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}

const raw = r.stdout.trim();
let rows = [];
try {
  const parsed = JSON.parse(raw);
  rows = parsed.migrations ?? [];
} catch {
  console.error('Could not parse migration list JSON');
  process.exit(1);
}

const remoteOnly = rows.filter((x) => x.remote && !x.local).map((x) => x.remote);
const localOnly = rows.filter((x) => x.local && !x.remote).map((x) => x.local);

const plan = {
  at: new Date().toISOString(),
  linkedProject: process.env.FAIRPATH_DEV_PROJECT_REF ?? 'znvhmuhojvwvjzmaqwff',
  counts: { remoteOnly: remoteOnly.length, localOnly: localOnly.length, localFiles: localSet.size },
  remoteOnlySample: remoteOnly.slice(0, 15),
  localOnly,
  recommendedSteps: [
    'Export DEV schema-only snapshot and diff against PGlite apply of all local migrations.',
    'For each remote-only version: locate applied SQL in Supabase dashboard history or backup; add matching local file OR repair as reverted only if schema already matches repo.',
    'For each local-only version: after remote history aligns, run supabase db push --linked once (never reset).',
    'Verify community contributions + member_opportunity_plan_items tables via PostgREST before enabling client sync.',
  ],
  blockedUntilReconciled: [
    'docs/proposed-migrations/20261026140000_community_contributions_DRAFT.sql (promote to versioned migration after history sync)',
    'supabase/migrations/20261026210000_member_opportunity_plan_items.sql',
  ],
};

fs.writeFileSync('docs/DEV_MIGRATION_RECONCILIATION_PLAN.json', JSON.stringify(plan, null, 2));
console.log(JSON.stringify(plan, null, 2));
