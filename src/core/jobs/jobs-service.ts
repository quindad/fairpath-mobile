import { supabase } from '@/lib/supabase';
import { formatDateInput } from '@/core/forms/formatters';
import { currentUser } from '@/core/supabase/current-user';

export type Job = {
 id:string; title:string; company_name:string; description:string; location_text:string|null; city:string|null; state:string|null; postal_code:string|null;
 workplace_type:string; employment_type:string; pay_min:number|null; pay_max:number|null; pay_period:string|null; benefits:string[]; skills:string[]; requirements:string[];
 background_policy_summary:string|null; eligibility_rules:Record<string,unknown>; application_method:string; external_apply_url:string|null; company_website_url?:string|null;
 source_label:string; source_url:string|null; featured:boolean; created_at:string; status?:'draft'|'published'|'paused'|'closed'|'expired'|'filled'; published_at?:string|null; expires_at?:string|null; closed_at?:string|null; latitude:number|null; longitude:number|null; location_precision:string|null;
 easy_apply_enabled?:boolean; application_questions?:{id:string;label:string;type:'text'|'yes_no';required?:boolean}[];
};

const JOB_COLUMNS='id,title,company_name,description,location_text,city,state,postal_code,workplace_type,employment_type,pay_min,pay_max,pay_period,benefits,skills,requirements,background_policy_summary,eligibility_rules,application_method,external_apply_url,company_website_url,source_label,source_url,featured,created_at,status,published_at,expires_at,closed_at,latitude,longitude,location_precision,easy_apply_enabled,application_questions';

type JobFilters={remote?:boolean;fullTime?:boolean;partTime?:boolean;secondChance?:boolean};
export async function loadJobs(search='',location='',filters:JobFilters={}){
 let q=supabase.from('jobs').select(JOB_COLUMNS).eq('status','published').gt('expires_at',new Date().toISOString()).order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(100);
 if(search.trim())q=q.or(`title.ilike.%${search.trim()}%,company_name.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
 if(location.trim())q=q.or(`location_text.ilike.%${location.trim()}%,city.ilike.%${location.trim()}%,state.ilike.%${location.trim()}%`);
 if(filters.remote)q=q.eq('workplace_type','remote');
 if(filters.fullTime)q=q.eq('employment_type','full_time');
 if(filters.partTime)q=q.eq('employment_type','part_time');
 const {data,error}=await q;if(error)throw error;
 let rows=(data??[]) as Job[];
 if(filters.secondChance)rows=rows.filter(j=>j.eligibility_rules?.second_chance_evidence==='explicit');
 return rows;
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

export type JobApplicationAutofill={first_name:string;last_name:string;email:string;phone:string;address:string;date_of_birth:string;education:string;skills:string;certifications:string;desired_roles:string;resume_ready:string};
export async function loadJobApplicationAutofill():Promise<JobApplicationAutofill>{
 const user=await currentUser();
 const [{data:profile,error:profileError},{data:rows,error:answersError}]=await Promise.all([
  supabase.from('profiles').select('first_name,last_name').eq('id',user.id).single(),
  supabase.from('profile_answers').select('question_id,answer').eq('user_id',user.id)
 ]);
 if(profileError||answersError)throw profileError??answersError;
 const answers:Record<string,unknown>={};
 for(const row of rows??[])answers[row.question_id]=row.answer;
 const text=(id:string)=>{const v=answers[id];return Array.isArray(v)?v.join(', '):v==null?'':String(v)};
 return {first_name:profile?.first_name??'',last_name:profile?.last_name??'',email:user.email??'',phone:text('identity.phone'),address:text('identity.address')||text('identity.current_location'),date_of_birth:formatDateInput(text('identity.date_of_birth')),education:text('employment.education_level'),skills:text('employment.skills'),certifications:text('employment.licenses_certifications'),desired_roles:text('employment.desired_roles'),resume_ready:answers['documents.resume']===true?'Yes':answers['documents.resume']===false?'No':''};
}
export async function saveJobApplicationProfile(form:JobApplicationAutofill){
 const user=await currentUser();
 const {error:profileError}=await supabase.from('profiles').update({first_name:form.first_name.trim(),last_name:form.last_name.trim(),updated_at:new Date().toISOString()}).eq('id',user.id);
 if(profileError)throw profileError;
 const list=(value:string)=>value.split(',').map(x=>x.trim()).filter(Boolean);
 const rows=[
  ['identity.phone',form.phone.trim()],
  ['identity.address',form.address.trim()],
  ['identity.date_of_birth',form.date_of_birth.trim()],
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
export async function submitJobApplication(jobId:string,answers:Record<string,unknown>={}){
 const user=await currentUser();
 const now=new Date().toISOString();
 const {error}=await supabase
  .from('job_applications')
  .insert({user_id:user.id,job_id:jobId,status:'submitted',answers,submitted_at:now,updated_at:now});
 if(error){
  if(error.code==='23505')throw new Error('ALREADY_APPLIED');
  throw error;
 }
 const {data:created}=await supabase
  .from('job_applications')
  .select('id')
  .eq('user_id',user.id)
  .eq('job_id',jobId)
  .maybeSingle();
 return (created?.id as string|undefined)??null;
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
 const user=await currentUser();
 const {error}=await supabase
  .from('job_applications')
  .update({status:'withdrawn',updated_at:new Date().toISOString()})
  .eq('id',applicationId)
  .eq('user_id',user.id);
 if(error)throw error;
}
