import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../docs/proposed-migrations/20261009093000_partner_job_application_status_RPC_DRAFT.sql',import.meta.url),'utf8');
const checks=[
 ['direct UPDATE revoked',/revoke update on public\.job_applications from authenticated/i],
 ['permissive org update policy removed',/drop policy if exists "Org managers update org job applications"/i],
 ['permissive legacy update policy removed',/drop policy if exists "Employers update applications for own jobs"/i],
 ['direct member update policy removed',/drop policy if exists "Applicants may withdraw own applications"/i],
 ['authentication required',/v_uid is null/],
 ['manager or owner only',/om\.member_role in \('owner', 'manager'\)/],
 ['active member only',/om\.status = 'active'/],
 ['active org only',/ro\.status = 'active'/],
 ['employment capability required',/oc\.capability = 'employment'[\s\S]*oc\.status = 'active'/],
 ['org-scoped ownership',/om\.organization_id = v_job\.organization_id/],
 ['individual legacy path',/v_job\.organization_id is null[\s\S]*v_job\.employer_id = v_uid/],
 ['terminal statuses blocked',/v_app\.status = 'offer' and p_status in \('hired', 'rejected'\)/],
 ['only status and updated_at written',/set status = p_status, updated_at = now\(\)/],
 ['row locked for transition',/for update;/],
 ['RPC granted to authenticated',/grant execute on function public\.partner_update_job_application_status\(uuid,text\) to authenticated/],
 ['invalid transition rejected',/INVALID_STATUS_TRANSITION/]
];
for(const [label,pattern] of checks){assert.match(sql,pattern,label); console.log('PASS '+label);}
const baseline=readFileSync(new URL('../supabase/migrations/20260926130000_jobs_search_and_applications.sql',import.meta.url),'utf8');
assert.match(baseline,/create or replace function public\.withdraw_job_application/i);
assert.match(baseline,/after update of status on public\.job_applications/i);
console.log('PASS existing withdrawal and audit trigger present');
console.log('PASS '+(checks.length+1)+' static SQL contract checks (NOT database integration tests)');
