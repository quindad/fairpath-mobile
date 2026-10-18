#!/usr/bin/env node
/**
 * Deploy member-facing Signal Edge Functions to Supabase DEV.
 * Requires: supabase CLI logged in, project ref in FAIRPATH_DEV_PROJECT_REF or arg.
 *
 * Secrets (set once in dashboard or CLI):
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY (or GEMINI_API_KEY)
 */
import { spawnSync } from 'node:child_process';

const dryRun = process.argv.includes('--dry-run');
const positional = process.argv.slice(2).filter((a) => a !== '--dry-run' && !a.startsWith('-'));
const ref = positional[0] || process.env.FAIRPATH_DEV_PROJECT_REF || 'znvhmuhojvwvjzmaqwff';
const fns = [
  'job-fit-explanation',
  'cover-letter-draft',
  'letter-explainer',
  'interview-prep',
  'housing-fit-explanation',
  'housing-application-prep',
  'resource-guidance',
  'member-focus-guidance',
  'resume-bullet-draft',
  'dispute-letter-draft',
  'credit-report-explanation',
  'record-relief-explanation',
  'veteran-experience-translation',
  'academy-lesson-question',
  'business-idea-feedback',
  'meeting-prep',
  'marketplace-listing-draft',
];

console.log(`${dryRun ? 'Dry run — would deploy' : 'Deploying'} ${fns.length} Signal functions to project ${ref}…`);
if (dryRun) {
  for (const name of fns) console.log(`  • ${name}`);
  console.log('Run without --dry-run after secrets are set (see docs/SIGNAL_DEV_DEPLOY.md).');
  process.exit(0);
}
for (const name of fns) {
  const r = spawnSync('npx', ['supabase', 'functions', 'deploy', name, '--project-ref', ref], {
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`Failed: ${name}`);
    process.exit(r.status ?? 1);
  }
}
console.log('Signal deploy complete.');
