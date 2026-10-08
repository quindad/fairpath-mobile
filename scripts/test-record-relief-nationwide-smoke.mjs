// Nationwide executable adapter smoke test; tests runtime safety, NOT substantive legal correctness.
import { JURISDICTIONS } from '../src/core/record-relief/jurisdiction-engine.ts';
import { ENGINE_REGISTRY } from '../src/core/record-relief/engine-registry.ts';
import { EXECUTABLE_ADAPTERS, executeRecordRelief } from '../src/core/record-relief/engine-executor.ts';
import { writeFileSync } from 'node:fs';
const results=[];
const expected=new Set(JURISDICTIONS.map(j=>j.code));
for(const j of JURISDICTIONS){
 const bundle={venue:{jurisdictionCode:j.code,courtLevel:j.kind==='federal'?'federal_district':'county',courtName:'Synthetic Test Court',county:j.kind==='federal'?undefined:'Synthetic County',federalSubtype:j.kind==='federal'?'united_states_code':undefined},charges:[{id:'synthetic-charge',offenseName:'Synthetic offense — NOT REAL CASE',degree:'unknown',disposition:'unknown'}]};
 const x=executeRecordRelief(bundle,{today:'2026-10-08'});
 const issues=[];
 if(!ENGINE_REGISTRY[j.code])issues.push('registry_missing');
 if(!EXECUTABLE_ADAPTERS[j.code])issues.push('adapter_missing');
 if(!x.ok)issues.push(...x.issues);
 if(x.ok && x.results.length!==1)issues.push('wrong_result_count');
 for(const z of x.results){
  if(z.jurisdictionCode!==j.code)issues.push('jurisdiction_mismatch');
  if(!z.source?.citation||!z.source?.url)issues.push('missing_source');
  if(!Array.isArray(z.missingFacts))issues.push('missing_facts_not_array');
  if(z.courtSpecificFilingReady===true)issues.push('invented_court_filing_readiness');
  if(z.outcome==='likely_eligible_verified')issues.push('false_positive_with_unknown_disposition_and_degree');
 }
 results.push({jurisdiction:j.code,pass:issues.length===0,issues,outcomes:x.results.map(z=>z.outcome)});
}
const extras=Object.keys(EXECUTABLE_ADAPTERS).filter(x=>!expected.has(x));
const report={runAt:'2026-10-08',kind:'runtime smoke test only; not independent legal verification',total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,extraAdapters:extras,results};
writeFileSync('docs/record-relief-nationwide-smoke-results.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed,extraAdapters:extras,failures:results.filter(x=>!x.pass)},null,2));
if(report.failed||extras.length)process.exitCode=1;
