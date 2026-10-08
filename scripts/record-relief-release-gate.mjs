// Fail-closed nationwide release evidence gate. No production actions.
import { readFileSync, existsSync } from 'node:fs';
import { nationwideCompletenessIntegrity } from '../src/core/record-relief/nationwide-completeness.ts';
const x=nationwideCompletenessIntegrity();
const blockers=[];
if(x.expected!==57||x.records!==57||x.missing.length||x.duplicates.length||x.extra.length||x.enabled.length!==57)blockers.push('Engineering completeness inventory does not match all 57 jurisdictions');
const smokePath='docs/record-relief-nationwide-smoke-results.json';
if(!existsSync(smokePath))blockers.push('Nationwide smoke evidence missing');
else {const smoke=JSON.parse(readFileSync(smokePath,'utf8'));if(smoke.total!==57||smoke.passed!==57||smoke.failed!==0)blockers.push('Nationwide smoke evidence is not 57/57 passing');}
const required=[
 ['Live physical Storage deletion and database scrub verified','BLOCKED','No disposable physical object was uploaded and expired in DEV'],
 ['Live Storage-removal failure behavior verified','BLOCKED','Only dependency-injected unit test is available'],
 ['Official court-source verification for 57 jurisdictions','BLOCKED','Last audit found 5/57'],
 ['Local filing profile/forms verification for 57 jurisdictions','BLOCKED','Last audit found 2/57'],
 ['Independent legal review for 57 jurisdictions','BLOCKED','0/57 approvals'],
 ['Explicit founder production deployment approval','BLOCKED','Not requested or granted']
];
for(const [name,status,detail] of required)if(status==='BLOCKED')blockers.push(name+': '+detail);
console.log(JSON.stringify({releaseReady:blockers.length===0,engineeringInventory:{expected:x.expected,records:x.records,enabled:x.enabled.length},blockers},null,2));
if(blockers.length)process.exitCode=1;
