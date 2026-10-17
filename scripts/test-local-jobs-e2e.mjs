import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) throw new Error(JSON.stringify(errors));
const MEMBER = await addUser(db, 'jobs-member@test.local');
const EMPLOYER = await addUser(db, 'jobs-employer@test.local', 'employer');
const OUTSIDER = await addUser(db, 'jobs-outsider@test.local', 'employer');
const one = async (sql, args=[]) => (await db.query(sql,args)).rows[0];
const must = (r, label) => { if (r.error) throw new Error(label+': '+r.error); return r.rows; };
const rpc = (who, fn, args=[]) => tryAs(db, who, `select * from public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')})`, args);
const job = await one(`insert into public.jobs(employer_id,title,description,company_name,employment_type,status,easy_apply_enabled,application_method) values($1,'Synthetic QA job','QA only','QA Employer','full_time','published',true,'fairpath') returning id`,[EMPLOYER]);
const answers = JSON.stringify({profile:{first_name:'Synthetic',last_name:'Member',phone:'2165550100'},employer_questions:{}});
let applicationId;

await test('member submits once and duplicate application is rejected', async()=>{
 applicationId = must(await rpc(MEMBER,'submit_job_application',[job.id,answers]),'submit')[0].submit_job_application;
 const duplicate=await rpc(MEMBER,'submit_job_application',[job.id,answers]);
 ok(duplicate.error?.includes('ALREADY_APPLIED'),'duplicate was not rejected');
});

await test('employer sees application while unrelated employer cannot',async()=>{
 ok(must(await tryAs(db,EMPLOYER,'select id from public.job_applications where id=$1',[applicationId]),'employer read').length===1,'employer cannot see application');
 ok(must(await tryAs(db,OUTSIDER,'select id from public.job_applications where id=$1',[applicationId]),'outsider read').length===0,'outsider saw application');
});

await test('employer progresses viewed, interview, offer and hired with audit events and notifications',async()=>{
 for(const status of ['viewed','interview','offer','hired']){
  const changed=must(await tryAs(db,EMPLOYER,'update public.job_applications set status=$1 where id=$2 returning status',[status,applicationId]),'status '+status);
  ok(changed[0]?.status===status,'status did not advance to '+status);
 }
 const events=(await db.query('select to_status from public.job_application_events where application_id=$1 order by created_at,id',[applicationId])).rows.map(x=>x.to_status);
 ok(events.join(',')==='submitted,viewed,interview,offer,hired','unexpected event chain '+events.join(','));
 const notifications=(await db.query("select count(*)::int n from public.user_notifications where user_id=$1 and dedupe_key like 'job_app:%'",[MEMBER])).rows[0].n;
 ok(notifications===4,'expected four employer-driven notifications, got '+notifications);
});

await test('hire creates idempotent placement evidence and outsider cannot forge it',async()=>{
 const outsider=await rpc(OUTSIDER,'partner_record_placement',[applicationId,20,'hourly','full_time','QA']);
 ok(outsider.error?.includes('NOT_AUTHORIZED'),'outsider recorded placement');
 const first=must(await rpc(EMPLOYER,'partner_record_placement',[applicationId,20,'hourly','full_time','QA']),'placement')[0].partner_record_placement;
 const second=must(await rpc(EMPLOYER,'partner_record_placement',[applicationId,20,'hourly','full_time','QA']),'placement repeat')[0].partner_record_placement;
 ok(first===second,'placement was not idempotent');
 ok((await db.query('select count(*)::int n from public.job_placements where id=$1',[first])).rows[0].n===1,'placement evidence row missing');
 ok((await db.query("select count(*)::int n from public.impact_evidence where source_table='job_placements' and source_id=$1",[first])).rows[0].n===0,'an individual-employer placement must not invent organization-attributed impact evidence');
});

await test('rejected outcome is visible to its member and isolated from another member',async()=>{
 const member2=await addUser(db,'jobs-member2@test.local');
 const app2=must(await rpc(member2,'submit_job_application',[job.id,answers]),'second member submit')[0].submit_job_application;
 must(await tryAs(db,EMPLOYER,"update public.job_applications set status='rejected' where id=$1 returning id",[app2]),'reject');
 ok(must(await tryAs(db,member2,'select status from public.job_applications where id=$1',[app2]),'owner read')[0].status==='rejected','member cannot see rejection');
 ok(must(await tryAs(db,MEMBER,'select id from public.job_applications where id=$1',[app2]),'cross member read').length===0,'member saw another application');
});

done('local Postgres');
await db.close();
