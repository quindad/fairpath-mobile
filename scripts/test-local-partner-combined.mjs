import fs from 'node:fs';
import {addUser,createLocalDb,tryAs} from './lib/local-db.mjs';
import {makeRunner} from './lib/local-fixtures.mjs';
const {test,ok,done}=makeRunner();
const {db,errors}=await createLocalDb();
if(errors.length)throw Error(JSON.stringify(errors));
for(const file of ['20261009093000_partner_job_application_status_RPC_DRAFT.sql','20261009094000_partner_org_context_RPC_DRAFT.sql','20261009095000_partner_record_placement_hardening_DRAFT.sql']) await db.exec(fs.readFileSync('docs/proposed-migrations/'+file,'utf8'));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const creator=await addUser(db,'combined-creator@test.local','employer'),manager=await addUser(db,'combined-manager@test.local','employer'),other=await addUser(db,'combined-other@test.local','employer'),member=await addUser(db,'combined-member@test.local');
await db.query("insert into public.resource_organizations(id,name,slug,status) values($1,'Combined A','combined-a','active'),($2,'Combined B','combined-b','active')",[A,B]);
await db.query("insert into public.organization_members(organization_id,user_id,member_role,status) values($1,$2,'manager','active'),($3,$4,'manager','active')",[A,manager,B,other]);
await db.query("insert into public.organization_capabilities(organization_id,capability,status) values($1,'employment','active'),($2,'employment','active')",[A,B]);
const job=(await db.query("insert into public.jobs(employer_id,organization_id,title,description,company_name,employment_type,status,easy_apply_enabled,application_method) values($1,$2,'Combined QA','Synthetic','QA','full_time','published',true,'fairpath') returning id",[manager,A])).rows[0].id;
const submitted=await tryAs(db,member,'select public.submit_job_application($1,$2::jsonb) as id',[job,JSON.stringify({profile:{first_name:'Test',last_name:'Member',phone:'2165550100'},employer_questions:{}})]);
if(submitted.error)throw Error(submitted.error);
const app=submitted.rows[0].id;
const move=(who,status)=>tryAs(db,who,'select public.partner_update_job_application_status($1,$2)',[app,status]);
const place=who=>tryAs(db,who,"select public.partner_record_placement($1,20,'hourly','full_time','QA') as id",[app]);
await test('combined: org context is membership-scoped',async()=>{const r=await tryAs(db,manager,'select * from public.partner_org_context()');ok(!r.error&&r.rows.length===1&&r.rows[0].organization_id===A&&r.rows[0].capabilities.includes('employment'),'context');});
await test('combined: non-member and cross-org manager denied both operations',async()=>{for(const who of [creator,other]){ok(Boolean((await move(who,'viewed')).error),'status bypass');ok(Boolean((await place(who)).error),'placement bypass');}});
await test('combined: revoked membership, suspended org, revoked capability deny both',async()=>{
 for(const [table,where] of [['organization_members',"user_id=$2 and organization_id=$1"],['resource_organizations',"id=$1"],['organization_capabilities',"organization_id=$1 and capability='employment'"]]){
 const memberTable=table==='organization_members',orgTable=table==='resource_organizations',args=memberTable?[A,manager]:[A],bad=memberTable?'removed':orgTable?'suspended':'revoked';
 await db.query('update public.'+table+' set status=$'+(args.length+1)+' where '+where,[...args,bad]);
 ok(Boolean((await move(manager,'viewed')).error),'status bypass '+table);
 ok(Boolean((await place(manager)).error),'placement bypass '+table);
 await db.query('update public.'+table+' set status=$'+(args.length+1)+' where '+where,[...args,'active']);
 }});
await test('combined: full progression and actor/status audit sequence',async()=>{
 for(const status of ['viewed','interview','offer','hired'])ok(!(await move(manager,status)).error,'transition '+status);
 const events=(await db.query("select from_status,to_status,actor_id,actor_type from public.job_application_events where application_id=$1 and event_type='status_changed' order by created_at,id",[app])).rows;
 const expected=[['submitted','viewed'],['viewed','interview'],['interview','offer'],['offer','hired']];
 ok(events.length===4,'event count');
 for(let i=0;i<4;i++)ok(events[i].from_status===expected[i][0]&&events[i].to_status===expected[i][1]&&events[i].actor_id===manager&&events[i].actor_type==='employer','event '+i);
});
await test('combined: placement idempotency and direct update denial',async()=>{
 const a=await place(manager);ok(!a.error,'first placement '+a.error);
 const b=await place(manager);ok(!b.error&&a.rows[0].id===b.rows[0].id,'duplicate');
 ok((await db.query('select count(*)::int as n from public.job_placements where application_id=',[app])).rows[0].n===1,'exactly one durable placement');
 const direct=await tryAs(db,manager,"update public.job_placements set starting_wage=999 where id=$1 returning id",[a.rows[0].id]);
 ok(Boolean(direct.error)||!direct.rows.length,'direct placement mutation');
 const update=await tryAs(db,manager,"update public.job_applications set status='rejected' where id=$1 returning id",[app]);
 ok(Boolean(update.error)||!update.rows.length,'direct application mutation');
 ok((await db.query('select status from public.job_applications where id=$1',[app])).rows[0].status==='hired','application changed');
});
done('combined three drafts');
await db.close();
