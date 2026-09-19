import { supabase } from '@/lib/supabase';

export type Job = {
 id:string; title:string; company_name:string; description:string; location_text:string|null; city:string|null; state:string|null; postal_code:string|null;
 workplace_type:string; employment_type:string; pay_min:number|null; pay_max:number|null; pay_period:string|null; benefits:string[]; skills:string[]; requirements:string[];
 background_policy_summary:string|null; eligibility_rules:Record<string,unknown>; application_method:string; external_apply_url:string|null;
 source_label:string; source_url:string|null; featured:boolean; created_at:string; latitude:number|null; longitude:number|null; location_precision:string|null;
 easy_apply_enabled?:boolean; application_questions?:{id:string;label:string;type:'text'|'yes_no';required?:boolean}[];
};
export type HousingListing = {
 id:string; title:string; description:string; property_type:string; address_line1:string|null; address_line2:string|null; city:string; state:string; postal_code:string|null;
 bedrooms:number|null; bathrooms:number|null; square_feet:number|null; rent_monthly:number; deposit_amount:number|null; application_fee:number|null; available_date:string|null;
 lease_terms:string[]; amenities:string[]; utilities_included:string[]; pet_policy:string|null; parking:string|null; screening_summary:string|null;
 virtual_tour_url:string|null; floor_plan_url:string|null; video_url:string|null; fasttrack_enabled:boolean; featured:boolean; source_label:string; source_url:string|null;
 housing_media?:{url:string;media_type:string;sort_order:number}[];
};
export type MarketplaceItem = {
 id:string; title:string; description:string; category:string; condition:string|null; price:number; is_free:boolean; city:string; state:string; pickup_notes:string|null;
 safe_pickup:boolean; created_at:string; marketplace_media?:{url:string;sort_order:number}[];
};

type JobFilters={remote?:boolean;fullTime?:boolean;partTime?:boolean;secondChance?:boolean};
export async function loadJobs(search='',location='',filters:JobFilters={}){
 let q=supabase.from('jobs').select('id,title,company_name,description,location_text,city,state,postal_code,workplace_type,employment_type,pay_min,pay_max,pay_period,benefits,skills,requirements,background_policy_summary,eligibility_rules,application_method,external_apply_url,source_label,source_url,featured,created_at,latitude,longitude,location_precision,easy_apply_enabled,application_questions').eq('status','published').order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(100);
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
 const {data,error}=await supabase.from('jobs').select('id,title,company_name,description,location_text,city,state,postal_code,workplace_type,employment_type,pay_min,pay_max,pay_period,benefits,skills,requirements,background_policy_summary,eligibility_rules,application_method,external_apply_url,source_label,source_url,featured,created_at,latitude,longitude,location_precision,easy_apply_enabled,application_questions').eq('id',id).single();
 if(error)throw error;return data as Job;
}
export async function loadHousing(search='',location=''){
 let q=supabase.from('housing_listings').select('id,title,description,property_type,address_line1,address_line2,city,state,postal_code,bedrooms,bathrooms,square_feet,rent_monthly,deposit_amount,application_fee,available_date,lease_terms,amenities,utilities_included,pet_policy,parking,screening_summary,virtual_tour_url,floor_plan_url,video_url,fasttrack_enabled,featured,source_label,source_url,housing_media(url,media_type,sort_order)').eq('status','published').order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(100);
 if(search.trim())q=q.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
 if(location.trim())q=q.or(`city.ilike.%${location.trim()}%,state.ilike.%${location.trim()}%,postal_code.ilike.%${location.trim()}%`);
 const {data,error}=await q;if(error)throw error;return (data??[]) as HousingListing[];
}
export async function loadHousingListing(id:string){
 const {data,error}=await supabase.from('housing_listings').select('id,title,description,property_type,address_line1,address_line2,city,state,postal_code,bedrooms,bathrooms,square_feet,rent_monthly,deposit_amount,application_fee,available_date,lease_terms,amenities,utilities_included,pet_policy,parking,screening_summary,virtual_tour_url,floor_plan_url,video_url,fasttrack_enabled,featured,source_label,source_url,housing_media(url,media_type,sort_order)').eq('id',id).single();
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
export async function saveJob(jobId:string){const user=await currentUser();const {error}=await supabase.from('saved_jobs').upsert({user_id:user.id,job_id:jobId});if(error)throw error;}
export async function saveHousing(listingId:string){const user=await currentUser();const {error}=await supabase.from('saved_housing').upsert({user_id:user.id,listing_id:listingId});if(error)throw error;}
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
export async function submitJobApplication(jobId:string,answers:Record<string,unknown>={}){const user=await currentUser();const {error}=await supabase.from('job_applications').upsert({user_id:user.id,job_id:jobId,status:'submitted',answers,submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'user_id,job_id'});if(error)throw error;}
export async function submitHousingApplication(listingId:string,fastTrack=false){const user=await currentUser();const {error}=await supabase.from('housing_applications').upsert({user_id:user.id,listing_id:listingId,application_type:fastTrack?'fasttrack':'standard',status:'submitted',submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'user_id,listing_id'});if(error)throw error;}
export async function claimMarketplaceItem(itemId:string){const user=await currentUser();const {data:existing,error:findError}=await supabase.from('marketplace_claims').select('id,status').eq('item_id',itemId).eq('claimant_id',user.id).in('status',['requested','approved','ready']).maybeSingle();if(findError)throw findError;if(existing)return existing;const {data,error}=await supabase.from('marketplace_claims').insert({item_id:itemId,claimant_id:user.id,status:'requested',pickup_deadline:new Date(Date.now()+48*60*60*1000).toISOString()}).select('id,status').single();if(error)throw error;return data;}
