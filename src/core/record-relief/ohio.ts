import type { Charge } from './jurisdiction-engine';import type { RuleResult,AuthoritySource } from './rule-contract';
export type OhioFacts={today:string;otherFelonyConvictions?:number;sameActOrTime?:boolean;sameProceedingRelatedWithin3Months?:boolean;courtDeclinesAggregation?:boolean;offenseOfViolence?:boolean;sexRegistrationRequired?:boolean;victimUnder13?:boolean;childSupportException?:boolean;theftInOffice?:boolean;domesticViolenceStatute?:'2919.25'|'2919.27'|'none';solicitingImproperCompensation?:boolean;chapter2950EndedDate?:string;pendingProceeding?:boolean};
const SOURCE:AuthoritySource={authority:'statute',citation:'Ohio Rev. Code § 2953.32 (effective Sept. 30, 2025)',url:'https://codes.ohio.gov/ohio-revised-code/section-2953.32',effectiveFrom:'2025-09-30',verifiedOn:'2026-10-07'};
const years=(iso:string,n:number)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()+n);return d.toISOString().slice(0,10)};
const latest=(xs:(string|undefined)[])=>xs.filter((x):x is string=>!!x).sort().at(-1);
const base=(c:Charge,remedy:'sealing'|'expungement'):Omit<RuleResult,'outcome'|'reasons'|'missingFacts'>=>({jurisdictionCode:'US-OH',remedy,source:SOURCE,chargeIds:[c.id],courtSpecificFilingReady:false});
const result=(c:Charge,remedy:'sealing'|'expungement',outcome:RuleResult['outcome'],reasons:string[],missingFacts:string[]=[],eligibilityDate?:string):RuleResult=>({...base(c,remedy),outcome,reasons,missingFacts,eligibilityDate});
const traffic=(s='')=>/^(4506|4507|4510|4511|4549)\./.test(s);
export function evaluateOhio295332(c:Charge,f:OhioFacts,remedy:'sealing'|'expungement'='sealing'):RuleResult{
 if(c.disposition!=='conviction')return result(c,remedy,'legal_review_recommended',['Route non-conviction dispositions to R.C. 2953.33/2953.61, not the conviction branch.']);
 const missing:string[]=[];if(c.degree==='unknown')missing.push('final offense degree');
 const level=c.degree==='felony'?c.degreeLevel:0;if(c.degree==='felony'&&level==null)missing.push('felony degree');
 const excluded:string[]=[];
 if(traffic(c.statute))excluded.push('The final conviction is in an excluded Ohio motor-vehicle chapter.');
 if(level===1||level===2)excluded.push('First- and second-degree felonies are excluded.');
 if(f.offenseOfViolence&&c.degree==='felony')excluded.push('A felony offense of violence is excluded from this general branch.');
 if(f.sexRegistrationRequired)excluded.push('A sexually oriented offense subject to Chapter 2950 registration is excluded from this general branch.');
 if(f.victimUnder13&&!f.childSupportException)excluded.push('The offense involved a victim under 13 and no verified statutory exception was supplied.');
 if(f.theftInOffice)excluded.push('R.C. 2921.41 theft in office is excluded.');
 if(f.domesticViolenceStatute==='2919.25'&&(c.degree==='felony'||c.degreeLevel===1||c.degreeLevel===2))excluded.push('This R.C. 2919.25 conviction is excluded from this general branch.');
 if(excluded.length)return result(c,remedy,'likely_excluded_verified',excluded,missing);
 if(f.domesticViolenceStatute==='2919.25'&&(c.degreeLevel===3||c.degreeLevel===4)&&remedy==='expungement')return result(c,remedy,'likely_excluded_verified',['R.C. 2953.32(A)(2) permits this branch for sealing, not expungement.']);
 if(f.domesticViolenceStatute==='2919.27'&&remedy==='expungement')return result(c,remedy,'likely_excluded_verified',['R.C. 2953.32(A)(2) permits this branch for sealing, not expungement.']);
 if(level===3&&f.otherFelonyConvictions===undefined)missing.push('other felony conviction count after statutory aggregation');
 if(f.pendingProceeding===undefined)missing.push('whether criminal proceedings are pending');
 if(f.pendingProceeding)return result(c,remedy,'court_or_prosecutor_discretion',['R.C. 2953.32 requires the court to determine whether criminal proceedings are pending.'],missing);
 const discharge=latest([c.sentenceCompletionDate,c.supervisionCompletionDate,c.releaseDate]);if(!discharge)missing.push('final discharge date');
 if(missing.length)return result(c,remedy,'additional_facts_required',[],missing);
 if(remedy==='sealing'&&f.chapter2950EndedDate){const eligibility=years(f.chapter2950EndedDate,5);if(f.today<eligibility)return result(c,remedy,'waiting_period',['Chapter 2950 requirements ended, but the special five-year sealing period has not elapsed.'],[],eligibility);return result(c,remedy,'court_or_prosecutor_discretion',['The special Chapter 2950 five-year timing gate has elapsed; the court still applies the statutory hearing, rehabilitation and interest-balancing requirements.'],[],eligibility)}
 let wait=1;if(remedy==='sealing'){if(level===3)wait=3;else if(c.degree==='minor_misdemeanor')wait=.5;if(f.solicitingImproperCompensation)wait=7;}else{if(c.degree==='minor_misdemeanor')wait=.5;else if(c.degree==='felony'){const sealWait=level===3?3:f.solicitingImproperCompensation?7:1;wait=sealWait+10;}}
 const eligibility=wait===.5?(()=>{const d=new Date(discharge+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+6);return d.toISOString().slice(0,10)})():years(discharge!,wait);
 if(f.today<eligibility)return result(c,remedy,'waiting_period',['The verified waiting period has not elapsed from final discharge.'],[],eligibility);
 return result(c,remedy,'court_or_prosecutor_discretion',['The entered facts clear this rule branch, but the statute still requires a court hearing, rehabilitation finding, and balancing of the applicant and government interests.'],[],eligibility);
}
