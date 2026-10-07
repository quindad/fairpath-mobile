// Record-relief jurisdiction routing. This module routes facts; it never invents substantive law.
// State/territory law, filing venue, court, and individual charges are separate dimensions.
export type JurisdictionKind='state'|'district'|'territory'|'federal';
export type CourtLevel='municipal'|'county'|'district'|'circuit'|'superior'|'common_pleas'|'general'|'limited'|'juvenile'|'federal_district'|'military'|'unknown';
export type ChargeDisposition='conviction'|'dismissal'|'acquittal'|'deferred_adjudication'|'nolle_prosequi'|'arrest_no_charge'|'pending'|'unknown';
export type ChargeDegree='infraction'|'minor_misdemeanor'|'misdemeanor'|'felony'|'unknown';
export type Jurisdiction={code:string;name:string;kind:JurisdictionKind};
export type Charge={id:string;offenseName:string;statute?:string;degree:ChargeDegree;degreeLevel?:number;disposition:ChargeDisposition;dispositionDate?:string;convictionDate?:string;sentenceCompletionDate?:string;supervisionCompletionDate?:string;releaseDate?:string;finesPaid?:boolean;restitutionPaid?:boolean};
export type Venue={jurisdictionCode:string;stateCode?:string;county?:string;city?:string;courtName?:string;courtLevel:CourtLevel;federalSubtype?:'united_states_code'|'district_of_columbia_code'|'code_of_federal_regulations'|'uniform_code_of_military_justice'|'unknown'};
export type CaseBundle={venue:Venue;charges:Charge[];pendingOtherCases?:boolean};
export type RoutingIssue={code:string;severity:'blocker'|'review'|'info';message:string;chargeId?:string};
export type RoutingResult={authorityCode:string;filingVenue:Venue;chargeIds:string[];issues:RoutingIssue[];canEvaluate:boolean};

const STATE_ROWS=[
'AL|Alabama','AK|Alaska','AZ|Arizona','AR|Arkansas','CA|California','CO|Colorado','CT|Connecticut','DE|Delaware','FL|Florida','GA|Georgia','HI|Hawaii','ID|Idaho','IL|Illinois','IN|Indiana','IA|Iowa','KS|Kansas','KY|Kentucky','LA|Louisiana','ME|Maine','MD|Maryland','MA|Massachusetts','MI|Michigan','MN|Minnesota','MS|Mississippi','MO|Missouri','MT|Montana','NE|Nebraska','NV|Nevada','NH|New Hampshire','NJ|New Jersey','NM|New Mexico','NY|New York','NC|North Carolina','ND|North Dakota','OH|Ohio','OK|Oklahoma','OR|Oregon','PA|Pennsylvania','RI|Rhode Island','SC|South Carolina','SD|South Dakota','TN|Tennessee','TX|Texas','UT|Utah','VT|Vermont','VA|Virginia','WA|Washington','WV|West Virginia','WI|Wisconsin','WY|Wyoming'] as const;
const TERRITORY_ROWS=['PR|Puerto Rico','GU|Guam','VI|U.S. Virgin Islands','AS|American Samoa','MP|Northern Mariana Islands'] as const;
export const JURISDICTIONS:readonly Jurisdiction[]=[
 {code:'US-FED',name:'Federal (U.S. courts)',kind:'federal'},
 ...STATE_ROWS.map(x=>{const [a,b]=x.split('|');return {code:'US-'+a,name:b,kind:'state' as const}}),
 {code:'US-DC',name:'District of Columbia',kind:'district'},
 ...TERRITORY_ROWS.map(x=>{const [a,b]=x.split('|');return {code:'US-'+a,name:b,kind:'territory' as const}}),
];
export const JURISDICTION_BY_CODE=new Map(JURISDICTIONS.map(j=>[j.code,j]));

/** City/county identify filing venue; they never silently become a different source of substantive state law. */
export function normalizeVenue(v:Venue):Venue{
 const code=v.jurisdictionCode.toUpperCase();
 const j=JURISDICTION_BY_CODE.get(code);
 if(!j) return {...v,jurisdictionCode:code,city:v.city?.trim()||undefined,county:v.county?.trim()||undefined,courtName:v.courtName?.trim()||undefined};
 return {...v,jurisdictionCode:j.code,stateCode:j.kind==='state'?j.code.slice(3):v.stateCode,city:v.city?.trim()||undefined,county:v.county?.trim()||undefined,courtName:v.courtName?.trim()||undefined};
}
export function validateBundle(bundle:CaseBundle):RoutingIssue[]{
 const issues:RoutingIssue[]=[]; const v=normalizeVenue(bundle.venue); const j=JURISDICTION_BY_CODE.get(v.jurisdictionCode);
 if(!j) issues.push({code:'unknown_jurisdiction',severity:'blocker',message:'Choose a supported U.S. jurisdiction.'});
 if(!bundle.charges.length) issues.push({code:'no_charges',severity:'blocker',message:'Add every charge from this case before checking relief.'});
 if(j?.kind==='federal' && (!v.federalSubtype||v.federalSubtype==='unknown')) issues.push({code:'federal_subtype_unknown',severity:'review',message:'Identify whether this is U.S. Code, D.C. Code, CFR, or UCMJ before routing federal relief.'});
 if(!v.courtName) issues.push({code:'court_unknown',severity:'review',message:'Court name is missing. Eligibility may be screened, but filing instructions cannot be treated as court-specific.'});
 if(!v.city&&!v.county&&j?.kind!=='federal') issues.push({code:'local_venue_unknown',severity:'review',message:'City or county is missing. Do not show local filing instructions or local fees until venue is known.'});
 const seen=new Set<string>();
 for(const ch of bundle.charges){
  if(seen.has(ch.id)) issues.push({code:'duplicate_charge_id',severity:'blocker',message:'Each charge needs a unique identifier.',chargeId:ch.id}); seen.add(ch.id);
  if(!ch.offenseName.trim()) issues.push({code:'offense_missing',severity:'blocker',message:'Charge name is required.',chargeId:ch.id});
  if(ch.disposition==='pending'||bundle.pendingOtherCases) issues.push({code:'pending_case',severity:'review',message:'A pending case can change record-relief eligibility. Route to the jurisdiction rule before giving a result.',chargeId:ch.id});
  if(ch.degree==='unknown') issues.push({code:'degree_unknown',severity:'review',message:'The final offense degree is unknown. Do not guess from the original charge.',chargeId:ch.id});
  if(ch.disposition==='unknown') issues.push({code:'disposition_unknown',severity:'review',message:'The final disposition is unknown.',chargeId:ch.id});
 }
 return issues;
}
export function routeCase(bundle:CaseBundle):RoutingResult{
 const venue=normalizeVenue(bundle.venue),issues=validateBundle(bundle),authority=venue.jurisdictionCode;
 return {authorityCode:authority,filingVenue:venue,chargeIds:bundle.charges.map(c=>c.id),issues,canEvaluate:!issues.some(i=>i.severity==='blocker')};
}
export function splitByAuthority(cases:readonly CaseBundle[]):Map<string,CaseBundle[]>{
 const out=new Map<string,CaseBundle[]>(); for(const c of cases){const k=normalizeVenue(c.venue).jurisdictionCode;out.set(k,[...(out.get(k)||[]),c]);} return out;
}
/** Never merge cases from different authorities. A multi-state member gets independent evaluations per authority. */
export function isHybridJurisdictionSet(cases:readonly CaseBundle[]):boolean{return splitByAuthority(cases).size>1;}
