// Aggregate *self-reported engineering* coverage; never treat as independent legal sign-off.
import { BATCH01_COMPLETENESS } from './completeness.ts';
import { BATCH02_COMPLETENESS } from './batch02.ts';
import { BATCH03_COMPLETENESS } from './batch03.ts';
import { BATCH04_COMPLETENESS } from './batch04.ts';
import { BATCH05_COMPLETENESS } from './batch05.ts';
import { BATCH06_COMPLETENESS } from './batch06.ts';
import { FEDERAL_COMPLETENESS } from './federal-completeness.ts';
import { DISTRICT_COLUMBIA_COMPLETENESS } from './district-columbia-completeness.ts';
import { PUERTO_RICO_COMPLETENESS } from './puerto-rico-completeness.ts';
import { GUAM_COMPLETENESS } from './guam-completeness.ts';
import { VIRGIN_ISLANDS_COMPLETENESS } from './virgin-islands-completeness.ts';
import { AMERICAN_SAMOA_COMPLETENESS } from './american-samoa-completeness.ts';
import { NORTHERN_MARIANA_ISLANDS_COMPLETENESS } from './northern-mariana-islands-completeness.ts';
import { JURISDICTIONS } from './jurisdiction-engine.ts';
export const NATIONWIDE_ENGINEERING_COMPLETENESS = [
 ...BATCH01_COMPLETENESS,...BATCH02_COMPLETENESS,...BATCH03_COMPLETENESS,
 ...BATCH04_COMPLETENESS,...BATCH05_COMPLETENESS,...BATCH06_COMPLETENESS,
 FEDERAL_COMPLETENESS,DISTRICT_COLUMBIA_COMPLETENESS,PUERTO_RICO_COMPLETENESS,
 GUAM_COMPLETENESS,VIRGIN_ISLANDS_COMPLETENESS,AMERICAN_SAMOA_COMPLETENESS,
 NORTHERN_MARIANA_ISLANDS_COMPLETENESS,
] as const;
export const NATIONWIDE_COMPLETENESS_BY_CODE = new Map(NATIONWIDE_ENGINEERING_COMPLETENESS.map(x=>[x.jurisdictionCode,x]));
export function nationwideEngineeringCalculationGate(code:string):boolean {
 const record=NATIONWIDE_COMPLETENESS_BY_CODE.get(code);
 return !!record && record.mayCalculate && record.substantiveRules && record.tests;
}
export function nationwideCompletenessIntegrity(){
 const codes=JURISDICTIONS.map(j=>j.code);
 return {expected:codes.length,records:NATIONWIDE_ENGINEERING_COMPLETENESS.length,
 missing:codes.filter(c=>!NATIONWIDE_COMPLETENESS_BY_CODE.has(c)),
 duplicates:codes.filter(c=>NATIONWIDE_ENGINEERING_COMPLETENESS.filter(r=>r.jurisdictionCode===c).length!==1),
 extra:NATIONWIDE_ENGINEERING_COMPLETENESS.map(x=>x.jurisdictionCode).filter(c=>!codes.includes(c)),
 enabled:codes.filter(nationwideEngineeringCalculationGate)};
}
