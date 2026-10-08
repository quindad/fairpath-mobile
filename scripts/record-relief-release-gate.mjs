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
 ['Live physical Storage deletion and database scrub verified','PASS','2026-10-08 DEV request 193: deleted=1, failed=0; physical download/list and database scrub verified'],
 ['Live Storage-removal failure behavior verified','PASS','2026-10-08 DEV request 195: deleted=0, failed=1; unavailable-object row retained with its path'],
 ['Official court-source verification for 57 jurisdictions','BLOCKED','56/57 have source-checked directory entries; American Samoa remains unverified'],
 ['Local filing profile/forms verification for 57 jurisdictions','BLOCKED','Research exists for 56 jurisdictions, but live filing rules/forms are not fully populated or legally approved'],
 ['Independent legal review for 57 jurisdictions','BLOCKED','0/57 approvals'],
 ['Explicit founder production deployment approval','BLOCKED','Not requested or granted']
];
for(const [name,status,detail] of required)if(status==='BLOCKED')blockers.push(name+': '+detail);
console.log(JSON.stringify({releaseReady:blockers.length===0,engineeringInventory:{expected:x.expected,records:x.records,enabled:x.enabled.length},blockers},null,2));
if(blockers.length)process.exitCode=1;
