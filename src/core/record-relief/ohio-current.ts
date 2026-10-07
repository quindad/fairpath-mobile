import type{Charge}from'./jurisdiction-engine';
export type OhioAggregationFacts={sameActOrTime?:boolean;sameProceedingRelatedWithin3Months?:boolean;courtDeclinesAggregation?:boolean};
export function ohioAggregatedConvictionCount(raw:number,f:OhioAggregationFacts){if(raw<1)return 0;if(f.sameActOrTime===true)return 1;if(raw<=3&&f.sameProceedingRelatedWithin3Months===true&&f.courtDeclinesAggregation!==true)return 1;return raw}
const add=(x:string,y:number)=>{const d=new Date(x+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()+y);return d.toISOString().slice(0,10)};
export function ohio2950SealingDate(chapter2950EndedDate?:string){return chapter2950EndedDate?add(chapter2950EndedDate,5):null}
export function ohioBailForfeitureDate(entryDate:string,remedy:'sealing'|'expungement',minorMisdemeanor=false){if(remedy==='sealing')return entryDate;const d=new Date(entryDate+'T00:00:00Z');if(minorMisdemeanor)d.setUTCMonth(d.getUTCMonth()+6);else d.setUTCFullYear(d.getUTCFullYear()+1);return d.toISOString().slice(0,10)}
export const OHIO_CURRENT_RELIEF={general:{citation:'R.C. 2953.32',fee:50,localCourtFeeMaximum:50,povertyAffidavit:true},marijuana:{citation:'R.C. 2953.321',fee:50,indigentException:true,effective:'2026-03-20'},cqe:{citation:'R.C. 2953.25',fee:50,povertyWaiver:true,effective:'2026-09-23'}}as const;
