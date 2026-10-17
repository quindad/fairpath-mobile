import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {assertDevTarget,EXPECTED_DEV_REF} from '../scripts/check-public-relief-dev-target.mjs';
test('fails closed for absent, production, mismatched and unconfirmed target',()=>{
 for(const v of [{},{linkedRef:'rqpczemdagoddhuwefxt',explicitRef:EXPECTED_DEV_REF,confirmation:'CONFIRM_FAIRPATH_DEV_ONLY'},{linkedRef:EXPECTED_DEV_REF,explicitRef:'rqpczemdagoddhuwefxt',confirmation:'CONFIRM_FAIRPATH_DEV_ONLY'},{linkedRef:EXPECTED_DEV_REF,explicitRef:EXPECTED_DEV_REF,confirmation:''}])assert.throws(()=>assertDevTarget(v));
});
test('accepts exact DEV ref only with explicit confirmation',()=>assert.equal(assertDevTarget({linkedRef:EXPECTED_DEV_REF,explicitRef:EXPECTED_DEV_REF,confirmation:'CONFIRM_FAIRPATH_DEV_ONLY'}),true));