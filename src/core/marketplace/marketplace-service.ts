import { supabase } from '@/lib/supabase';

export const MARKETPLACE_CATEGORIES=[
 'Furniture','Home','Electronics','Appliances','Clothing','Kids & Baby','Tools','Sports & Outdoors','Books & Media','Auto Parts','Other'
] as const;
export const MARKETPLACE_CONDITIONS=['New','Like new','Good','Fair','Needs repair'] as const;

export type MarketplaceItem={
 id:string;
 seller_id:string;
 title:string;
 description:string;
 category:string;
 condition:string|null;
 price:number;
 is_free:boolean;
 city:string;
 state:string;
 postal_code:string|null;
 pickup_area:string|null;
 pickup_notes:string|null;
 safe_pickup:boolean;
 quantity:number;
 featured:boolean;
 seller_type:'individual'|'organization';
 moderation_status:'approved'|'pending'|'hidden'|'rejected';
 status:'draft'|'available'|'paused'|'pending_pickup'|'claimed'|'removed';
 created_at:string;
 updated_at:string;
 listed_at:string|null;
 marketplace_media?:MarketplaceMedia[];
};

export type MarketplaceMedia={id:string;url:string;sort_order:number;storage_path:string|null;mime_type:string|null};
export type MarketplaceQuota={plan:'free'|'fairpath_plus';monthly_limit:number;used:number;remaining:number;period_start:string;period_end:string};
export type MarketplaceClaimStatus='requested'|'approved'|'ready'|'picked_up'|'cancelled'|'expired'|'declined'|'no_show';
export type MarketplaceClaim={
 id:string;item_id:string;status:MarketplaceClaimStatus;claimant_message:string|null;pickup_deadline:string|null;pickup_code:string|null;
 created_at:string;updated_at:string;
 item:{id:string;title:string;city:string;state:string;pickup_area:string|null;safe_pickup:boolean;status:string;marketplace_media?:MarketplaceMedia[]}|null;
};
export type MarketplaceClaimCandidate={id:string;status:MarketplaceClaimStatus;claimant_label:string;claimant_message:string|null;created_at:string;pickup_deadline:string|null};
export type MarketplaceClaimReceipt={
 id:string;status:MarketplaceClaimStatus;pickup_deadline:string|null;pickup_code:string|null;
 item_id:string;item_title:string;item_city:string;item_state:string;
 location_name:string|null;address_line1:string|null;address_line2:string|null;city:string|null;state:string|null;postal_code:string|null;instructions:string|null;contact_phone:string|null;
};
export type MarketplaceClaimEvent={id:string;event_type:string;metadata:Record<string,unknown>;created_at:string};
export type MarketplaceMessage={id:string;claim_id:string;sender_id:string;body:string;created_at:string};

async function currentUser(){const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('SIGNED_OUT');return user}

const ITEM_SELECT='id,seller_id,title,description,category,condition,price,is_free,city,state,postal_code,pickup_area,pickup_notes,safe_pickup,quantity,featured,seller_type,moderation_status,status,created_at,updated_at,listed_at,marketplace_media(id,url,sort_order,storage_path,mime_type)';

const MARKET_STATE_CODES:Record<string,string>={ohio:'OH',maryland:'MD',michigan:'MI',pennsylvania:'PA',indiana:'IN',kentucky:'KY','west virginia':'WV',virginia:'VA','new york':'NY','new jersey':'NJ',delaware:'DE','district of columbia':'DC'};
function parseMarketplaceLocation(raw:string){const text=raw.trim().replace(/\s+/g,' ');if(!text)return null;if(/^\d{5}$/.test(text))return {postal:text};const comma=text.split(',').map(x=>x.trim()).filter(Boolean);if(comma.length>=2){const stateRaw=comma[comma.length-1].toLowerCase();return {city:comma[0],state:stateRaw.length===2?stateRaw.toUpperCase():MARKET_STATE_CODES[stateRaw]}}const parts=text.split(' ');const last=parts[parts.length-1].toLowerCase();const state=last.length===2?last.toUpperCase():MARKET_STATE_CODES[last];if(state&&parts.length>1)return {city:parts.slice(0,-1).join(' '),state};for(const [name,code] of Object.entries(MARKET_STATE_CODES)){if(text.toLowerCase().endsWith(' '+name))return {city:text.slice(0,-name.length).trim(),state:code}}return {free:text}}
export async function loadMarketplace(input:{search?:string;category?:string;location?:string;safePickup?:boolean;condition?:string;sort?:'newest'|'oldest'}={}):Promise<MarketplaceItem[]>{
 let q=supabase.from('marketplace_items').select(ITEM_SELECT).eq('status','available').eq('moderation_status','approved').order('featured',{ascending:false}).order('created_at',{ascending:input.sort==='oldest'}).limit(100);
 const search=input.search?.trim();if(search)q=q.or(`title.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`);
 if(input.category)q=q.eq('category',input.category);
 if(input.condition)q=q.eq('condition',input.condition);
 if(input.safePickup)q=q.eq('safe_pickup',true);
 const loc=parseMarketplaceLocation(input.location??'');if(loc){
  if('postal' in loc&&loc.postal)q=q.eq('postal_code',loc.postal);
  else if('city' in loc&&loc.city){q=q.ilike('city','%'+loc.city+'%');if(loc.state)q=q.eq('state',loc.state)}
  else if('free' in loc&&loc.free)q=q.or(`city.ilike.%${loc.free}%,state.ilike.%${loc.free}%,postal_code.ilike.%${loc.free}%,pickup_area.ilike.%${loc.free}%`);
 }
 const {data,error}=await q;if(error)throw error;return (data??[]) as unknown as MarketplaceItem[];
}

export async function loadMarketplaceItem(id:string):Promise<MarketplaceItem>{
 const {data,error}=await supabase.from('marketplace_items').select(ITEM_SELECT).eq('id',id).single();
 if(error)throw error;return data as unknown as MarketplaceItem;
}

export async function loadMarketplaceViewerState(itemId:string):Promise<{signedIn:boolean;userId:string|null;isOwner:boolean;saved:boolean;claim:{id:string;status:MarketplaceClaimStatus;pickup_deadline:string|null}|null;quota:MarketplaceQuota|null}>{
 const {data:{user}}=await supabase.auth.getUser();if(!user)return {signedIn:false,userId:null,isOwner:false,saved:false,claim:null,quota:null};
 const [itemSave,claim,quota]=await Promise.all([
  supabase.from('marketplace_saves').select('item_id').eq('user_id',user.id).eq('item_id',itemId).maybeSingle(),
  supabase.from('marketplace_claims').select('id,status,pickup_deadline').eq('claimant_id',user.id).eq('item_id',itemId).maybeSingle(),
  loadMarketplaceQuota().catch(()=>null)
 ]);
 const {data:item}=await supabase.from('marketplace_items').select('seller_id').eq('id',itemId).maybeSingle();
 return {signedIn:true,userId:user.id,isOwner:item?.seller_id===user.id,saved:Boolean(itemSave.data),claim:claim.data as any,quota};
}

export async function loadMarketplaceQuota():Promise<MarketplaceQuota>{
 await currentUser();const {data,error}=await supabase.rpc('marketplace_claim_quota');if(error)throw error;
 const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('QUOTA_UNAVAILABLE');return row as MarketplaceQuota;
}

export async function requestMarketplaceClaim(itemId:string,message=''){
 await currentUser();const {data,error}=await supabase.rpc('request_marketplace_claim',{p_item_id:itemId,p_message:message.trim()||null});
 if(error){if(error.message?.includes('CLAIM_LIMIT_REACHED'))throw new Error('CLAIM_LIMIT_REACHED');if(error.message?.includes('OWN_ITEM'))throw new Error('OWN_ITEM');if(error.message?.includes('ITEM_UNAVAILABLE'))throw new Error('ITEM_UNAVAILABLE');throw error}
 return (Array.isArray(data)?data[0]:data) as {id:string;status:MarketplaceClaimStatus;created_at:string};
}

export async function loadMyMarketplaceClaimForItem(itemId:string):Promise<{id:string;status:MarketplaceClaimStatus;pickup_deadline:string|null}|null>{
 const user=await currentUser();const {data,error}=await supabase.from('marketplace_claims').select('id,status,pickup_deadline').eq('item_id',itemId).eq('claimant_id',user.id).maybeSingle();if(error)throw error;return data as any;
}

export async function refreshExpiredMarketplacePickups(){await currentUser();const {error}=await supabase.rpc('expire_marketplace_pickups');if(error)throw error}

export async function loadMyMarketplaceClaims():Promise<MarketplaceClaim[]>{
 await refreshExpiredMarketplacePickups().catch(()=>{});const user=await currentUser();const {data,error}=await supabase.from('marketplace_claims').select('id,item_id,status,claimant_message,pickup_deadline,pickup_code,created_at,updated_at,item:marketplace_items(id,title,city,state,pickup_area,safe_pickup,status,marketplace_media(id,url,sort_order))').eq('claimant_id',user.id).order('created_at',{ascending:false});if(error)throw error;return (data??[]) as unknown as MarketplaceClaim[];
}

export async function loadMarketplaceClaimReceipt(claimId:string):Promise<MarketplaceClaimReceipt>{
 await currentUser();const {data,error}=await supabase.rpc('marketplace_claim_receipt',{p_claim_id:claimId});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('CLAIM_NOT_FOUND');return row as MarketplaceClaimReceipt;
}

export async function loadMarketplaceClaimEvents(claimId:string):Promise<MarketplaceClaimEvent[]>{
 await currentUser();const {data,error}=await supabase.from('marketplace_claim_events').select('id,event_type,metadata,created_at').eq('claim_id',claimId).order('created_at',{ascending:true});if(error)throw error;return (data??[]) as MarketplaceClaimEvent[];
}

export async function cancelMarketplaceClaim(claimId:string){await currentUser();const {error}=await supabase.rpc('cancel_marketplace_claim',{p_claim_id:claimId});if(error)throw error}

export async function loadMarketplaceClaimCandidates(itemId:string):Promise<MarketplaceClaimCandidate[]>{
 await refreshExpiredMarketplacePickups().catch(()=>{});await currentUser();const {data,error}=await supabase.rpc('marketplace_claim_candidates',{p_item_id:itemId});if(error)throw error;return (data??[]) as MarketplaceClaimCandidate[];
}
export async function approveMarketplaceClaim(claimId:string){await currentUser();const {data,error}=await supabase.rpc('approve_marketplace_claim',{p_claim_id:claimId});if(error)throw error;return Array.isArray(data)?data[0]:data}
export async function declineMarketplaceClaim(claimId:string){await currentUser();const {error}=await supabase.rpc('decline_marketplace_claim',{p_claim_id:claimId});if(error)throw error}
export async function markMarketplaceClaimReady(claimId:string){await currentUser();const {error}=await supabase.rpc('mark_marketplace_claim_ready',{p_claim_id:claimId});if(error)throw error}
export async function verifyMarketplacePickup(claimId:string,code:string){await currentUser();const {error}=await supabase.rpc('verify_marketplace_pickup',{p_claim_id:claimId,p_code:code.trim()});if(error){if(error.message?.includes('INVALID_PICKUP_CODE'))throw new Error('INVALID_PICKUP_CODE');throw error}}
export async function markMarketplaceNoShow(claimId:string){await currentUser();const {error}=await supabase.rpc('mark_marketplace_no_show',{p_claim_id:claimId});if(error){if(error.message?.includes('PICKUP_WINDOW_ACTIVE'))throw new Error('PICKUP_WINDOW_ACTIVE');throw error}}

export async function saveMarketplaceItem(itemId:string){const user=await currentUser();const {error}=await supabase.from('marketplace_saves').upsert({user_id:user.id,item_id:itemId});if(error)throw error}
export async function unsaveMarketplaceItem(itemId:string){const user=await currentUser();const {error}=await supabase.from('marketplace_saves').delete().eq('user_id',user.id).eq('item_id',itemId);if(error)throw error}
export async function isMarketplaceItemSaved(itemId:string){const user=await currentUser();const {data,error}=await supabase.from('marketplace_saves').select('item_id').eq('user_id',user.id).eq('item_id',itemId).maybeSingle();if(error)throw error;return Boolean(data)}
export async function loadSavedMarketplaceIds():Promise<string[]>{const user=await currentUser();const {data,error}=await supabase.from('marketplace_saves').select('item_id').eq('user_id',user.id);if(error)throw error;return (data??[]).map(x=>x.item_id as string)}
export async function loadSavedMarketplaceItems():Promise<MarketplaceItem[]>{const user=await currentUser();const {data,error}=await supabase.from('marketplace_saves').select(`item:marketplace_items(${ITEM_SELECT})`).eq('user_id',user.id).order('created_at',{ascending:false});if(error)throw error;return (data??[]).map((x:any)=>x.item).filter(Boolean) as MarketplaceItem[]}

export async function loadMyMarketplaceListings():Promise<MarketplaceItem[]>{
 await refreshExpiredMarketplacePickups().catch(()=>{});const user=await currentUser();const {data,error}=await supabase.from('marketplace_items').select(ITEM_SELECT).eq('seller_id',user.id).order('updated_at',{ascending:false});if(error)throw error;return (data??[]) as unknown as MarketplaceItem[];
}

export type CreateMarketplaceItemInput={
 title:string;description:string;category:string;condition:string;quantity:number;city:string;state:string;postal_code?:string;pickup_area?:string;safe_pickup:boolean;seller_type:'individual'|'organization';
 location_name?:string;address_line1?:string;address_line2?:string;pickup_city:string;pickup_state:string;pickup_postal_code?:string;instructions?:string;contact_phone?:string;
};
export async function createMarketplaceItem(input:CreateMarketplaceItemInput){
 const user=await currentUser();const now=new Date().toISOString();
 const {data,error}=await supabase.from('marketplace_items').insert({
  seller_id:user.id,title:input.title.trim(),description:input.description.trim(),category:input.category,condition:input.condition||null,
  quantity:Math.max(1,Math.min(99,Number(input.quantity)||1)),price:0,is_free:true,city:input.city.trim(),state:input.state.trim().toUpperCase().slice(0,2),
  postal_code:input.postal_code?.trim()||null,pickup_area:input.pickup_area?.trim()||null,safe_pickup:input.safe_pickup,seller_type:input.seller_type,
  status:'available',moderation_status:'approved',listed_at:now
 }).select('id').single();if(error)throw error;
 const {error:pickupError}=await supabase.from('marketplace_pickup_details').insert({
  item_id:data.id,seller_id:user.id,location_name:input.location_name?.trim()||null,address_line1:input.address_line1?.trim()||null,address_line2:input.address_line2?.trim()||null,
  city:input.pickup_city.trim(),state:input.pickup_state.trim().toUpperCase().slice(0,2),postal_code:input.pickup_postal_code?.trim()||null,
  instructions:input.instructions?.trim()||null,contact_phone:input.contact_phone?.trim()||null
 });if(pickupError){await supabase.from('marketplace_items').delete().eq('id',data.id);throw pickupError}
 return data.id as string;
}

export async function uploadMarketplacePhoto(itemId:string,file:{name:string;mimeType?:string|null;bytes:ArrayBuffer},sortOrder:number){
 const user=await currentUser();const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120)||'photo.jpg';const path=user.id+'/'+itemId+'/'+Date.now()+'-'+safe;
 const {error:up}=await supabase.storage.from('marketplace-media').upload(path,file.bytes,{contentType:file.mimeType??'image/jpeg',upsert:false});if(up)throw up;
 const {data:publicData}=supabase.storage.from('marketplace-media').getPublicUrl(path);
 const {error}=await supabase.from('marketplace_media').insert({item_id:itemId,url:publicData.publicUrl,sort_order:sortOrder,storage_path:path,mime_type:file.mimeType??'image/jpeg'});if(error){await supabase.storage.from('marketplace-media').remove([path]);throw error}
 return publicData.publicUrl;
}

export type MarketplacePickupDetails={item_id:string;location_name:string|null;address_line1:string|null;address_line2:string|null;city:string;state:string;postal_code:string|null;instructions:string|null;contact_phone:string|null};
export async function loadMarketplacePickupDetailsForSeller(itemId:string):Promise<MarketplacePickupDetails|null>{
 const user=await currentUser();const {data,error}=await supabase.from('marketplace_pickup_details').select('item_id,location_name,address_line1,address_line2,city,state,postal_code,instructions,contact_phone').eq('item_id',itemId).eq('seller_id',user.id).maybeSingle();if(error)throw error;return data as MarketplacePickupDetails|null;
}
export async function updateMarketplaceItem(itemId:string,input:CreateMarketplaceItemInput){
 const user=await currentUser();
 const {error}=await supabase.from('marketplace_items').update({
  title:input.title.trim(),description:input.description.trim(),category:input.category,condition:input.condition||null,
  quantity:Math.max(1,Math.min(99,Number(input.quantity)||1)),city:input.city.trim(),state:input.state.trim().toUpperCase().slice(0,2),
  postal_code:input.postal_code?.trim()||null,pickup_area:input.pickup_area?.trim()||null,safe_pickup:input.safe_pickup,seller_type:input.seller_type,updated_at:new Date().toISOString()
 }).eq('id',itemId).eq('seller_id',user.id);if(error)throw error;
 const {error:pickupError}=await supabase.from('marketplace_pickup_details').upsert({
  item_id:itemId,seller_id:user.id,location_name:input.location_name?.trim()||null,address_line1:input.address_line1?.trim()||null,address_line2:input.address_line2?.trim()||null,
  city:input.pickup_city.trim(),state:input.pickup_state.trim().toUpperCase().slice(0,2),postal_code:input.pickup_postal_code?.trim()||null,
  instructions:input.instructions?.trim()||null,contact_phone:input.contact_phone?.trim()||null,updated_at:new Date().toISOString()
 },{onConflict:'item_id'});if(pickupError)throw pickupError;
}
export async function removeMarketplacePhoto(media:MarketplaceMedia){
 const user=await currentUser();if(media.storage_path){const {error:fileError}=await supabase.storage.from('marketplace-media').remove([media.storage_path]);if(fileError)throw fileError}
 const {error}=await supabase.from('marketplace_media').delete().eq('id',media.id);if(error)throw error;
}
export async function reorderMarketplacePhotos(itemId:string,media:MarketplaceMedia[]){
 await currentUser();for(let i=0;i<media.length;i++){const {error}=await supabase.from('marketplace_media').update({sort_order:i}).eq('id',media[i].id).eq('item_id',itemId);if(error)throw error}
}
export async function setMarketplaceItemAvailability(itemId:string,available:boolean){await currentUser();const {error}=await supabase.rpc('set_marketplace_item_availability',{p_item_id:itemId,p_available:available});if(error){if(error.message?.includes('STATUS_LOCKED'))throw new Error('STATUS_LOCKED');throw error}}

export async function removeMarketplaceItem(itemId:string){await currentUser();const {error}=await supabase.rpc('remove_marketplace_item',{p_item_id:itemId});if(error)throw error}

export async function reportMarketplaceItem(itemId:string,reason:string,details=''){
 const user=await currentUser();const {error}=await supabase.from('marketplace_reports').insert({item_id:itemId,reporter_id:user.id,reason,details:details.trim()||null,status:'open'});if(error)throw error;
}

export async function loadMarketplaceMessages(claimId:string):Promise<MarketplaceMessage[]>{await currentUser();const {data,error}=await supabase.from('marketplace_messages').select('id,claim_id,sender_id,body,created_at').eq('claim_id',claimId).order('created_at',{ascending:true});if(error)throw error;return (data??[]) as MarketplaceMessage[]}
export async function sendMarketplaceMessage(claimId:string,body:string){const user=await currentUser();const text=body.trim();if(!text)throw new Error('MESSAGE_REQUIRED');const {data,error}=await supabase.from('marketplace_messages').insert({claim_id:claimId,sender_id:user.id,body:text}).select('id,claim_id,sender_id,body,created_at').single();if(error)throw error;return data as MarketplaceMessage}
