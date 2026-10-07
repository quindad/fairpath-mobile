import test from'node:test';import assert from'node:assert/strict';import{ohioAggregatedConvictionCount,ohio2950SealingDate,ohioBailForfeitureDate,OHIO_CURRENT_RELIEF}from'../src/core/record-relief/ohio-current.ts';
test('OH same act convictions count as one',()=>assert.equal(ohioAggregatedConvictionCount(4,{sameActOrTime:true}),1));
test('OH two or three related same-proceeding convictions may aggregate',()=>assert.equal(ohioAggregatedConvictionCount(3,{sameProceedingRelatedWithin3Months:true,courtDeclinesAggregation:false}),1));
test('OH court can decline related three-month aggregation',()=>assert.equal(ohioAggregatedConvictionCount(3,{sameProceedingRelatedWithin3Months:true,courtDeclinesAggregation:true}),3));
test('OH Chapter 2950 special sealing clock is five years after requirements end',()=>assert.equal(ohio2950SealingDate('2025-01-01'),'2030-01-01'));
test('OH bail forfeiture sealing has no wait',()=>assert.equal(ohioBailForfeitureDate('2026-01-01','sealing'),'2026-01-01'));
test('OH bail forfeiture expungement waits one year',()=>assert.equal(ohioBailForfeitureDate('2026-01-01','expungement'),'2027-01-01'));
test('OH minor misdemeanor bail forfeiture expungement waits six months',()=>assert.equal(ohioBailForfeitureDate('2026-01-01','expungement',true),'2026-07-01'));
test('OH current fees are explicit and local fee is only a maximum',()=>{assert.equal(OHIO_CURRENT_RELIEF.general.fee,50);assert.equal(OHIO_CURRENT_RELIEF.general.localCourtFeeMaximum,50);assert.equal(OHIO_CURRENT_RELIEF.cqe.povertyWaiver,true)});
