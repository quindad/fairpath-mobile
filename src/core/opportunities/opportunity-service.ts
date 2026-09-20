import { supabase } from '@/lib/supabase';
import { isValidDateText, isValidEmail } from '@/core/forms/formatters';

export type Job = {
 id:string; title:string; company_name:string; description:string; location_text:string|null; city:string|null; state:string|null; postal_code:string|null;
 workplace_type:string; employment_type:string; pay_min:number|null; pay_max:number|null; pay_period:string|null; benefits:string[]; skills:string[]; requirements:string[];
 background_policy_summary:string|null; eligibility_rules:Record<string,unknown>; application_method:string; external_apply_url:string|null; company_website_url?:string|null;
 source_label:string; source_url:string|null; featured:boolean; created_at:string; status?:'draft'|'published'|'paused'|'closed'|'expired'|'filled'; published_at?:string|null; expires_at?:string|null; closed_at?:string|null; latitude:number|null; longitude:number|null; location_precision:string|null;
 easy_apply_enabled?:boolean; application_questions?:{id:string;label:string;type:'text'|'yes_no';required?:boolean}[];
};
export type HousingListing = {
 id:string; title:string; description:string; property_type:string; address_line1:string|null; address_line2:string|null; city:string; state:string; postal_code:string|null;
 bedrooms:number|null; bathrooms:number|null; square_feet:number|null; rent_monthly:number; deposit_amount:number|null; application_fee:number|null; available_date:string|null;
 lease_terms:string[]; amenities:string[]; utilities_included:string[]; pet_policy:string|null; parking:string|null; accessibility_features:string[]; screening_summary:string|null; eligibility_rules:Record<string,unknown>;
 virtual_tour_url:string|null; floor_plan_url:string|null; video_url:string|null; fasttrack_enabled:boolean; featured:boolean; source_label:string; source_url:string|null;
 latitude:number|null; longitude:number|null; garage_spaces:number|null; parking_types:string[]; furnished:boolean; has_basement:boolean; has_yard:boolean; has_balcony_patio:boolean; laundry_type:string|null; has_central_air:boolean; pet_types:string[]; move_in_ready:boolean; walk_score:number|null; transit_score:number|null; bike_score:number|null; housing_media?:{url:string;media_type:string;sort_order:number}[];
};
export type MarketplaceItem = {
 id:string; title:string; description:string; category:string; condition:string|null; price:number; is_free:boolean; city:string; state:string; pickup_notes:string|null;
 safe_pickup:boolean; created_at:string; marketplace_media?:{url:string;sort_order:number}[];
};

type JobFilters={remote?:boolean;fullTime?:boolean;partTime?:boolean;secondChance?:boolean};
export async function loadJobs(search='',location='',filters:JobFilters={}){
 let q=supabase.from('jobs').select('id,title,company_name,description,location_text,city,state,postal_code,workplace_type,employment_type,pay_min,pay_max,pay_period,benefits,skills,requirements,background_policy_summary,eligibility_rules,application_method,external_apply_url,company_website_url,source_label,source_url,featured,created_at,status,published_at,expires_at,closed_at,latitude,longitude,location_precision,easy_apply_enabled,application_questions').eq('status','published').gt('expires_at',new Date().toISOString()).order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(100);
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
 const {data,error}=await supabase.from('jobs').select('id,title,company_name,description,location_text,city,state,postal_code,workplace_type,employment_type,pay_min,pay_max,pay_period,benefits,skills,requirements,background_policy_summary,eligibility_rules,application_method,external_apply_url,company_website_url,source_label,source_url,featured,created_at,status,published_at,expires_at,closed_at,latitude,longitude,location_precision,easy_apply_enabled,application_questions').eq('id',id).single();
 if(error)throw error;return data as Job;
}
export async function loadHousing(search='',location=''){
 let q=supabase.from('housing_listings').select('id,title,description,property_type,address_line1,address_line2,city,state,postal_code,bedrooms,bathrooms,square_feet,rent_monthly,deposit_amount,application_fee,available_date,lease_terms,amenities,utilities_included,pet_policy,parking,accessibility_features,screening_summary,eligibility_rules,virtual_tour_url,floor_plan_url,video_url,fasttrack_enabled,featured,source_label,source_url,latitude,longitude,garage_spaces,parking_types,furnished,has_basement,has_yard,has_balcony_patio,laundry_type,has_central_air,pet_types,move_in_ready,walk_score,transit_score,bike_score,housing_media(url,media_type,sort_order)').eq('status','published').order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(100);
 if(search.trim())q=q.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
 if(location.trim())q=q.or(`city.ilike.%${location.trim()}%,state.ilike.%${location.trim()}%,postal_code.ilike.%${location.trim()}%`);
 const {data,error}=await q;if(error)throw error;return (data??[]) as HousingListing[];
}
export async function loadHousingListing(id:string){
 const {data,error}=await supabase.from('housing_listings').select('id,title,description,property_type,address_line1,address_line2,city,state,postal_code,bedrooms,bathrooms,square_feet,rent_monthly,deposit_amount,application_fee,available_date,lease_terms,amenities,utilities_included,pet_policy,parking,accessibility_features,screening_summary,eligibility_rules,virtual_tour_url,floor_plan_url,video_url,fasttrack_enabled,featured,source_label,source_url,latitude,longitude,garage_spaces,parking_types,furnished,has_basement,has_yard,has_balcony_patio,laundry_type,has_central_air,pet_types,move_in_ready,walk_score,transit_score,bike_score,housing_media(url,media_type,sort_order)').eq('id',id).single();
 if(error)throw error;return data as HousingListing;
}
export async function loadMarketplace(search='',category=''){
 let q=supabase.from('marketplace_items').select('id,title,description,category,condition,price,is_free,city,state,pickup_notes,safe_pickup,created_at,marketplace_media(url,sort_order)').eq('status','available').order('created_at',{ascending:false}).limit(100);
 if(search.trim())q=q.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%`);
 if(category)q=q.eq('category',category);
 const {data,error}=await q;if(error)throw error;return (data??[]) as MarketplaceItem[];
}
export async function loadMarketplaceItem(id:string){
 const {data,error}=await supabase.from('marketplace_items').select('id,title,description,category,condition,price,is_free,city,state,pickup_notes,safe_pickup,created_at,marketplace_media(url,sort_order)').eq('id',id).single();
 if(error)throw error;return data as MarketplaceItem;
}
async function currentUser(){const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('SIGNED_OUT');return user;}
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
  .select('job:jobs(id,title,company_name,description,location_text,city,state,postal_code,workplace_type,employment_type,pay_min,pay_max,pay_period,benefits,skills,requirements,background_policy_summary,eligibility_rules,application_method,external_apply_url,company_website_url,source_label,source_url,featured,created_at,status,published_at,expires_at,closed_at,latitude,longitude,location_precision,easy_apply_enabled,application_questions)')
  .eq('user_id',user.id)
  .order('created_at',{ascending:false});
 if(error)throw error;
 return (data??[]).map((row:any)=>row.job).filter(Boolean) as Job[];
}
export async function saveHousing(listingId:string){const user=await currentUser();const {error}=await supabase.from('saved_housing').insert({user_id:user.id,listing_id:listingId});if(error&&error.code!=='23505')throw error;}
export async function unsaveHousing(listingId:string){const user=await currentUser();const {error}=await supabase.from('saved_housing').delete().eq('user_id',user.id).eq('listing_id',listingId);if(error)throw error;}
export async function isHousingSaved(listingId:string){const user=await currentUser();const {data,error}=await supabase.from('saved_housing').select('listing_id').eq('user_id',user.id).eq('listing_id',listingId).maybeSingle();if(error)throw error;return Boolean(data);}
export async function loadSavedHousingIds():Promise<string[]>{const user=await currentUser();const {data,error}=await supabase.from('saved_housing').select('listing_id').eq('user_id',user.id);if(error)throw error;return (data??[]).map(row=>row.listing_id as string);}

export async function loadSavedHousing():Promise<HousingListing[]>{
 const user=await currentUser();
 const {data,error}=await supabase.from('saved_housing').select('listing:housing_listings(id,title,description,property_type,address_line1,address_line2,city,state,postal_code,bedrooms,bathrooms,square_feet,rent_monthly,deposit_amount,application_fee,available_date,lease_terms,amenities,utilities_included,pet_policy,parking,accessibility_features,screening_summary,eligibility_rules,virtual_tour_url,floor_plan_url,video_url,fasttrack_enabled,featured,source_label,source_url,latitude,longitude,garage_spaces,parking_types,furnished,has_basement,has_yard,has_balcony_patio,laundry_type,has_central_air,pet_types,move_in_ready,walk_score,transit_score,bike_score,housing_media(url,media_type,sort_order))').eq('user_id',user.id).order('created_at',{ascending:false});
 if(error)throw error;return (data??[]).map((row:any)=>row.listing).filter(Boolean) as HousingListing[];
}
export type MyHousingApplication={id:string;listing_id:string;status:HousingApplicationStatus;application_type:'standard'|'fasttrack';current_step:number;submitted_at:string|null;updated_at:string;listing:{id:string;title:string;city:string;state:string;rent_monthly:number;bedrooms:number|null;bathrooms:number|null;fasttrack_enabled:boolean}|null};
export async function loadMyHousingApplications():Promise<MyHousingApplication[]>{
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_applications').select('id,listing_id,status,application_type,current_step,submitted_at,updated_at,listing:housing_listings(id,title,city,state,rent_monthly,bedrooms,bathrooms,fasttrack_enabled)').eq('user_id',user.id).order('updated_at',{ascending:false});
 if(error)throw error;return (data??[]) as unknown as MyHousingApplication[];
}

export async function saveMarketplace(itemId:string){const user=await currentUser();const {error}=await supabase.from('marketplace_saves').upsert({user_id:user.id,item_id:itemId});if(error)throw error;}
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
 return {first_name:profile?.first_name??'',last_name:profile?.last_name??'',email:user.email??'',phone:text('identity.phone'),address:text('identity.address')||text('identity.current_location'),date_of_birth:text('identity.date_of_birth'),education:text('employment.education_level'),skills:text('employment.skills'),certifications:text('employment.licenses_certifications'),desired_roles:text('employment.desired_roles'),resume_ready:answers['documents.resume']===true?'Yes':answers['documents.resume']===false?'No':''};
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
export type HousingApplicationStatus='started'|'submitted'|'reviewing'|'tour'|'approved'|'denied'|'withdrawn';
export type HousingApplicationMode='standard'|'fasttrack';
export async function loadMyHousingApplication(listingId:string):Promise<{id:string;status:HousingApplicationStatus;application_type:HousingApplicationMode;current_step:number}|null>{
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_applications').select('id,status,application_type,current_step').eq('user_id',user.id).eq('listing_id',listingId).maybeSingle();
 if(error)throw error;
 return data as {id:string;status:HousingApplicationStatus;application_type:HousingApplicationMode;current_step:number}|null;
}
export async function startHousingApplication(listingId:string,fastTrack=false){
 const user=await currentUser();
 const now=new Date().toISOString();
 const {data:existing,error:existingError}=await supabase.from('housing_applications').select('id,status,application_type,current_step').eq('user_id',user.id).eq('listing_id',listingId).maybeSingle();
 if(existingError)throw existingError;
 if(existing)return existing as {id:string;status:HousingApplicationStatus;application_type:HousingApplicationMode;current_step:number};
 const {data,error}=await supabase.from('housing_applications').insert({user_id:user.id,listing_id:listingId,application_type:fastTrack?'fasttrack':'standard',status:'started',current_step:1,updated_at:now}).select('id,status,application_type,current_step').single();
 if(error)throw error;
 return data as {id:string;status:HousingApplicationStatus;application_type:HousingApplicationMode;current_step:number};
}
export type HousingApplicationDetail=MyHousingApplication & {listing:{id:string;title:string;city:string;state:string;rent_monthly:number;bedrooms:number|null;bathrooms:number|null;fasttrack_enabled:boolean}|null};
export async function loadMyHousingApplicationDetail(applicationId:string):Promise<HousingApplicationDetail>{
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_applications').select('id,listing_id,status,application_type,current_step,submitted_at,updated_at,listing:housing_listings(id,title,city,state,rent_monthly,bedrooms,bathrooms,fasttrack_enabled)').eq('id',applicationId).eq('user_id',user.id).single();
 if(error)throw error;
 return data as unknown as HousingApplicationDetail;
}
export type HousingApplicationForm={first_name:string;last_name:string;email:string;phone:string;date_of_birth:string;current_address:string;monthly_income:string;employer:string;employment_status:string;move_in_date:string;occupants:string;pets:string;housing_history:string;references:string;additional_notes:string};
const EMPTY_HOUSING_FORM:HousingApplicationForm={first_name:'',last_name:'',email:'',phone:'',date_of_birth:'',current_address:'',monthly_income:'',employer:'',employment_status:'',move_in_date:'',occupants:'',pets:'',housing_history:'',references:'',additional_notes:''};
export function validateHousingApplicationForm(form:HousingApplicationForm){
 const errors:Partial<Record<keyof HousingApplicationForm,string>>={};
 if(form.first_name.trim().length<2)errors.first_name='Enter your first name.';
 if(form.last_name.trim().length<2)errors.last_name='Enter your last name.';
 if(!isValidEmail(form.email))errors.email='Enter a valid email address.';
 if(form.phone.replace(/\D/g,'').length!==10)errors.phone='Enter a 10-digit phone number.';
 if(!isValidDateText(form.date_of_birth,{allowFuture:false}))errors.date_of_birth='Enter date of birth as MM/DD/YYYY.';
 if(!form.current_address.trim())errors.current_address='Enter your current address or housing situation.';
 if(!form.employment_status.trim())errors.employment_status='Select an employment status.';
 if(form.employment_status!=='Unemployed'&&!form.employer.trim())errors.employer='Enter your employer or income source.';
 const income=Number(form.monthly_income.replace(/[^0-9.]/g,''));
 if(!form.monthly_income.trim()||Number.isNaN(income)||income<0)errors.monthly_income='Enter gross monthly income. Use 0 if none.';
 if(!isValidDateText(form.move_in_date,{allowFuture:true}))errors.move_in_date='Enter move-in date as MM/DD/YYYY.';
 const occupants=Number(form.occupants);
 if(!Number.isInteger(occupants)||occupants<1)errors.occupants='Enter at least 1 occupant.';
 if(!form.pets.trim())errors.pets='Enter pet details or select None.';
 if(!form.housing_history.trim())errors.housing_history='Enter housing history or state that you have no prior rental history.';
 if(!form.references.trim())errors.references='Enter a reference or state None available.';
 return errors;
}
export async function loadHousingApplicationForm(applicationId:string):Promise<{form:HousingApplicationForm;current_step:number;application_type:HousingApplicationMode}>{
 const user=await currentUser();
 const [{data:app,error},{data:profile},{data:rows}]=await Promise.all([
  supabase.from('housing_applications').select('answers,current_step,application_type').eq('id',applicationId).eq('user_id',user.id).single(),
  supabase.from('profiles').select('first_name,last_name').eq('id',user.id).maybeSingle(),
  supabase.from('profile_answers').select('question_id,answer,verification_state').eq('user_id',user.id)
 ]);
 if(error)throw error;
 const answers:Record<string,unknown>={}; for(const row of rows??[])answers[row.question_id]=row.answer;
 const text=(id:string)=>{const v=answers[id];return Array.isArray(v)?v.join(', '):v==null?'':String(v)};
 const saved=(app?.answers??{}) as Partial<HousingApplicationForm>;
 const fast=app?.application_type==='fasttrack';
 const prefill:HousingApplicationForm=fast?{
  ...EMPTY_HOUSING_FORM,
  first_name:profile?.first_name??'',
  last_name:profile?.last_name??'',
  email:user.email??'',
  phone:text('identity.phone'),
  date_of_birth:text('identity.date_of_birth'),
  current_address:text('identity.address')||text('identity.current_location'),
  occupants:text('housing.household_size')
 }:{...EMPTY_HOUSING_FORM};
 return {current_step:app?.current_step??1,application_type:(app?.application_type??'standard') as HousingApplicationMode,form:{...prefill,...saved}};
}
export async function saveHousingApplicationDraft(applicationId:string,form:HousingApplicationForm,currentStep:number){
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_applications').update({answers:form,current_step:Math.max(1,Math.min(5,currentStep)),updated_at:new Date().toISOString()}).eq('id',applicationId).eq('user_id',user.id).eq('status','started').select('id,current_step').single();
 if(error)throw error;
 return data;
}
export async function submitHousingApplication(applicationId:string,form:HousingApplicationForm,consent:{accuracy:boolean;submit:boolean;fasttrack_ack?:boolean}){
 const validation=validateHousingApplicationForm(form);
 if(Object.keys(validation).length)throw new Error('APPLICATION_INCOMPLETE');
 if(!consent.accuracy||!consent.submit)throw new Error('CONSENT_REQUIRED');
 const user=await currentUser();
 const now=new Date().toISOString();
 const {data,error}=await supabase.from('housing_applications').update({answers:form,current_step:5,status:'submitted',submitted_at:now,updated_at:now,applicant_snapshot:form,consent_snapshot:{...consent,confirmed_at:now}}).eq('id',applicationId).eq('user_id',user.id).eq('status','started').select('id,status,submitted_at').single();
 if(error)throw error;
 if(!data||data.status!=='submitted'||!data.submitted_at)throw new Error('SUBMIT_NOT_CONFIRMED');
 return data;
}
export async function deleteHousingApplicationDraft(applicationId:string){
 const user=await currentUser();
 const {error}=await supabase.from('housing_applications').delete().eq('id',applicationId).eq('user_id',user.id).eq('status','started');
 if(error)throw error;
}
export async function withdrawMyHousingApplication(applicationId:string){
 const user=await currentUser();
 const {error}=await supabase.from('housing_applications').update({status:'withdrawn',updated_at:new Date().toISOString()}).eq('id',applicationId).eq('user_id',user.id).in('status',['submitted','reviewing','tour']);
 if(error)throw error;
}

export async function claimMarketplaceItem(itemId:string){const user=await currentUser();const {data:existing,error:findError}=await supabase.from('marketplace_claims').select('id,status').eq('item_id',itemId).eq('claimant_id',user.id).in('status',['requested','approved','ready']).maybeSingle();if(findError)throw findError;if(existing)return existing;const {data,error}=await supabase.from('marketplace_claims').insert({item_id:itemId,claimant_id:user.id,status:'requested',pickup_deadline:new Date(Date.now()+48*60*60*1000).toISOString()}).select('id,status').single();if(error)throw error;return data;}

export type EmployerApplicationStatus='viewed'|'interview'|'offer'|'hired'|'rejected';
export type EmployerJobApplication={
 id:string;
 user_id:string;
 job_id:string;
 status:JobApplicationStatus;
 answers:Record<string,unknown>;
 submitted_at:string|null;
 updated_at:string;
};
export async function loadEmployerJobApplications(jobId:string):Promise<EmployerJobApplication[]>{
 await currentUser();
 const {data,error}=await supabase
  .from('job_applications')
  .select('id,user_id,job_id,status,answers,submitted_at,updated_at')
  .eq('job_id',jobId)
  .order('submitted_at',{ascending:false});
 if(error)throw error;
 return (data??[]) as EmployerJobApplication[];
}
export async function updateEmployerJobApplicationStatus(applicationId:string,status:EmployerApplicationStatus){
 await currentUser();
 const {error}=await supabase
  .from('job_applications')
  .update({status,updated_at:new Date().toISOString()})
  .eq('id',applicationId);
 if(error)throw error;
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
