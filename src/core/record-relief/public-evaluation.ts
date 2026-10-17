import { evaluateApiRequest } from './api-contract.ts';
import { JURISDICTION_BY_CODE, type CaseBundle } from './jurisdiction-engine.ts';

export type PublicEvaluationInput = { apiVersion:'v1'; caseBundle:CaseBundle; facts?:Record<string,unknown> };
const DISPOSITIONS = new Set(['conviction','dismissal','acquittal','deferred_adjudication','nolle_prosequi','arrest_no_charge','pending','unknown']);
const DEGREES = new Set(['infraction','minor_misdemeanor','misdemeanor','felony','unknown']);
const LEVELS = new Set(['municipal','county','district','circuit','superior','common_pleas','general','limited','juvenile','federal_district','military','unknown']);
const validDate = (v:unknown) => v===undefined || (typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v);
const safeText = (v:unknown,max:number) => typeof v==='string' && v.trim().length>0 && v.length<=max;

const optionalText=(v:unknown,max:number)=>v===undefined||(typeof v==='string'&&v.length<=max);
const optionalBool=(v:unknown)=>v===undefined||typeof v==='boolean';
const optionalDegreeLevel=(v:unknown)=>v===undefined||(typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=100);
const FACT_KEY=/^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const safeFactValue=(v:unknown)=>v===null||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1000000000)||(typeof v==='string'&&v.length<=256);
/** Pure, read-only public adapter: no database client, case ID, auth token, or persistence. */
export function evaluatePublicRecordRelief(input:unknown) {
 if(!input||typeof input!=='object'||Array.isArray(input)) throw new Error('invalid_request');
 const x=input as Record<string,unknown>;
 if(Object.keys(x).some(k=>!['apiVersion','caseBundle','facts'].includes(k)))throw new Error('unexpected_fields');
 if(x.apiVersion!=='v1'||x.caseId!==undefined||x.consumer!==undefined||x.userId!==undefined||x.accessToken!==undefined)throw new Error('invalid_request');
 const b=x.caseBundle as CaseBundle|undefined;
 if(!b||typeof b!=='object'||Array.isArray(b)||!b.venue||!b.charges||!Array.isArray(b.charges))throw new Error('invalid_case_bundle');
 if(Object.keys(b).some(k=>!['venue','charges','pendingOtherCases'].includes(k))||Object.keys(b.venue).some(k=>!['jurisdictionCode','stateCode','county','city','courtName','courtLevel','federalSubtype'].includes(k))||b.pendingOtherCases!==undefined&&typeof b.pendingOtherCases!=='boolean')throw new Error('unexpected_case_fields');
 if(!optionalText(b.venue.stateCode,16)||!optionalText(b.venue.county,120)||!optionalText(b.venue.city,120)||!optionalText(b.venue.courtName,160)||!optionalText(b.venue.federalSubtype,80))throw new Error('invalid_venue_fields');
 if(!safeText(b.venue.jurisdictionCode,16)||!JURISDICTION_BY_CODE.has(b.venue.jurisdictionCode)||!LEVELS.has(b.venue.courtLevel)||b.charges.length<1||b.charges.length>100)throw new Error('invalid_case_bundle');
 if(b.charges.some(c=>!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['id','offenseName','statute','degree','degreeLevel','disposition','dispositionDate','convictionDate','sentenceCompletionDate','supervisionCompletionDate','releaseDate','finesPaid','restitutionPaid'].includes(k))||!optionalText(c.statute,160)||!optionalDegreeLevel(c.degreeLevel)||!optionalBool(c.finesPaid)||!optionalBool(c.restitutionPaid)||!safeText(c.id,100)||!safeText(c.offenseName,500)||!DEGREES.has(c.degree)||!DISPOSITIONS.has(c.disposition)||!validDate(c.dispositionDate)||!validDate(c.convictionDate)||!validDate(c.sentenceCompletionDate)||!validDate(c.supervisionCompletionDate)||!validDate(c.releaseDate)))throw new Error('invalid_charges');
 if(new Set(b.charges.map(c=>c.id)).size!==b.charges.length)throw new Error('duplicate_charge_ids');
 if(x.facts!==undefined&&(!x.facts||typeof x.facts!=='object'||Array.isArray(x.facts)||Object.keys(x.facts).length>100))throw new Error('invalid_facts');
 if(x.facts!==undefined&&Object.entries(x.facts as Record<string,unknown>).some(([key,value])=>!FACT_KEY.test(key)||!safeFactValue(value)))throw new Error('invalid_fact_values');
 if(new TextEncoder().encode(JSON.stringify(x)).byteLength>65536)throw new Error('request_too_large');
 const out=evaluateApiRequest({apiVersion:'v1',consumer:'web',caseBundle:b,facts:(x.facts??{}) as Record<string,unknown>});
 return {apiVersion:'v1',authorityCode:out.authorityCode,engineVersion:out.engineVersion,ok:out.ok,issues:out.issues,freshness:out.freshness,results:out.results.map(r=>({jurisdictionCode:r.jurisdictionCode,chargeIds:r.chargeIds,remedy:r.remedy,outcome:r.outcome,reasons:r.reasons,missingFacts:r.missingFacts,source:r.source,eligibilityDate:r.eligibilityDate,courtSpecificFilingReady:r.courtSpecificFilingReady}))};
}
