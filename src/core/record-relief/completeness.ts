import type{JurisdictionCompleteness}from'./rule-contract';
export const BATCH01_COMPLETENESS:readonly JurisdictionCompleteness[]=[
{jurisdictionCode:'US-OH',remedies:true,substantiveRules:true,historicalVersions:false,courtHierarchy:true,localFilingProfiles:false,forms:false,tests:true,mayCalculate:true,verifiedOn:'2026-10-07',notes:['Current core and special pathways executable.','Historical rule versions and complete court-specific filing profiles remain gated.']},
{jurisdictionCode:'US-MD',remedies:true,substantiveRules:false,historicalVersions:false,courtHierarchy:true,localFilingProfiles:false,forms:true,tests:true,mayCalculate:false,verifiedOn:'2026-10-07',notes:['Favorable/PBJ logic executable; §10-110 offense matrix not yet complete.']},
{jurisdictionCode:'US-PA',remedies:true,substantiveRules:false,historicalVersions:false,courtHierarchy:true,localFilingProfiles:false,forms:true,tests:true,mayCalculate:false,verifiedOn:'2026-10-07',notes:['Limited-access gates executable; full offense/exclusion normalization remains.']},
{jurisdictionCode:'US-MI',remedies:true,substantiveRules:false,historicalVersions:false,courtHierarchy:true,localFilingProfiles:false,forms:false,tests:true,mayCalculate:false,verifiedOn:'2026-10-07',notes:['Application and automatic timing executable; complete prohibited-offense matrix remains.']},
{jurisdictionCode:'US-IN',remedies:true,substantiveRules:false,historicalVersions:false,courtHierarchy:true,localFilingProfiles:false,forms:false,tests:true,mayCalculate:false,verifiedOn:'2026-10-07',notes:['Section timing/exclusions scaffold executable; full conviction classification remains.']}
];
export function calculationGate(code:string){return BATCH01_COMPLETENESS.find(x=>x.jurisdictionCode===code)?.mayCalculate===true}
