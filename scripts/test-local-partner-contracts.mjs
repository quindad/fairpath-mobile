import fs from 'node:fs';
import { createLocalDb, addUser, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';
const {test,ok,done}=makeRunner();
const {db,errors}=await createLocalDb();
if(errors.length)throw new Error(JSON.stringify(errors));
for(const f of ['20261009094000_partner_org_context_RPC_DRAFT.sql','20261009093000_partner_job_application_status_RPC_DRAFT.sql']){
  await db.exec(fs.readFileSync('docs/proposed-migrations/'+f,'utf8').replace(/^\\uFEFF/, ''));
}
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const owner=await addUser(db,'ctx-owner@test.local'), editor=await addUser(db,'ctx-editor@test.local'),removed=await addUser(db,'ctx-removed@test.local'),invited=await addUser(db,'ctx-invited@test.local'),outsider=await addUser(db,'ctx-outsider@test.local');
await db.query(`insert into public.resource_organizations(id,name,slug,status) values
('${A}','Org A','org-ctx-a','active'),('${B}','Org B','org-ctx-b','active'),('${C}','Org C','org-ctx-c','suspended')`);
await db.query(`insert into public.organization_members(organization_id,user_id,member_role,status) values
('${A}',$1,'manager','active'),('${B}',$1,'owner','active'),('${C}',$1,'owner','active'),
('${A}',$2,'editor','active'),('${A}',$3,'manager','removed'),('${B}',$4,'manager','invited')`,[owner,editor,removed,invited]);
await db.query(`insert into public.organization_capabilities(organization_id,capability,status) values
('${A}','employment','active'),('${A}','housing','revoked'),('${B}','case_management','active'),('${C}','employment','active')`);
await test('org context: two active orgs, roles and active capability only',async()=>{
 const r=await tryAs(db,owner,'select * from public.partner_org_context()');
 ok(!r.error,JSON.stringify(r.error));ok(r.rows.length===2,'expected two orgs');
 ok(r.rows[0].organization_id===A && JSON.stringify(r.rows[0].roles)==='["manager"]' && JSON.stringify(r.rows[0].capabilities)==='["employment"]','A membership/capability');
 ok(r.rows[1].organization_id===B && JSON.stringify(r.rows[1].capabilities)==='["case_management"]','B membership/capability');
});
await test('org context: editor receives no derived capabilities',async()=>{
 const r=await tryAs(db,editor,'select * from public.partner_org_context()');
 ok(r.rows.length===1 && r.rows[0].roles[0]==='editor' && r.rows[0].capabilities[0]==='employment','editor has staff-granted org capability');
});
await test('org context: invited, removed, outsider excluded',async()=>{
 for(const u of [removed,invited,outsider]){const r=await tryAs(db,u,'select * from public.partner_org_context()');ok(!r.error && r.rows.length===0,'unauthorized org rows');}
});
await test('org context: anonymous cannot execute',async()=>{
 const r=await tryAs(db,null,'select * from public.partner_org_context()');ok(Boolean(r.error),'anonymous RPC should fail');
});
await test('status RPC: anonymous cannot execute',async()=>{
 const r=await tryAs(db,null,`select public.partner_update_job_application_status('${A}','viewed')`);ok(Boolean(r.error),'anonymous status RPC should fail');
});

const applicant=await addUser(db,'ctx-applicant@test.local');
const legacy=await addUser(db,'ctx-legacy@test.local');
const otherApplicant=await addUser(db,'ctx-other-applicant@test.local');
await db.query(`insert into public.jobs(employer_id,organization_id,title,description,company_name,employment_type,status,application_method)
values ($1,$2,'Partner contract job','Test position','Org A','full_time','published','fairpath'),
($3,null,'Legacy contract job','Test position','Legacy','full_time','published','fairpath')`,[owner,A,legacy]);
const orgJob=(await db.query('select id from public.jobs where organization_id=$1',[A])).rows[0].id;
const legacyJob=(await db.query('select id from public.jobs where employer_id=$1 and organization_id is null',[legacy])).rows[0].id;
let applicationCounter=0;
async function application(job=orgJob,status='submitted'){
 await db.query(`select set_config('request.jwt.claim.sub','',false)`);
 const applicantId=await addUser(db,'ctx-app-'+(++applicationCounter)+'@test.local');
 const r=await db.query('insert into public.job_applications(user_id,job_id,status,answers,submitted_at) values($1,$2,$3,$4::jsonb,now()) returning id',[applicantId,job,status,JSON.stringify({test:'original'})]);
 return r.rows[0].id;
}
async function move(who,id,status){return tryAs(db,who,'select public.partner_update_job_application_status($1,$2)',[id,status]);}
await test('ATS: complete allowed stage progression and event trail',async()=>{
 const id=await application();
 for(const status of ['viewed','interview','offer','hired']){const r=await move(owner,id,status);ok(!r.error,'stage '+status+': '+r.error);}
 const result=await db.query('select status from public.job_applications where id=$1',[id]);ok(result.rows[0].status==='hired','final hired');
 const events=await db.query('select * from public.job_application_events where application_id=$1',[id]);ok(events.rows.length>=4,'missing status events');
});
await test('ATS: valid rejection, invalid transitions and terminal protection',async()=>{
 const id=await application();
 ok(Boolean((await move(owner,id,'hired')).error),'cannot skip to hired');
 ok(!(await move(owner,id,'rejected')).error,'reject submitted');
 ok(Boolean((await move(owner,id,'viewed')).error),'rejected terminal');
});
await test('ATS: cross-org, editor, outsider and removed membership denied',async()=>{
 const id=await application();
 for(const who of [editor,outsider,removed])ok(Boolean((await move(who,id,'viewed')).error),'unauthorized stage update');
 const result=await db.query('select status from public.job_applications where id=$1',[id]);ok(result.rows[0].status==='submitted','status changed');
});
await test('ATS: revoked employment capability denies status updates',async()=>{
 const id=await application();
 await db.query(`update public.organization_capabilities set status='revoked' where organization_id=$1 and capability='employment'`,[A]);
 ok(Boolean((await move(owner,id,'viewed')).error),'revoked capability bypass');
 await db.query(`update public.organization_capabilities set status='active' where organization_id=$1 and capability='employment'`,[A]);
});
await test('ATS: legacy individual employer remains supported',async()=>{
 const id=await application(legacyJob);
 ok(!(await move(legacy,id,'viewed')).error,'legacy employer denied');
 ok(Boolean((await move(owner,id,'interview')).error),'other employer allowed');
});
await test('ATS: immutable applicant and submitted answers',async()=>{
 const id=await application();
 const result=await tryAs(db,owner,`update public.job_applications set user_id=$1, answers='{"forged":true}'::jsonb where id=$2 returning id`,[otherApplicant,id]);
 ok(Boolean(result.error)||!result.rows.length,'immutable bypass');
 const r=await db.query('select user_id,answers from public.job_applications where id=$1',[id]);
 ok(r.rows[0].user_id!==otherApplicant && r.rows[0].answers.test==='original','tamper persisted');
});
await test('ATS: applicant withdrawal RPC preserved',async()=>{
 const id=await application();
 const r=await tryAs(db,(await db.query('select user_id from public.job_applications where id=$1',[id])).rows[0].user_id,'select public.withdraw_job_application($1)',[id]);
 ok(!r.error,'withdraw failed: '+r.error);
 const result=await db.query('select status from public.job_applications where id=$1',[id]);
 ok(result.rows[0].status==='withdrawn','withdraw did not persist');
});


const managerB=await addUser(db,'ctx-manager-b@test.local');
await db.query('insert into public.organization_members(organization_id,user_id,member_role,status) values($1,$2,$3,$4)',[B,managerB,'manager','active']);
await db.query("insert into public.organization_capabilities(organization_id,capability,status) values($1,'employment','active')",[B]);
await test('ATS: other organization manager with employment capability denied',async()=>{
 const id=await application();
 ok(Boolean((await move(managerB,id,'viewed')).error),'cross-org manager allowed');
});
await test('ATS: suspended organization cannot mutate applications',async()=>{
 const id=await application();
 await db.query("update public.resource_organizations set status='suspended' where id=$1",[A]);
 ok(Boolean((await move(owner,id,'viewed')).error),'suspended organization allowed');
 await db.query("update public.resource_organizations set status='active' where id=$1",[A]);
});
await test('ATS: manager revoked after session cannot mutate applications',async()=>{
 const id=await application();
 await db.query("update public.organization_members set status='removed' where organization_id=$1 and user_id=$2",[A,owner]);
 ok(Boolean((await move(owner,id,'viewed')).error),'removed manager allowed');
 await db.query("update public.organization_members set status='active' where organization_id=$1 and user_id=$2",[A,owner]);
});
await test('ATS: direct authenticated UPDATE is denied even for own organization',async()=>{
 const id=await application();
 const result=await tryAs(db,owner,"update public.job_applications set status='viewed' where id=$1 returning id",[id]);
 ok(Boolean(result.error)||result.rows.length===0,'direct update succeeded');
});
await test('ATS: audit events contain ordered transitions and authenticated actor',async()=>{
 const id=await application();
 for(const stage of ['viewed','interview','offer','hired'])ok(!(await move(owner,id,stage)).error,'transition '+stage);
 const r=await db.query('select from_status,to_status,actor_id,actor_type,event_type from public.job_application_events where application_id=$1 order by created_at,id',[id]);
 const stages=r.rows.filter(e=>e.event_type==='status_changed');
 const expected=[['submitted','viewed'],['viewed','interview'],['interview','offer'],['offer','hired']];
 ok(stages.length===4,'expected exactly 4 status events');
 for(let i=0;i<4;i++){
  ok(stages[i].from_status===expected[i][0]&&stages[i].to_status===expected[i][1],'event sequence '+i);
  ok(stages[i].actor_id===owner&&stages[i].actor_type==='employer','event actor '+i);
 }
});

done();
