import test from'node:test';import assert from'node:assert/strict';import{evaluateMarylandStet,evaluateMarylandNolleTreatment,evaluateMarylandReleasedWithoutCharge}from'../src/core/record-relief/maryland-extra.ts';import type{Charge}from'../src/core/record-relief/jurisdiction-engine.ts';
const c:Charge={id:'mdx',offenseName:'x',degree:'misdemeanor',disposition:'unknown'};
test('MD ordinary stet waits three years',()=>assert.equal(evaluateMarylandStet(c,'2026-10-07','2025-01-01').eligibilityDate,'2028-01-01'));
test('MD treatment stet requires completion date',()=>assert.equal(evaluateMarylandStet(c,'2026-10-07','2020-01-01',true).outcome,'additional_facts_required'));
test('MD completed treatment stet clears timing',()=>assert.equal(evaluateMarylandStet(c,'2026-10-07','2020-01-01',true,'2026-01-01').outcome,'likely_eligible_verified'));
test('MD nolle with treatment requires completion',()=>assert.equal(evaluateMarylandNolleTreatment(c).outcome,'additional_facts_required'));
test('MD post-2007 released without charge is automatic police-record branch',()=>assert.equal(evaluateMarylandReleasedWithoutCharge(c,'2020-01-01').outcome,'automatic_relief_may_apply'));
test('MD pre-2007 released without charge preserves historical request deadline',()=>assert.equal(evaluateMarylandReleasedWithoutCharge(c,'2000-01-01').eligibilityDate,'2008-01-01'));
