import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../docs/proposed-migrations/20261009094000_partner_org_context_RPC_DRAFT.sql',import.meta.url),'utf8');
const checks=[
['no user-supplied user id',/function public\.partner_org_context\(\)/],
['returns org id',/organization_id uuid/],
['returns org name',/organization_name text/],
['returns roles array',/roles text\[\]/],
['returns capabilities array',/capabilities text\[\]/],
['auth required',/auth\.uid\(\) is not null/],
['only own membership',/om\.user_id = auth\.uid\(\)/],
['active membership only',/om\.status = 'active'/],
['active org only',/ro\.status = 'active'/],
['active capabilities only',/oc\.status = 'active'/],
['no capability inference',/from public\.organization_capabilities oc/],
['multiple org rows',/from public\.organization_members om/],
['stable ordering',/order by ro\.name, ro\.id/],
['anonymous execute revoked',/revoke all on function public\.partner_org_context\(\) from public, anon/],
['authenticated execute granted',/grant execute on function public\.partner_org_context\(\) to authenticated, service_role/],
['empty capability array supported',/array\[\]::text\[\]/]
];
for(const [name,pattern] of checks){assert.match(sql,pattern,name);console.log('PASS '+name)}
const schema=readFileSync(new URL('../supabase/migrations/20261001100000_resources_core.sql',import.meta.url),'utf8');
const capabilities=readFileSync(new URL('../supabase/migrations/20261007140000_organization_capabilities.sql',import.meta.url),'utf8');
for(const col of ['member_role','organization_id','user_id','status'])assert.ok(schema.includes(col));
for(const col of ['capability','organization_id','status'])assert.ok(capabilities.includes(col));
console.log('PASS referenced columns present in existing migrations');
console.log('PASS '+(checks.length+1)+' static checks; NOT a live Postgres/RLS test');
