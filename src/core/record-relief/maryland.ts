import type {Charge} from './jurisdiction-engine';import type {AuthoritySource,RuleResult} from './rule-contract';
export type MarylandFacts={today:string;pendingProceeding?:boolean;generalWaiverFiled?:boolean;probationDischargeDate?:string;treatmentCompletionDate?:string;pbjDuiAB?:boolean;newConvictionWithinLookback?:boolean;allCaseChargesFavorable?:boolean;unitHasIneligibleConviction?:boolean;sentenceCompletionDate?:string;guiltyWaitYears?:number;goodCause?:boolean};
const S105:AuthoritySource={authority:'statute',citation:'Md. Code, Criminal Procedure § 10-105',url:'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcp&section=10-105',effectiveFrom:'2026-10-01',verifiedOn:'2026-10-07'};
const S1051:AuthoritySource={authority:'statute',citation:'Md. Code, Criminal Procedure § 10-105.1',url:'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcp&section=10-105.1',effectiveFrom:'2021-10-01',verifiedOn:'2026-10-07'};
const S110:AuthoritySource={authority:'statute',citation:'Md. Code, Criminal Procedure § 10-110',url:'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcp&section=10-110',effectiveFrom:'2026-10-01',verifiedOn:'2026-10-07'};
const plusYears=(x:string,n:number)=>{const d=new Date(x+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()+n);return d.toISOString().slice(0,10)};
const base=(c:Charge,src:AuthoritySource):Omit<RuleResult,'outcome'|'reasons'|'missingFacts'>=>({jurisdictionCode:'US-MD',remedy:'expungement',source:src,chargeIds:[c.id],courtSpecificFilingReady:false});
const out=(c:Charge,src:AuthoritySource,outcome:RuleResult['outcome'],reasons:string[],missingFacts:string[]=[],eligibilityDate?:string):RuleResult=>({...base(c,src),outcome,reasons,missingFacts,eligibilityDate});
const favorable=(d:Charge['disposition'])=>['acquittal','dismissal','nolle_prosequi'].includes(d);
export function evaluateMaryland(c:Charge,f:MarylandFacts):RuleResult{
 if(f.pendingProceeding===undefined)return out(c,S105,'additional_facts_required',[],['whether the person is a defendant in a pending criminal proceeding']);
 if(f.pendingProceeding)return out(c,S105,'likely_excluded_verified',['Maryland bars expungement while the person is a defendant in a pending criminal proceeding.']);
 if(favorable(c.disposition)){
  if(!c.dispositionDate)return out(c,S105,'additional_facts_required',[],['disposition date']);
  if(f.allCaseChargesFavorable){
   const auto=plusYears(c.dispositionDate,3);if(f.today<auto)return out(c,S1051,'automatic_relief_may_apply',['The case qualifies for Maryland automatic expungement after three years if every charge has only a qualifying favorable disposition.'],[],auto);
   return out(c,S1051,'automatic_relief_may_apply',['The three-year automatic-expungement date has arrived or passed; verify agency/court completion.'],[],auto);
  }
  const three=plusYears(c.dispositionDate,3);if(f.today<three&&!f.generalWaiverFiled&&!f.goodCause)return out(c,S105,'waiting_period',['Before three years, acquittal/dismissal/nolle prosequi generally requires the statutory general waiver and release unless good cause applies.'],['general waiver/release or good-cause determination'],three);
  return out(c,S105,'likely_eligible_verified',['This favorable-disposition branch clears the verified timing gate; State’s Attorney objection and court process still apply.'],[],three);
 }
 if(c.disposition==='deferred_adjudication'){
  if(!f.probationDischargeDate)return out(c,S105,'additional_facts_required',[],['probation discharge date','whether this PBJ is a statutorily excluded offense']);
  const wait=f.pbjDuiAB?15:3,elig=plusYears(f.probationDischargeDate,wait);
  if(f.newConvictionWithinLookback)return out(c,S105,'likely_excluded_verified',['A new conviction within the applicable PBJ lookback prevents this branch unless a statutory exception applies.']);
  if(f.today<elig)return out(c,S105,'waiting_period',['The applicable PBJ waiting period has not elapsed.'],[],elig);
  return out(c,S105,'likely_eligible_verified',['The entered PBJ facts clear this verified timing branch.'],[],elig);
 }
 if(c.disposition==='conviction'){
  if(f.unitHasIneligibleConviction)return out(c,S110,'likely_excluded_verified',['If one conviction in the Maryland unit is ineligible, the other convictions in that unit are also ineligible.']);
  if(f.guiltyWaitYears===undefined||!f.sentenceCompletionDate)return out(c,S110,'additional_facts_required',[],['verified § 10-110 offense category/waiting period','completion of sentence date']);
  const elig=plusYears(f.sentenceCompletionDate,f.guiltyWaitYears);
  if(f.newConvictionWithinLookback)return out(c,S110,'legal_review_recommended',['A new conviction during the applicable period blocks the original conviction unless the new conviction itself becomes eligible.']);
  if(f.today<elig)return out(c,S110,'waiting_period',['The verified conviction waiting period has not elapsed after completion of sentence.'],[],elig);
  return out(c,S110,'court_or_prosecutor_discretion',['The entered conviction facts clear the supplied verified § 10-110 timing branch; victim notice, State’s Attorney process and court review still apply.'],[],elig);
 }
 return out(c,S105,'legal_review_recommended',['This disposition requires a Maryland remedy branch not yet represented by this evaluator.']);
}
