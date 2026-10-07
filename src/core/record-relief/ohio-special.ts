import type{Charge}from'./jurisdiction-engine';import type{AuthoritySource,RuleResult}from'./rule-contract';
const S33:AuthoritySource={authority:'statute',citation:'Ohio Rev. Code § 2953.33',url:'https://codes.ohio.gov/ohio-revised-code/section-2953.33',effectiveFrom:'2023-10-03',verifiedOn:'2026-10-07'};
const S36:AuthoritySource={authority:'statute',citation:'Ohio Rev. Code § 2953.36',url:'https://codes.ohio.gov/ohio-revised-code/section-2953.36',effectiveFrom:'2024-10-24',verifiedOn:'2026-10-07'};
const S321:AuthoritySource={authority:'statute',citation:'Ohio Rev. Code § 2953.321',url:'https://codes.ohio.gov/ohio-revised-code/section-2953.321',effectiveFrom:'2026-03-20',verifiedOn:'2026-10-07'};
const S61:AuthoritySource={authority:'statute',citation:'Ohio Rev. Code § 2953.61',url:'https://codes.ohio.gov/ohio-revised-code/section-2953.61',effectiveFrom:'2023-04-04',verifiedOn:'2026-10-07'};
const out=(c:Charge,src:AuthoritySource,remedy:'sealing'|'expungement',outcome:RuleResult['outcome'],reasons:string[],missingFacts:string[]=[],eligibilityDate?:string):RuleResult=>({jurisdictionCode:'US-OH',remedy,outcome,reasons,missingFacts,source:src,chargeIds:[c.id],courtSpecificFilingReady:false,eligibilityDate});
export function evaluateOhioNonConviction(c:Charge,today:string,noBillDate?:string,pardon=false):RuleResult{
 if(['dismissal','acquittal'].includes(c.disposition))return out(c,S33,'expungement','court_or_prosecutor_discretion',['R.C. 2953.33 permits application after entry of dismissal or not-guilty finding, subject to § 2953.61 and the hearing/balancing process.']);
 if(pardon)return out(c,S33,'sealing','court_or_prosecutor_discretion',['A qualifying gubernatorial pardon may use the § 2953.33 sealing branch after the pardon or its conditions are complete.']);
 if(noBillDate){const d=new Date(noBillDate+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()+2);const e=d.toISOString().slice(0,10);return out(c,S33,'expungement',today<e?'waiting_period':'court_or_prosecutor_discretion',['Grand-jury no-bill applications have a two-year filing wait.'],[],e)}
 return out(c,S33,'expungement','additional_facts_required',[],['verified favorable disposition, no-bill date, or pardon status']);
}
export function evaluateOhioTraffickingVictim(c:Charge,participationResultedFromTrafficking?:boolean):RuleResult{
 if(participationResultedFromTrafficking===undefined)return out(c,S36,'expungement','additional_facts_required',[],['whether participation in the offense resulted from being a human-trafficking victim']);
 if(!participationResultedFromTrafficking)return out(c,S36,'expungement','likely_excluded_verified',['This special § 2953.36 pathway requires the offense participation to result from human trafficking victimization.']);
 if(['2903.01','2903.02','2907.02'].includes(c.statute??''))return out(c,S36,'expungement','likely_excluded_verified',['This conviction is expressly excluded from the trafficking-victim expungement pathway.']);
 const enumerated=['2907.24','2907.241','2907.25'].includes(c.statute??'');const low=c.degree==='misdemeanor'||(c.degree==='felony'&&(c.degreeLevel===4||c.degreeLevel===5));
 return out(c,S36,'expungement',enumerated||low?'court_or_prosecutor_discretion':'likely_excluded_verified',[enumerated||low?'The offense fits a verified § 2953.36 application class; the sentencing court still decides the statutory findings.':'The supplied offense is outside the verified § 2953.36 application classes.']);
}
export function evaluateOhioMarijuana(c:Charge,occurredBeforeEffective:boolean,hashishGrams?:number):RuleResult{
 const s=c.statute??'';const possession=['2925.11(C)(3)(a)','2925.11(C)(7)(a)','2925.11(C)(7)(b)'].includes(s);const hash=['2925.11(C)(7)(c)','2925.11(C)(7)(d)'].includes(s);
 if(!occurredBeforeEffective)return out(c,S321,'expungement','likely_excluded_verified',['§ 2953.321 applies to the specified cases occurring before March 20, 2026.']);
 if(hash&&hashishGrams===undefined)return out(c,S321,'expungement','additional_facts_required',[],['hashish amount']);
 if(!(possession||(hash&&(hashishGrams??Infinity)<=15)))return out(c,S321,'expungement','likely_excluded_verified',['The final statute/amount is outside the verified § 2953.321 possession categories.']);
 return out(c,S321,'expungement','court_or_prosecutor_discretion',['The charge fits the verified marijuana/hashish special pathway; the court still performs the statutory interest balancing.']);
}
export type MixedChargeFacts={sameAct:boolean;oneTrafficConvictionOnly?:boolean;trafficStatute?:string;commercialDriverLicense?:boolean;allOtherChargesEligible?:boolean};
export function evaluateOhioMixedDisposition(charges:readonly Charge[],f:MixedChargeFacts):{blocked:boolean;exceptionMayApply:boolean;source:AuthoritySource;reason:string}{
 if(charges.length<2||!f.sameAct)return{blocked:false,exceptionMayApply:false,source:S61,reason:'§ 2953.61 mixed-disposition same-act hold does not apply on the supplied facts.'};
 const dispositions=new Set(charges.map(x=>x.disposition));if(dispositions.size<2)return{blocked:false,exceptionMayApply:false,source:S61,reason:'The same-act charges do not have different final dispositions.'};
 const t=f.trafficStatute??'',traffic=/^(4507|4510|4511|4549)\./.test(t)&&!/^4511\.(19|194)$/.test(t);
 const ex=!!f.oneTrafficConvictionOnly&&traffic&&!f.commercialDriverLicense&&!!f.allOtherChargesEligible;
 return{blocked:!ex,exceptionMayApply:ex,source:S61,reason:ex?'The narrow one-traffic-conviction exception may permit all records to be handled together; partial relief is not allowed.':'Different final dispositions from the same act remain blocked until all associated charges can be addressed together.'};
}
