import { supabase } from '@/lib/supabase';

export type OffenseCatalogItem={
 id:string;
 jurisdiction_type:'federal'|'state'|'territory'|'local';
 state_code:string|null;
 jurisdiction_name:string;
 offense_code:string;
 offense_title:string;
 offense_level:string|null;
 offense_degree:string|null;
 offense_class:string|null;
 offense_category:string|null;
 description:string|null;
 source_agency:string|null;
 source_url:string;
 effective_start:string|null;
 effective_end:string|null;
 active:boolean;
 aliases:string[];
 search_terms:string[];
 last_verified_at:string|null;
};

export type UserConviction={
 id:string;
 user_id:string;
 offense_catalog_id:string|null;
 jurisdiction_type:'federal'|'state'|'territory'|'local';
 state_code:string|null;
 county:string|null;
 court_name:string|null;
 case_number:string|null;
 offense_code:string|null;
 offense_title:string;
 offense_level:string|null;
 offense_degree:string|null;
 offense_class:string|null;
 disposition:string|null;
 conviction_date:string|null;
 sentence_date:string|null;
 sentence_summary:string|null;
 release_date:string|null;
 supervision_status:string|null;
 source_type:'self_reported'|'document'|'official_record'|'partner_verified';
 verification_state:'self_reported'|'user_confirmed'|'document_verified'|'official_record_verified'|'needs_review';
 source_reference:string|null;
 share_with_employers:boolean;
 user_notes:string|null;
 created_at:string;
 updated_at:string;
};

async function currentUser(){
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)throw new Error('SIGNED_OUT');
 return user;
}

export async function searchOffenseCatalog(query:string,stateCode?:string){
 const term=query.trim();
 if(term.length<2)return [] as OffenseCatalogItem[];
 let q=supabase.from('offense_catalog')
  .select('id,jurisdiction_type,state_code,jurisdiction_name,offense_code,offense_title,offense_level,offense_degree,offense_class,offense_category,description,source_agency,source_url,effective_start,effective_end,active,aliases,search_terms,last_verified_at')
  .eq('active',true)
  .or(`offense_title.ilike.%${term}%,offense_code.ilike.%${term}%`)
  .limit(25);
 if(stateCode)q=q.eq('state_code',stateCode.toUpperCase());
 const {data,error}=await q;
 if(error)throw error;
 return (data??[]) as OffenseCatalogItem[];
}

export async function loadMyConvictions(){
 const user=await currentUser();
 const {data,error}=await supabase.from('user_convictions')
  .select('*')
  .eq('user_id',user.id)
  .order('conviction_date',{ascending:false});
 if(error)throw error;
 return (data??[]) as UserConviction[];
}

export type SaveConvictionInput={
 id?:string;
 offense_catalog_id?:string|null;
 jurisdiction_type:'federal'|'state'|'territory'|'local';
 state_code?:string|null;
 county?:string|null;
 court_name?:string|null;
 case_number?:string|null;
 offense_code?:string|null;
 offense_title:string;
 offense_level?:string|null;
 offense_degree?:string|null;
 offense_class?:string|null;
 disposition?:string|null;
 conviction_date?:string|null;
 sentence_date?:string|null;
 sentence_summary?:string|null;
 release_date?:string|null;
 supervision_status?:string|null;
 source_type?:'self_reported'|'document'|'official_record'|'partner_verified';
 verification_state?:'self_reported'|'user_confirmed'|'document_verified'|'official_record_verified'|'needs_review';
 source_reference?:string|null;
 share_with_employers?:boolean;
 user_notes?:string|null;
};

export async function saveMyConviction(input:SaveConvictionInput){
 const user=await currentUser();
 const payload={
  user_id:user.id,
  offense_catalog_id:input.offense_catalog_id??null,
  jurisdiction_type:input.jurisdiction_type,
  state_code:input.state_code??null,
  county:input.county??null,
  court_name:input.court_name??null,
  case_number:input.case_number??null,
  offense_code:input.offense_code??null,
  offense_title:input.offense_title.trim(),
  offense_level:input.offense_level??null,
  offense_degree:input.offense_degree??null,
  offense_class:input.offense_class??null,
  disposition:input.disposition??null,
  conviction_date:input.conviction_date??null,
  sentence_date:input.sentence_date??null,
  sentence_summary:input.sentence_summary??null,
  release_date:input.release_date??null,
  supervision_status:input.supervision_status??null,
  source_type:input.source_type??'self_reported',
  verification_state:input.verification_state??'self_reported',
  source_reference:input.source_reference??null,
  share_with_employers:input.share_with_employers??false,
  user_notes:input.user_notes??null,
  updated_at:new Date().toISOString()
 };
 if(input.id){
  const {data,error}=await supabase.from('user_convictions').update(payload).eq('id',input.id).eq('user_id',user.id).select('*').single();
  if(error)throw error;
  return data as UserConviction;
 }
 const {data,error}=await supabase.from('user_convictions').insert(payload).select('*').single();
 if(error)throw error;
 return data as UserConviction;
}
