import test from 'node:test';
import assert from 'node:assert/strict';
import { JURISDICTIONS } from '../src/core/record-relief/jurisdiction-engine.ts';
import { nationwideCompletenessIntegrity, nationwideEngineeringCalculationGate } from '../src/core/record-relief/nationwide-completeness.ts';
test('nationwide engineering completeness covers every jurisdiction exactly once',()=>{
 const x=nationwideCompletenessIntegrity();
 assert.equal(x.expected,57);
 assert.equal(x.records,57);
 assert.deepEqual(x.missing,[]);
 assert.deepEqual(x.duplicates,[]);
 assert.deepEqual(x.extra,[]);
 assert.equal(x.enabled.length,57);
 for(const j of JURISDICTIONS)assert.equal(nationwideEngineeringCalculationGate(j.code),true,j.code);
 assert.equal(nationwideEngineeringCalculationGate('US-XX'),false);
});
