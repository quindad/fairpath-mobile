import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {evaluatePublicRecordRelief} from '../src/core/record-relief/public-evaluation.ts';
const charge=(id:string,disposition='dismissal')=>({id,offenseName:'Test fixture offense',degree:'misdemeanor' as string,disposition});
const input=(jurisdictionCode='US-OH',charges=[charge('a')])=>({apiVersion:'v1' as const,caseBundle:{venue:{jurisdictionCode,courtLevel:'county' as const,county:'Test County'},charges}});
test('multiple charges are evaluated without persistence or member identity',()=>{const r=evaluatePublicRecordRelief(input('US-OH',[charge('a'),charge('b','conviction')]));assert.equal(r.apiVersion,'v1');assert.ok(r.results.length>=2||r.issues.length>0);assert.equal('caseId' in r,false);assert.equal('userId' in r,false)});
test('federal cases stay in federal jurisdiction',()=>{const r=evaluatePublicRecordRelief(input('US-FED'));assert.equal(r.authorityCode,'US-FED')});
test('missing facts never fabricate a verified eligible result',()=>{const r=evaluatePublicRecordRelief(input('US-OH',[{...charge('a'),degree:'unknown' as const,disposition:'unknown'}]));assert.ok(!r.results.some(x=>x.outcome==='likely_eligible_verified'&&x.missingFacts.length>0))});
test('rejects identity and unsupported jurisdictions',()=>{assert.throws(()=>evaluatePublicRecordRelief({...input(),caseId:'private'}));assert.throws(()=>evaluatePublicRecordRelief(input('INVALID')))});
test('source provenance exists on results',()=>{const r=evaluatePublicRecordRelief(input());for(const x of r.results){assert.equal(typeof x.source.citation,'string');assert.equal(typeof x.source.verifiedOn,'string')}});

import { JURISDICTIONS } from '../src/core/record-relief/jurisdiction-engine.ts';
test('all 57 jurisdictions route through shared engine',()=>{assert.equal(JURISDICTIONS.length,57);for(const j of JURISDICTIONS){const r=evaluatePublicRecordRelief(input(j.code));assert.equal(r.authorityCode,j.code)}});
test('rejects invalid calendar dates and duplicate charge ids',()=>{assert.throws(()=>evaluatePublicRecordRelief(input('US-OH',[Object.assign({},charge('a'),{dispositionDate:'2026-02-30'})])));assert.throws(()=>evaluatePublicRecordRelief(input('US-OH',[charge('a'),charge('a')])))});
test('limits public charge count',()=>{assert.throws(()=>evaluatePublicRecordRelief(input('US-OH',Array.from({length:101},(_,i)=>charge(String(i))))))});

test('rejects unexpected fields rather than silently accepting personal data',()=>{assert.throws(()=>evaluatePublicRecordRelief({...input(),socialSecurityNumber:'not-allowed'}));assert.throws(()=>evaluatePublicRecordRelief(input('US-OH',[Object.assign({},charge('a'),{fullName:'not-allowed'})])))});

test('rejects nested facts and invalid optional charge fields',()=>{assert.throws(()=>evaluatePublicRecordRelief({...input(),facts:{unexpected:{ssn:'test'}}}));assert.throws(()=>evaluatePublicRecordRelief(input('US-OH',[Object.assign({},charge('a'),{degreeLevel:'five'})])))});
