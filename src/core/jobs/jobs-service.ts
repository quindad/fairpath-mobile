import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';

export type Job = {
 id:string; title:string; company_name:string; description:string; location_text:string|null; city:string|null; state:string|null; postal_code:string|null;
 workplace_type:string; employment_type:string; pay_min:number|null; pay_max:number|null; pay_period:string|null; benefits:string[]; skills:string[]; requirements:string[];
 background_policy_summary:string|null; eligibility_rules:Record<string,unknown>; application_method:string; external_apply_url:string|null; company_website_url?:string|null;
 source_label:string; source_url:string|null; featured:boolean; created_at:string; status?:'draft'|'published'|'paused'|'closed'|'expired'|'filled'; published_at?:string|null; expires_at?:string|null; closed_at?:string|null; latitude:number|null; longitude:number|null; location_precision:string|null;
 easy_apply_enabled?:boolean; application_questions?:{id:string;label:string;type:'text'|'yes_no';required?:boolean}[];
};

const JOB_COLUMNS='id,title,company_name,description,location_text,city,state,postal_code,workplace_type,employment_type,pay_min,pay_max,pay_period,benefits,skills,requirements,background_policy_summary,eligibility_rules,application_method,external_apply_url,company_website_url,source_label,source_url,featured,created_at,status,published_at,expires_at,closed_at,latitude,longitude,location_precision,easy_apply_enabled,application_questions';

export type JobSearchParams={
 query?:string;
 zip?:string|null;
 radiusMiles?:number;
 location?:string;
 remote?:boolean;
 employmentType?:'full_time'|'part_time'|null;
 secondChance?:boolean;
 limit?:number;
 offset?:number;
};
export type JobSearchResult={jobs:(Job&{distance_miles:number|null})[];total:number;secondChanceCount:number;hasMore:boolean};
export const JOB_PAGE_SIZE=20;
export function isZip(value:string){return /^d{5}$/.test(value.trim())}
/** Server-side search (public.search_jobs): ZIP/radius, text, type and second-chance filters with pagination. */
export async function searchJobs(p:JobSearchParams={}):Promise<JobSearchResult>{
 const limit=p.limit??JOB_PAGE_SIZE;
 const offset=p.offset??0;
 const {data,error}=await supabase.rpc('search_jobs',{
  p_query:p.query?.trim()||null,
  p_zip:p.zip||null,
  p_radius_miles:p.radiusMiles??25,
  p_location:p.zip?null:(p.location?.trim()||null),
  p_remote:Boolean(p.remote),
  p_employment_type:p.employmentType??null,
  p_second_chance:Boolean(p.secondChance),
  p_limit:limit,
  p_offset:offset
 });
 if(error)throw error;
 const rows=(data??[]) as {job:Job;distance_miles:number|null;total_count:number|string;second_chance_count:number|string}[];
 const total=rows.length?Number(rows[0].total_count):0;
 const secondChanceCount=rows.length?Number(rows[0].second_chance_count):0;
 const listed=p.secondChance?secondChanceCount:total;
 return {
  jobs:rows.map(r=>({...r.job,distance_miles:r.distance_miles})),
  total,
  secondChanceCount,
  hasMore:offset+rows.length<listed
 };
}
/** Whether a ZIP can be placed on the map (postal_codes, or listings in that ZIP/prefix). */
export async function resolveZipCenter(zip:string):Promise<{latitude:number;longitude:number}|null>{
 if(!isZip(zip))return null;
 const {data,error}=await supabase.rpc('resolve_postal_center',{p_zip:zip.trim()});
 if(error)throw error;
 const row=(data??[])[0] as {latitude:number;longitude:number}|undefined;
 return row?{latitude:row.latitude,longitude:row.longitude}:null;
}
/** Small unpaginated list (Home featured jobs). */
export async function loadJobs(search='',location='',filters:{remote?:boolean;fullTime?:boolean;partTime?:boolean;secondChance?:boolean}={}){
 const zip=isZip(location)?location.trim():null;
 const r=await searchJobs({query:search,zip,location:zip?'':location,remote:filters.remote,employmentType:filters.fullTime?'full_time':filters.partTime?'part_time':null,secondChance:filters.secondChance,limit:20});
 return r.jobs as Job[];
}
export async function loadJob(id:string){
 const {data,error}=await supabase.from('jobs').select(JOB_COLUMNS).eq('id',id).single();
 if(error)throw error;return data as Job;
}

export async function saveJob(jobId:string){
 const user=await currentUser();
 const {error}=await supabase.from('saved_jobs').insert({user_id:user.id,job_id:jobId});
 if(error&&error.code!=='23505')throw error;
}
export async function isJobSaved(jobId:string){
 const user=await currentUser();
 const {data,error}=await supabase.from('saved_jobs').select('job_id').eq('user_id',user.id).eq('job_id',jobId).maybeSingle();
 if(error)throw error;
 return Boolean(data);
}
export async function loadSavedJobIds():Promise<string[]>{
 const user=await currentUser();
 const {data,error}=await supabase.from('saved_jobs').select('job_id').eq('user_id',user.id);
 if(error)throw error;
 return (data??[]).map(row=>row.job_id as string);
}
export async function unsaveJob(jobId:string){const user=await currentUser();const {error}=await supabase.from('saved_jobs').delete().eq('user_id',user.id).eq('job_id',jobId);if(error)throw error;}
export async function loadSavedJobs():Promise<Job[]>{
 const user=await currentUser();
 const {data,error}=await supabase
  .from('saved_jobs')
  .select('job:jobs('+JOB_COLUMNS+')')
  .eq('user_id',user.id)
  .order('created_at',{ascending:false});
 if(error)throw error;
 return (data??[]).map((row:any)=>row.job).filter(Boolean) as Job[];
}

export type JobApplicationAutofill={first_name:string;last_name:string;email:string;phone:string;education:string;skills:string;certifications:string;desired_roles:string;resume_ready:string};
export async function loadJobApplicationAutofill():Promise<JobApplicationAutofill>{
 const user=await currentUser();
 const [{data:profile,error:profileError},{data:rows,error:answersError}]=await Promise.all([
  supabase.from('profiles').select('first_name,last_name,phone').eq('id',user.id).single(),
  supabase.from('profile_answers').select('question_id,answer').eq('user_id',user.id)
 ]);
 if(profileError||answersError)throw profileError??answersError;
 const answers:Record<string,unknown>={};
 for(const row of rows??[])answers[row.question_id]=row.answer;
 const text=(id:string)=>{const v=answers[id];return Array.isArray(v)?v.join(', '):v==null?'':String(v)};
 return {first_name:profile?.first_name??'',last_name:profile?.last_name??'',email:user.email??'',phone:text('identity.phone')||(profile?.phone??''),education:text('employment.education_level'),skills:text('employment.skills'),certifications:text('employment.licenses_certifications'),desired_roles:text('employment.desired_roles'),resume_ready:answers['documents.resume']===true?'Yes':answers['documents.resume']===false?'No':''};
}
export async function saveJobApplicationProfile(form:JobApplicationAutofill){
 const user=await currentUser();
 const {error:profileError}=await supabase.from('profiles').update({first_name:form.first_name.trim(),last_name:form.last_name.trim(),updated_at:new Date().toISOString()}).eq('id',user.id);
 if(profileError)throw profileError;
 const list=(value:string)=>value.split(',').map(x=>x.trim()).filter(Boolean);
 const rows=[
  ['identity.phone',form.phone.trim()],
  ['employment.education_level',form.education.trim()],
  ['employment.skills',list(form.skills)],
  ['employment.licenses_certifications',list(form.certifications)],
  ['employment.desired_roles',list(form.desired_roles)],
  ['documents.resume',form.resume_ready.trim().toLowerCase()==='yes'?true:form.resume_ready.trim().toLowerCase()==='no'?false:null]
 ].filter(([,answer])=>answer!==''&&answer!==null&&(!Array.isArray(answer)||answer.length));
 if(rows.length){
  const payload=rows.map(([question_id,answer])=>({user_id:user.id,question_id,answer,source:'user',verification_state:'self_reported',updated_at:new Date().toISOString()}));
  const {error}=await supabase.from('profile_answers').upsert(payload,{onConflict:'user_id,question_id'});
  if(error)throw error;
 }
}
/** Creates the application through public.submit_job_application (validated server-side, whitelisted fields only). */
export async function submitJobApplication(jobId:string,answers:{profile:Partial<JobApplicationAutofill>;employer_questions:Record<string,string>}){
 const {data,error}=await supabase.rpc('submit_job_application',{p_job_id:jobId,p_answers:answers});
 if(error)throw new Error(error.message.includes('ALREADY_APPLIED')?'ALREADY_APPLIED':error.message.includes('SIGNED_OUT')?'SIGNED_OUT':error.message);
 return data as string;
}
export type JobApplicationStatus='started'|'submitted'|'viewed'|'interview'|'offer'|'hired'|'withdrawn'|'rejected';
export type MyJobApplication={
 id:string;
 job_id:string;
 status:JobApplicationStatus;
 submitted_at:string|null;
 updated_at:string;
 job:{id:string;title:string;company_name:string;location_text:string|null;city:string|null;state:string|null;status:string;expires_at:string|null}|null;
};
export async function loadMyJobApplications():Promise<MyJobApplication[]>{
 const user=await currentUser();
 const {data,error}=await supabase
  .from('job_applications')
  .select('id,job_id,status,submitted_at,updated_at,job:jobs(id,title,company_name,location_text,city,state,status,expires_at)')
  .eq('user_id',user.id)
  .order('updated_at',{ascending:false});
 if(error)throw error;
 return (data??[]) as unknown as MyJobApplication[];
}
export async function loadMyJobApplicationForJob(jobId:string):Promise<{id:string;status:JobApplicationStatus;submitted_at:string|null}|null>{
 const user=await currentUser();
 const {data,error}=await supabase
  .from('job_applications')
  .select('id,status,submitted_at')
  .eq('user_id',user.id)
  .eq('job_id',jobId)
  .maybeSingle();
 if(error)throw error;
 return data as {id:string;status:JobApplicationStatus;submitted_at:string|null}|null;
}
export type MyJobApplicationDetail={
 id:string;
 job_id:string;
 status:JobApplicationStatus;
 answers:Record<string,unknown>;
 submitted_at:string|null;
 updated_at:string;
 job:{id:string;title:string;company_name:string;location_text:string|null;city:string|null;state:string|null}|null;
};
export async function loadMyJobApplicationDetail(applicationId:string):Promise<MyJobApplicationDetail>{
 const user=await currentUser();
 const {data,error}=await supabase
  .from('job_applications')
  .select('id,job_id,status,answers,submitted_at,updated_at,job:jobs(id,title,company_name,location_text,city,state)')
  .eq('id',applicationId)
  .eq('user_id',user.id)
  .single();
 if(error)throw error;
 return data as unknown as MyJobApplicationDetail;
}
export async function withdrawMyJobApplication(applicationId:string){
 const {error}=await supabase.rpc('withdraw_job_application',{p_application_id:applicationId});
 if(error)throw error;
}
export type JobApplicationEvent={id:string;event_type:'submitted'|'status_changed'|'withdrawn';from_status:JobApplicationStatus|null;to_status:JobApplicationStatus;actor_type:'applicant'|'employer'|'system';created_at:string};
export async function loadJobApplicationEvents(applicationId:string):Promise<JobApplicationEvent[]>{
 const {data,error}=await supabase
  .from('job_application_events')
  .select('id,event_type,from_status,to_status,actor_type,created_at')
  .eq('application_id',applicationId)
  .order('created_at',{ascending:true});
 if(error)throw error;
 return (data??[]) as JobApplicationEvent[];
}
