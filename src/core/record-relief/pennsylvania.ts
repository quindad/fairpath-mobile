import type{Charge}from'./jurisdiction-engine';import type{AuthoritySource,RuleResult}from'./rule-contract';
export type PennsylvaniaFacts={today:string;yearsFreeFromOneYearOffense?:number;restitutionPaid?:boolean;limitedAccessFeePaid?:boolean;qualifyingFelony?:boolean;disqualifyingCategory?:boolean;priorFelonyOtherThanQualifying?:boolean;twoOrMoreOverTwoYearOffenses?:boolean;fourOrMoreOneYearOffenses?:boolean;sameCaseFiveYearOrExcludedOffense?:boolean;consolidatedSameDocketAndOTN?:boolean;feloniesOnDocket?:number};
const S1:AuthoritySource={authority:'statute',citation:'18 Pa.C.S. § 9122.1',url:'https://www.legis.state.pa.us/WU01/LI/LI/CT/HTM/18/00.091.022.001..HTM',effectiveFrom:'2024-02-12',verifiedOn:'2026-10-07'};
const S2:AuthoritySource={authority:'statute',citation:'18 Pa.C.S. §§ 9122.2–9122.3',url:'https://www.legis.state.pa.us/WU01/LI/LI/CT/HTM/18/00.091..HTM',effectiveFrom:'2024-06-11',verifiedOn:'2026-10-07'};
const out=(c:Charge,src:AuthoritySource,remedy:'limited_access'|'automatic_clearing',outcome:RuleResult['outcome'],reasons:string[],missingFacts:string[]=[]):RuleResult=>({jurisdictionCode:'US-PA',remedy,outcome,reasons,missingFacts,source:src,chargeIds:[c.id],courtSpecificFilingReady:false});
const misdemeanorCandidate=(c:Charge)=>c.degree==='misdemeanor';
export function evaluatePennsylvaniaLimitedAccess(c:Charge,f:PennsylvaniaFacts,mode:'petition'|'clean_slate'):RuleResult{
 const src=mode==='petition'?S1:S2,remedy=mode==='petition'?'limited_access':'automatic_clearing';
 if(c.disposition!=='conviction')return out(c,src,remedy,'automatic_relief_may_apply',['Pennsylvania Clean Slate separately covers charges ending in a final disposition other than conviction; verify the disposition feed and statutory exceptions before representing completion.']);
 const missing:string[]=[];
 if(f.restitutionPaid===undefined)missing.push('whether all court-ordered restitution is paid');
 if(f.yearsFreeFromOneYearOffense===undefined)missing.push('years free from conviction for an offense punishable by at least one year');
 if(f.disqualifyingCategory===undefined)missing.push('§ 9122.3 disqualifying-offense category review');
 if(missing.length)return out(c,src,remedy,'additional_facts_required',[],missing);
 if(!f.restitutionPaid)return out(c,src,remedy,'waiting_period',['All court-ordered restitution must be paid before this limited-access branch can complete.']);
 if(f.disqualifyingCategory||f.twoOrMoreOverTwoYearOffenses||f.fourOrMoreOneYearOffenses)return out(c,src,remedy,'likely_excluded_verified',['The supplied history triggers a verified § 9122.3 limited-access exception.']);
 if(f.priorFelonyOtherThanQualifying)return out(c,src,remedy,'likely_excluded_verified',['A prior felony other than a qualifying offense triggers the § 9122.3 exception.']);
 if(f.sameCaseFiveYearOrExcludedOffense&&!f.qualifyingFelony)return out(c,src,remedy,'likely_excluded_verified',['An otherwise qualifying conviction is blocked when the same case contains an offense punishable by five or more years or another enumerated exception.']);
 if(f.consolidatedSameDocketAndOTN&&(f.feloniesOnDocket??0)>2)return out(c,src,remedy,'legal_review_recommended',['The consolidation rule cannot treat a docket containing more than two felony convictions as one conviction.']);
 if(f.qualifyingFelony){if((f.yearsFreeFromOneYearOffense??0)<10)return out(c,src,remedy,'waiting_period',['Qualifying-felony limited access requires 10 conviction-free years under the statutory lookback.']);return out(c,src,remedy,mode==='clean_slate'?'automatic_relief_may_apply':'court_or_prosecutor_discretion',['The supplied qualifying-felony facts clear this verified timing/exception gate.']);}
 if(!misdemeanorCandidate(c))return out(c,src,remedy,'legal_review_recommended',['This offense classification needs a different Pennsylvania relief branch.']);
 if((f.yearsFreeFromOneYearOffense??0)<7)return out(c,src,remedy,'waiting_period',['This misdemeanor limited-access branch requires seven conviction-free years under current law.']);
 return out(c,src,remedy,mode==='clean_slate'?'automatic_relief_may_apply':'court_or_prosecutor_discretion',[mode==='clean_slate'?'The supplied facts clear the Clean Slate limited-access gate; system processing still must be confirmed.':'The supplied facts clear the petition gate; the Court of Common Pleas may enter the limited-access order.']);
}
