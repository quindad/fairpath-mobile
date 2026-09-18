import { supabase } from '@/lib/supabase';

export type Job = {id:string;title:string;company_name:string;description:string;location_text:string|null;workplace_type:string;employment_type:string;pay_min:number|null;pay_max:number|null;pay_period:string|null;benefits:string[];skills:string[];featured:boolean;created_at:string};
export type HousingListing = {id:string;title:string;description:string;property_type:string;city:string;state:string;bedrooms:number|null;bathrooms:number|null;square_feet:number|null;rent_monthly:number;deposit_amount:number|null;amenities:string[];virtual_tour_url:string|null;floor_plan_url:string|null;video_url:string|null;fasttrack_enabled:boolean;featured:boolean;housing_media?:{url:string;media_type:string;sort_order:number}[]};
export type MarketplaceItem = {id:string;title:string;description:string;category:string;condition:string|null;price:number;is_free:boolean;city:string;state:string;safe_pickup:boolean;created_at:string;marketplace_media?:{url:string;sort_order:number}[]};

export async function loadJobs(search=''){
 let q=supabase.from('jobs').select('id,title,company_name,description,location_text,workplace_type,employment_type,pay_min,pay_max,pay_period,benefits,skills,featured,created_at').eq('status','published').order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(50);
 if(search.trim())q=q.or(`title.ilike.%${search.trim()}%,company_name.ilike.%${search.trim()}%,location_text.ilike.%${search.trim()}%`);
 const {data,error}=await q;if(error)throw error;return (data??[]) as Job[];
}
export async function loadHousing(search=''){
 let q=supabase.from('housing_listings').select('id,title,description,property_type,city,state,bedrooms,bathrooms,square_feet,rent_monthly,deposit_amount,amenities,virtual_tour_url,floor_plan_url,video_url,fasttrack_enabled,featured,housing_media(url,media_type,sort_order)').eq('status','published').order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(50);
 if(search.trim())q=q.or(`title.ilike.%${search.trim()}%,city.ilike.%${search.trim()}%,state.ilike.%${search.trim()}%`);
 const {data,error}=await q;if(error)throw error;return (data??[]) as HousingListing[];
}
export async function loadMarketplace(search=''){
 let q=supabase.from('marketplace_items').select('id,title,description,category,condition,price,is_free,city,state,safe_pickup,created_at,marketplace_media(url,sort_order)').eq('status','available').order('created_at',{ascending:false}).limit(60);
 if(search.trim())q=q.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%`);
 const {data,error}=await q;if(error)throw error;return (data??[]) as MarketplaceItem[];
}
export async function saveJob(jobId:string){const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('SIGNED_OUT');const {error}=await supabase.from('saved_jobs').upsert({user_id:user.id,job_id:jobId});if(error)throw error;}
export async function saveHousing(listingId:string){const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('SIGNED_OUT');const {error}=await supabase.from('saved_housing').upsert({user_id:user.id,listing_id:listingId});if(error)throw error;}
export async function saveMarketplace(itemId:string){const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('SIGNED_OUT');const {error}=await supabase.from('marketplace_saves').upsert({user_id:user.id,item_id:itemId});if(error)throw error;}
