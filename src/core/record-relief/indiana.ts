import type{Charge}from'./jurisdiction-engine';import type{AuthoritySource,RuleResult}from'./rule-contract';
export type IndianaFacts={today:string;prosecutorWrittenConsent?:boolean;pendingCharges?:boolean;newConvictionDuringWait?:boolean;allFinesFeesRestitutionPaid?:boolean;victimNoticeRequired?:boolean;victimNoticeCompleted?:boolean;section?:1|2|3|4|5;convictionDate?:string;sentenceCompletionDate?:string;felonyReducedToMisdemeanor?:boolean;seriousViolentFelon?:boolean;officialMisconduct?:boolean;sexOrViolentOffender?:boolean;unlawfulDeathOrBodilyInjury?:boolean;twoOrMoreDeadlyWeaponFelonies?:boolean;automaticArrestDate?:string;allChargesDismissed?:boolean;acquittedAllCharges?:boolean;noChargesFiled?:boolean};
const SRC:AuthoritySource={authority:'statute',citation:'Ind. Code ch. 35-38-9 (Indiana Office of Court Services compilation updated July 1, 2026)',url:'https://www.in.gov/courts/iocs/files/pubs-trial-court-courtmgmt-expungement-statutes.pdf',effectiveFrom:'2026-07-01',verifiedOn:'2026-10-07'};
const plusYears=(x:string,n:number)=>{const d=new Date(x+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()+n);return d.toISOString().slice(0,10)};
const later=(a?:string,b?:string)=>[a,b].filter((x):x is string=>!!x).sort().at(-1);
const out=(c:Charge,outcome:RuleResult['outcome'],reasons:string[],missingFacts:string[]=[],eligibilityDate?:string):RuleResult=>({jurisdictionCode:'US-IN',remedy:'expungement',outcome,reasons,missingFacts,source:SRC,chargeIds:[c.id],courtSpecificFilingReady:false,eligibilityDate});
export function evaluateIndiana(c:Charge,f:IndianaFacts):RuleResult{
 if(c.disposition!=='conviction'){
  if(f.allChargesDismissed||f.acquittedAllCharges||f.noChargesFiled)return out(c,'automatic_relief_may_apply',['Indiana has automatic arrest/charge expungement branches for qualifying non-conviction outcomes; verify that the statutory automatic date and court processing have occurred.']);
  return out(c,'legal_review_recommended',['Route this non-conviction disposition through the specific I.C. 35-38-9-1 arrest/charge branch.']);
 }
 const missing:string[]=[];if(f.section===undefined)missing.push('verified I.C. 35-38-9 conviction section');if(f.pendingCharges===undefined)missing.push('pending charges');if(f.newConvictionDuringWait===undefined)missing.push('new conviction during statutory period');if(f.allFinesFeesRestitutionPaid===undefined)missing.push('payment of fines, fees, court costs and restitution obligations');
 if(missing.length)return out(c,'additional_facts_required',[],missing);
 if(f.pendingCharges)return out(c,'likely_excluded_verified',['A pending criminal charge prevents the conviction petition branch from clearing.']);
 if(!f.allFinesFeesRestitutionPaid)return out(c,'additional_facts_required',['Indiana requires satisfaction of the applicable financial obligations before this branch can be granted.'],['proof/status of fines, fees, court costs and restitution']);
 if(f.section===5&&(f.seriousViolentFelon||f.officialMisconduct||f.sexOrViolentOffender||f.unlawfulDeathOrBodilyInjury||f.twoOrMoreDeadlyWeaponFelonies))return out(c,'likely_excluded_verified',['The supplied conviction history falls within a statutory category excluded from this conviction-expungement branch.']);
 const anchor=later(f.convictionDate,f.sentenceCompletionDate);if(!anchor)return out(c,'additional_facts_required',[],['conviction date and sentence-completion date']);
 const wait=f.section===2?5:f.section===3?8:f.section===4?8:f.section===5?10:0,elig=plusYears(anchor,wait);
 if(f.newConvictionDuringWait)return out(c,'waiting_period',['A conviction within the statutory waiting period prevents this branch from clearing.'],[],elig);
 if(f.today<elig&&!f.prosecutorWrittenConsent)return out(c,'waiting_period',['The statutory waiting period has not elapsed; earlier filing/grant requires the prosecutor-consent path where authorized.'],[],elig);
 if((f.section===4||f.section===5)&&!f.prosecutorWrittenConsent)return out(c,'court_or_prosecutor_discretion',['This felony branch requires prosecutor written consent for expungement under the current statute.'],[],elig);
 return out(c,'court_or_prosecutor_discretion',['The supplied facts clear this verified timing gate; the court process and any required prosecutor/victim procedures still control.'],[],elig);
}
