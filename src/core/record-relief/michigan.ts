import type{Charge}from'./jurisdiction-engine';import type{AuthoritySource,RuleResult}from'./rule-contract';
export type MichiganFacts={today:string;applicationFelonyCount?:number;seriousMisdemeanor?:boolean;assaultiveCrime?:boolean;firstOwi?:boolean;pendingCharges?:boolean;newConvictionDuringWait?:boolean;automaticDisqualifyingCategory?:boolean;maxJailDays?:number;sentenceImposedDate?:string;felonyProbationCompletionDate?:string;paroleDischargeDate?:string;imprisonmentCompletionDate?:string};
const APP:AuthoritySource={authority:'statute',citation:'MCL 780.621 & 780.621d',url:'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-780-621d',effectiveFrom:'2021-04-11',verifiedOn:'2026-10-07'};
const AUTO:AuthoritySource={authority:'statute',citation:'MCL 780.621g',url:'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-780-621g',effectiveFrom:'2023-04-11',verifiedOn:'2026-10-07'};
const plusYears=(x:string,n:number)=>{const d=new Date(x+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()+n);return d.toISOString().slice(0,10)};
const latest=(xs:(string|undefined)[])=>xs.filter((x):x is string=>!!x).sort().at(-1);
const out=(c:Charge,src:AuthoritySource,remedy:'set_aside'|'automatic_clearing',outcome:RuleResult['outcome'],reasons:string[],missingFacts:string[]=[],eligibilityDate?:string):RuleResult=>({jurisdictionCode:'US-MI',remedy,outcome,reasons,missingFacts,source:src,chargeIds:[c.id],courtSpecificFilingReady:false,eligibilityDate});
export function evaluateMichiganApplication(c:Charge,f:MichiganFacts):RuleResult{
 if(c.disposition!=='conviction')return out(c,APP,'set_aside','legal_review_recommended',['Route non-convictions to the applicable Michigan record/fingerprint branch.']);
 const missing:string[]=[];if(f.applicationFelonyCount===undefined)missing.push('number of felony convictions included in this application');if(f.seriousMisdemeanor===undefined)missing.push('serious-misdemeanor classification');if(f.assaultiveCrime===undefined)missing.push('assaultive-crime classification');if(f.firstOwi===undefined)missing.push('first-violation OWI classification');if(f.pendingCharges===undefined)missing.push('pending criminal charges');if(f.newConvictionDuringWait===undefined)missing.push('new conviction during waiting period');
 const anchor=latest([f.sentenceImposedDate,f.felonyProbationCompletionDate,f.paroleDischargeDate,f.imprisonmentCompletionDate]);if(!anchor)missing.push('latest statutory waiting-period anchor');
 if(missing.length)return out(c,APP,'set_aside','additional_facts_required',[],missing);
 if(f.pendingCharges)return out(c,APP,'set_aside','likely_excluded_verified',['The current MC 227 application requires no other pending criminal charges.']);
 let wait=3;if((f.applicationFelonyCount??0)>1)wait=7;else if((f.applicationFelonyCount??0)===1||f.seriousMisdemeanor||f.assaultiveCrime||f.firstOwi)wait=5;
 const elig=plusYears(anchor!,wait);if(f.newConvictionDuringWait)return out(c,APP,'set_aside','waiting_period',['A conviction during the applicable statutory period prevents this application branch from clearing.'],[],elig);
 if(f.today<elig)return out(c,APP,'set_aside','waiting_period',['The application waiting period is '+wait+' years from the latest statutory anchor.'],[],elig);
 return out(c,APP,'set_aside','court_or_prosecutor_discretion',['The supplied facts clear this application timing branch; setting aside remains a conditional privilege requiring court process.'],[],elig);
}
export function evaluateMichiganAutomatic(c:Charge,f:MichiganFacts):RuleResult{
 if(c.disposition!=='conviction')return out(c,AUTO,'automatic_clearing','legal_review_recommended',['Automatic conviction set-aside logic does not decide non-conviction record handling.']);
 const missing:string[]=[];if(f.pendingCharges===undefined)missing.push('pending criminal charges');if(f.newConvictionDuringWait===undefined)missing.push('new conviction during automatic lookback');if(f.automaticDisqualifyingCategory===undefined)missing.push('automatic-set-aside exclusion category');if(f.maxJailDays===undefined&&c.degree!=='felony')missing.push('maximum misdemeanor jail term');
 if(missing.length)return out(c,AUTO,'automatic_clearing','additional_facts_required',[],missing);
 if(f.pendingCharges)return out(c,AUTO,'automatic_clearing','waiting_period',['An active or pending criminal case prevents automatic set aside at this time.']);
 if(f.automaticDisqualifyingCategory)return out(c,AUTO,'automatic_clearing','likely_excluded_verified',['The conviction is in a category excluded from automatic set aside.']);
 const anchor=c.degree==='felony'?latest([f.sentenceImposedDate,f.imprisonmentCompletionDate]):f.sentenceImposedDate;if(!anchor)return out(c,AUTO,'automatic_clearing','additional_facts_required',[],[c.degree==='felony'?'sentence-imposed date or completion of Michigan DOC imprisonment, whichever is later':'sentence-imposed date']);
 const wait=c.degree==='felony'?10:7,elig=plusYears(anchor,wait);if(f.newConvictionDuringWait)return out(c,AUTO,'automatic_clearing','waiting_period',['A new recorded criminal conviction during the applicable period prevents this automatic branch.'],[],elig);
 if(f.today<elig)return out(c,AUTO,'automatic_clearing','waiting_period',['Michigan automatic set aside requires '+wait+' years for this offense class.'],[],elig);
 return out(c,AUTO,'automatic_clearing','automatic_relief_may_apply',['The supplied facts clear the verified automatic timing/exclusion gate; verify MSP/court processing before representing the record as set aside.'],[],elig);
}
