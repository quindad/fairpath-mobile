// Pure helpers (no imports) so audit scripts can execute them directly under Node.

/** Filter state shared by the Housing screen, saved searches and the search_housing RPC (same keys everywhere). */
export type HousingFilters={
 minRent:string;maxRent:string;beds:string;baths:string;types:string[];minSqft:string;
 fastTrack:boolean;pets:boolean;accessible:boolean;garage:boolean;parking:boolean;furnished:boolean;basement:boolean;yard:boolean;balcony:boolean;laundry:boolean;centralAir:boolean;moveInReady:boolean;
};
export const EMPTY_HOUSING_FILTERS:HousingFilters={minRent:'',maxRent:'',beds:'ANY',baths:'ANY',types:[],minSqft:'',fastTrack:false,pets:false,accessible:false,garage:false,parking:false,furnished:false,basement:false,yard:false,balcony:false,laundry:false,centralAir:false,moveInReady:false};
export const BOOLEAN_FILTER_KEYS=['fastTrack','pets','accessible','garage','parking','furnished','basement','yard','balcony','laundry','centralAir','moveInReady'] as const;
/** Number of active filters (sort and location are not filters). */
export function countHousingFilters(f:HousingFilters){
 return [f.minRent!=='',f.maxRent!=='',f.beds!=='ANY',f.baths!=='ANY',f.types.length>0,f.minSqft!==''].filter(Boolean).length+BOOLEAN_FILTER_KEYS.filter(k=>f[k]).length;
}
/** Rebuilds filter state from URL params or a saved search (both use the same keys). */
export function housingFiltersFromRecord(r:Record<string,unknown>):HousingFilters{
 const str=(v:unknown)=>v==null||v===false?'':String(v);
 const on=(v:unknown)=>v===true||v==='1'||v==='true';
 const types=Array.isArray(r.types)?r.types.map(String):str(r.types).split(',').filter(Boolean);
 const num=(v:unknown)=>{const t=str(v).replace(/[^0-9.]/g,'');return t};
 const out:HousingFilters={...EMPTY_HOUSING_FILTERS,minRent:num(r.minRent),maxRent:num(r.maxRent),minSqft:num(r.minSqft),beds:str(r.beds)||'ANY',baths:str(r.baths)||'ANY',types};
 for(const k of BOOLEAN_FILTER_KEYS)out[k]=on(r[k]);
 return out;
}
