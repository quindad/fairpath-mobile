// Validates proposed canonical justice SQL structure (static checks only — does NOT apply to shared DEV).
// Run: node scripts/test-proposed-justice-schema.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sqlPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'docs/proposed-migrations/20261021150000_canonical_justice_reconciliation_DRAFT.sql',
);
const sql = fs.readFileSync(sqlPath, 'utf8');
const must = [
  'create table if not exists public.justice_cases',
  'create table if not exists public.justice_charges',
  'record_relief_evaluations add column if not exists justice_charge_id',
  'employer_job_conviction_policies',
  'guard_jobs_eligibility_rules_justice_policy',
  'partner_save_job_conviction_policy_draft',
  'partner_submit_job_conviction_policy',
  'admin_approve_job_conviction_policy',
  'evaluate_member_job_justice_match',
  'service_backfill_justice_from_legacy',
];
const mustNot = ['create table if not exists public.record_relief_charges'];
const fail = [];
for (const s of must) if (!sql.includes(s)) fail.push(`missing: ${s}`);
for (const s of mustNot) if (sql.includes(s)) fail.push(`forbidden duplicate: ${s}`);
if (fail.length) {
  console.error('FAIL  proposed justice schema static validation');
  fail.forEach((f) => console.error(' ', f));
  process.exit(1);
}
console.log('PASS  proposed justice schema static validation');
