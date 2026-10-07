export type CourtDirectoryEntry={id:string;jurisdictionCode:string;stateCode:string;county?:string;city?:string;name:string;level:'circuit'|'superior'|'common_pleas'|'district'|'municipal'|'other';officialUrl:string;caseSearchUrl?:string;clerkUrl?:string;verifiedOn:string;sourceUrl:string};
export type CourtLookup={jurisdictionCode:string;county?:string;city?:string};
export function findCourts(entries:readonly CourtDirectoryEntry[],q:CourtLookup){const county=q.county?.trim().toLowerCase(),city=q.city?.trim().toLowerCase();return entries.filter(x=>x.jurisdictionCode===q.jurisdictionCode&&(!county||x.county?.toLowerCase()===county)&&(!city||x.city?.toLowerCase()===city))}
export const INDIANA_STATEWIDE_CASE_SEARCH='https://public.courts.in.gov/mycase/';
export function courtSearchFallback(jurisdictionCode:string){return jurisdictionCode==='US-IN'?{label:'Indiana MyCase',url:INDIANA_STATEWIDE_CASE_SEARCH,scope:'statewide_public_case_search' as const}:null}
