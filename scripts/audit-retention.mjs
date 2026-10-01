import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('supabase/migrations');
const sql = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const mobile = fs.readFileSync(path.resolve('src/app/retention-checkin.tsx'), 'utf8');
const service = fs.readFileSync(path.resolve('src/core/retention/retention-service.ts'), 'utf8');
const checks = [
  ['five checkpoint types', ['day_7','day_30','day_60','day_90','day_180'].every((x) => sql.includes(x))],
  ['placement trigger', sql.includes('job_placements_create_retention_checkpoints')],
  ['member RPC', sql.includes('member_confirm_retention_checkpoint')],
  ['employer RPC', sql.includes('employer_confirm_retention_checkpoint')],
  ['private support table', sql.includes('retention_support_requests')],
  ['CRM curated projection', sql.includes('partner_retention_for_organization')],
  ['impact evidence trigger', sql.includes('retention_checkpoints_record_evidence')],
  ['reminder sweep', sql.includes('retention_send_checkpoint_reminders')],
  ['early-confirmation guard', sql.includes('RETENTION_CHECKPOINT_NOT_DUE')],
  ['support request idempotency', sql.includes('retention_support_requests_checkpoint_open_unique')],
  ['mobile check-in route', mobile.includes("How's the job going?") && mobile.includes('I NEED SUPPORT')],
  ['mobile writes use RPC', service.includes("supabase.rpc('member_confirm_retention_checkpoint'")],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) process.exit(1);
console.log(`Retention audit passed: ${checks.length}/${checks.length}`);
