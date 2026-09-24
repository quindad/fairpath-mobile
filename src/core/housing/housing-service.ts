import { supabase } from '@/lib/supabase';
import { isTodayOrFutureDateText, isValidDateText, isValidEmail } from '@/core/forms/formatters';
import { currentUser } from '@/core/supabase/current-user';
import { trackProductEvent } from '@/core/analytics/product-events';

export type HousingListing = {
 id:string; title:string; description:string; property_type:string; address_line1:string|null; address_line2:string|null; city:string; state:string; postal_code:string|null; created_at:string;
 bedrooms:number|null; bathrooms:number|null; square_feet:number|null; rent_monthly:number; deposit_amount:number|null; application_fee:number|null; available_date:string|null;
 lease_terms:string[]; amenities:string[]; utilities_included:string[]; pet_policy:string|null; parking:string|null; accessibility_features:string[]; screening_summary:string|null; eligibility_rules:Record<string,unknown>;
 virtual_tour_url:string|null; floor_plan_url:string|null; video_url:string|null; fasttrack_enabled:boolean; required_application_documents:string[]; featured:boolean; source_label:string; source_url:string|null;
 latitude:number|null; longitude:number|null; garage_spaces:number|null; parking_types:string[]; furnished:boolean; has_basement:boolean; has_yard:boolean; has_balcony_patio:boolean; laundry_type:string|null; has_central_air:boolean; pet_types:string[]; move_in_ready:boolean; walk_score:number|null; transit_score:number|null; bike_score:number|null; neighborhood_data_provider:string|null; housing_media?:{url:string;media_type:string;sort_order:number}[]; housing_schools?:{provider:string;provider_school_id:string;name:string;school_type:string|null;grades:string|null;distance_miles:number|null;quality_label:string|null;profile_url:string|null;sort_order:number}[]; housing_nearby_places?:{provider:string;provider_place_id:string;category:string;name:string;distance_miles:number|null;sort_order:number}[];
};

const HOUSING_COLUMNS='id,title,description,property_type,address_line1,address_line2,city,state,postal_code,created_at,bedrooms,bathrooms,square_feet,rent_monthly,deposit_amount,application_fee,available_date,lease_terms,amenities,utilities_included,pet_policy,parking,accessibility_features,screening_summary,eligibility_rules,virtual_tour_url,floor_plan_url,video_url,fasttrack_enabled,required_application_documents,featured,source_label,source_url,latitude,longitude,garage_spaces,parking_types,furnished,has_basement,has_yard,has_balcony_patio,laundry_type,has_central_air,pet_types,move_in_ready,walk_score,transit_score,bike_score,neighborhood_data_provider,housing_media(url,media_type,sort_order),housing_schools(provider,provider_school_id,name,school_type,grades,distance_miles,quality_label,profile_url,sort_order),housing_nearby_places(provider,provider_place_id,category,name,distance_miles,sort_order)';

const STATE_CODES:Record<string,string>={ohio:'OH',maryland:'MD',michigan:'MI',pennsylvania:'PA',indiana:'IN',kentucky:'KY','west virginia':'WV',virginia:'VA','new york':'NY','new jersey':'NJ',delaware:'DE','district of columbia':'DC'};
function parseHousingLocation(raw:string){const text=raw.trim().replace(/\s+/g,' ');if(!text)return null;if(/^\d{5}$/.test(text))return {postal:text};const comma=text.split(',').map(x=>x.trim()).filter(Boolean);if(comma.length>=2){const city=comma[0];const stateRaw=comma[comma.length-1].toLowerCase();const state=stateRaw.length===2?stateRaw.toUpperCase():STATE_CODES[stateRaw];return {city,state}}const parts=text.split(' ');const last=parts[parts.length-1].toLowerCase();const state=last.length===2?last.toUpperCase():STATE_CODES[last];if(state&&parts.length>1)return {city:parts.slice(0,-1).join(' '),state};for(const [name,code] of Object.entries(STATE_CODES)){if(text.toLowerCase().endsWith(' '+name))return {city:text.slice(0,-name.length).trim(),state:code}}return {free:text}}

export async function loadHousing(search='',location=''){
 let q=supabase.from('housing_listings').select(HOUSING_COLUMNS).eq('status','published').order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(100);
 const term=search.trim();if(term)q=q.or(`title.ilike.%${term}%,description.ilike.%${term}%,property_type.ilike.%${term}%`);
 const loc=parseHousingLocation(location);if(loc){if('postal' in loc&&loc.postal)q=q.eq('postal_code',loc.postal);else if('city' in loc&&loc.city){q=q.ilike('city','%'+loc.city+'%');if(loc.state)q=q.eq('state',loc.state)}else if('free' in loc&&loc.free)q=q.or(`city.ilike.%${loc.free}%,state.ilike.%${loc.free}%,postal_code.ilike.%${loc.free}%`)}
 const {data,error}=await q;if(error)throw error;return (data??[]) as HousingListing[];
}
export async function loadHousingListing(id:string){
 const {data,error}=await supabase.from('housing_listings').select(HOUSING_COLUMNS).eq('id',id).single();
 if(error)throw error;return data as HousingListing;
}

export async function saveHousing(listingId:string){const user=await currentUser();const {error}=await supabase.from('saved_housing').insert({user_id:user.id,listing_id:listingId});if(error&&error.code!=='23505')throw error;}
export async function unsaveHousing(listingId:string){const user=await currentUser();const {error}=await supabase.from('saved_housing').delete().eq('user_id',user.id).eq('listing_id',listingId);if(error)throw error;}
export async function isHousingSaved(listingId:string){const user=await currentUser();const {data,error}=await supabase.from('saved_housing').select('listing_id').eq('user_id',user.id).eq('listing_id',listingId).maybeSingle();if(error)throw error;return Boolean(data);}
export async function loadSavedHousingIds():Promise<string[]>{const user=await currentUser();const {data,error}=await supabase.from('saved_housing').select('listing_id').eq('user_id',user.id);if(error)throw error;return (data??[]).map(row=>row.listing_id as string);}

export type HousingTourRequest={id:string;listing_id:string;preferred_date:string;preferred_window:'morning'|'afternoon'|'evening'|'flexible';note:string|null;status:'requested'|'confirmed'|'declined'|'completed'|'cancelled';confirmed_date:string|null;confirmed_window:string|null;partner_note:string|null;created_at:string;updated_at:string};
export async function createHousingTourRequest(input:{listingId:string;preferredDate:string;preferredWindow:HousingTourRequest['preferred_window'];note?:string}){
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_tour_requests').insert({user_id:user.id,listing_id:input.listingId,preferred_date:input.preferredDate,preferred_window:input.preferredWindow,note:input.note?.trim()||null}).select('id,listing_id,preferred_date,preferred_window,note,status,confirmed_date,confirmed_window,partner_note,created_at,updated_at').single();
 if(error)throw error;void trackProductEvent('housing_tour_requested','housing',input.listingId,{request_id:data?.id}).catch(()=>{});return data as HousingTourRequest;
}
export async function loadMyHousingTours():Promise<HousingTourRequest[]>{
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_tour_requests').select('id,listing_id,preferred_date,preferred_window,note,status,confirmed_date,confirmed_window,partner_note,created_at,updated_at').eq('user_id',user.id).order('updated_at',{ascending:false});
 if(error)throw error;return (data??[]) as HousingTourRequest[];
}
export async function cancelHousingTourRequest(id:string){
 const user=await currentUser();const {error}=await supabase.from('housing_tour_requests').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id).eq('status','requested');if(error)throw error;
}
export type HousingInquiry={id:string;listing_id:string;subject:string;message:string;status:'open'|'responded'|'closed';response_message:string|null;responded_at:string|null;created_at:string;updated_at:string;listing:{id:string;title:string;city:string;state:string}|null};
export async function loadMyHousingInquiries():Promise<HousingInquiry[]>{
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_inquiries').select('id,listing_id,subject,message,status,response_message,responded_at,created_at,updated_at,listing:housing_listings(id,title,city,state)').eq('user_id',user.id).order('updated_at',{ascending:false});
 if(error)throw error;return (data??[]) as unknown as HousingInquiry[];
}
export async function createHousingInquiry(input:{listingId:string;subject?:string;message:string}){
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_inquiries').insert({user_id:user.id,listing_id:input.listingId,subject:input.subject?.trim()||'Question about this home',message:input.message.trim()}).select('id,status,created_at').single();
 if(error)throw error;void trackProductEvent('housing_inquiry_sent','housing',input.listingId,{inquiry_id:data?.id}).catch(()=>{});return data as {id:string;status:string;created_at:string};
}
export async function createHousingReport(input:{listingId:string;reason:'incorrect_info'|'suspected_scam'|'unavailable'|'discrimination_concern'|'safety_concern'|'other';details?:string}){
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_reports').insert({user_id:user.id,listing_id:input.listingId,reason:input.reason,details:input.details?.trim()||null}).select('id,status,created_at').single();
 if(error)throw error;void trackProductEvent('housing_listing_reported','housing',input.listingId,{report_id:data?.id,reason:input.reason}).catch(()=>{});return data as {id:string;status:string;created_at:string};
}

export async function loadSavedHousing():Promise<HousingListing[]>{
 const user=await currentUser();
 const {data,error}=await supabase.from('saved_housing').select('listing:housing_listings('+HOUSING_COLUMNS+')').eq('user_id',user.id).order('created_at',{ascending:false});
 if(error)throw error;return (data??[]).map((row:any)=>row.listing).filter(Boolean) as HousingListing[];
}
export type SavedHousingSearch={id:string;name:string;query:string;location:string;filters:Record<string,string|boolean|number>;created_at:string;updated_at:string};
export async function saveHousingSearch(input:{name?:string;query:string;location:string;filters:Record<string,string|boolean|number>}){
 const user=await currentUser();const now=new Date().toISOString();
 const {data,error}=await supabase.from('saved_housing_searches').insert({user_id:user.id,name:input.name?.trim()||'Housing search',query:input.query.trim(),location:input.location.trim(),filters:input.filters,updated_at:now}).select('id,name,query,location,filters,created_at,updated_at').single();
 if(error)throw error;return data as SavedHousingSearch;
}
export async function loadSavedHousingSearches():Promise<SavedHousingSearch[]>{
 const user=await currentUser();const {data,error}=await supabase.from('saved_housing_searches').select('id,name,query,location,filters,created_at,updated_at').eq('user_id',user.id).order('updated_at',{ascending:false});if(error)throw error;return (data??[]) as SavedHousingSearch[];
}
export async function deleteSavedHousingSearch(id:string){const user=await currentUser();const {error}=await supabase.from('saved_housing_searches').delete().eq('id',id).eq('user_id',user.id);if(error)throw error;}

export type MyHousingApplication={id:string;listing_id:string;status:HousingApplicationStatus;application_type:'standard'|'fasttrack';current_step:number;submitted_at:string|null;updated_at:string;listing:{id:string;title:string;city:string;state:string;rent_monthly:number;bedrooms:number|null;bathrooms:number|null;fasttrack_enabled:boolean;required_application_documents:string[]}|null};
export async function loadMyHousingApplications():Promise<MyHousingApplication[]>{
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_applications').select('id,listing_id,status,application_type,current_step,submitted_at,updated_at,listing:housing_listings(id,title,city,state,rent_monthly,bedrooms,bathrooms,fasttrack_enabled,required_application_documents)').eq('user_id',user.id).order('updated_at',{ascending:false});
 if(error)throw error;return (data??[]) as unknown as MyHousingApplication[];
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
 void trackProductEvent('housing_application_started','housing',listingId,{mode:fastTrack?'fasttrack':'standard',application_id:data?.id}).catch(()=>{});
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
 if(!isValidDateText(form.move_in_date,{allowFuture:true})||!isTodayOrFutureDateText(form.move_in_date))errors.move_in_date='Choose today or a future move-in date.';
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
 await currentUser();
 const {data,error}=await supabase.rpc('submit_housing_application',{
  p_application_id:applicationId,
  p_answers:form,
  p_consent:consent
 });
 if(error){
  if(error.message?.includes('CONSENT_REQUIRED'))throw new Error('CONSENT_REQUIRED');
  if(error.message?.includes('FASTTRACK_ACK_REQUIRED'))throw new Error('FASTTRACK_ACK_REQUIRED');
  if(error.message?.includes('REQUIRED_DOCUMENTS_MISSING'))throw new Error('REQUIRED_DOCUMENTS_MISSING');
  if(error.message?.includes('APPLICATION_INCOMPLETE'))throw new Error('APPLICATION_INCOMPLETE');
  if(error.message?.includes('PAYMENT_REQUIRED'))throw new Error('PAYMENT_REQUIRED');
  if(error.message?.includes('APPLICATION_NOT_SUBMITTABLE'))throw new Error('APPLICATION_NOT_SUBMITTABLE');
  throw error;
 }
 const row=Array.isArray(data)?data[0]:data;
 if(!row||row.status!=='submitted'||!row.submitted_at)throw new Error('SUBMIT_NOT_CONFIRMED');
 void trackProductEvent('housing_application_submitted','housing_application',applicationId).catch(()=>{});
 return row as {id:string;status:'submitted';submitted_at:string};
}
export type HousingApplicationEvent={id:string;event_type:string;metadata:Record<string,unknown>;created_at:string};
export async function loadHousingApplicationEvents(applicationId:string):Promise<HousingApplicationEvent[]>{
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_application_events').select('id,event_type,metadata,created_at').eq('application_id',applicationId).order('created_at',{ascending:true});
 if(error)throw error;
 return (data??[]) as HousingApplicationEvent[];
}

export type HousingApplicationDocument={id:string;application_id:string;document_type:'identity'|'income'|'employment'|'housing_history'|'other';file_name:string;storage_path:string;mime_type:string|null;size_bytes:number|null;status:'uploaded'|'reviewed'|'accepted'|'rejected';rejection_reason:string|null;created_at:string;updated_at:string};
export async function loadHousingApplicationDocuments(applicationId:string):Promise<HousingApplicationDocument[]>{
 const user=await currentUser();
 const {data,error}=await supabase.from('housing_application_documents').select('id,application_id,document_type,file_name,storage_path,mime_type,size_bytes,status,rejection_reason,created_at,updated_at').eq('application_id',applicationId).eq('user_id',user.id).order('created_at',{ascending:false});
 if(error)throw error;return (data??[]) as HousingApplicationDocument[];
}
export async function uploadHousingApplicationDocument(input:{applicationId:string;documentType:HousingApplicationDocument['document_type'];fileName:string;mimeType?:string|null;sizeBytes?:number|null;bytes:ArrayBuffer}){
 const user=await currentUser();
 const safeName=input.fileName.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120)||'document';
 const storagePath=user.id+'/'+input.applicationId+'/'+Date.now()+'-'+safeName;
 const {error:uploadError}=await supabase.storage.from('housing-application-documents').upload(storagePath,input.bytes,{contentType:input.mimeType??undefined,upsert:false});
 if(uploadError)throw uploadError;
 const {data,error}=await supabase.from('housing_application_documents').insert({application_id:input.applicationId,user_id:user.id,document_type:input.documentType,file_name:input.fileName,storage_path:storagePath,mime_type:input.mimeType??null,size_bytes:input.sizeBytes??null,status:'uploaded'}).select('id,application_id,document_type,file_name,storage_path,mime_type,size_bytes,status,rejection_reason,created_at,updated_at').single();
 if(error){await supabase.storage.from('housing-application-documents').remove([storagePath]);throw error}
 return data as HousingApplicationDocument;
}
export async function deleteHousingApplicationDocument(document:HousingApplicationDocument){
 const user=await currentUser();
 const {error:fileError}=await supabase.storage.from('housing-application-documents').remove([document.storage_path]);if(fileError)throw fileError;
 const {error}=await supabase.from('housing_application_documents').delete().eq('id',document.id).eq('user_id',user.id).eq('status','uploaded');if(error)throw error;
}
export type FastTrackQuote={order_id:string;base_amount_cents:number;discount_cents:number;amount_due_cents:number;status:'requires_payment'|'paid'|'waived'|'refunded'|'cancelled';payment_enforced:boolean};
export async function loadFastTrackQuote(applicationId:string):Promise<FastTrackQuote>{
 await currentUser();
 const {data,error}=await supabase.rpc('quote_housing_fasttrack',{p_application_id:applicationId});
 if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('QUOTE_UNAVAILABLE');return row as FastTrackQuote;
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
