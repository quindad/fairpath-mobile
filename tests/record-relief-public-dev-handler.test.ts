import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {handlePublicDevEvaluation} from '../supabase/functions/public-record-relief-dev/handler.ts';
const origin='http://localhost:3000';const secret='test-secret-not-for-production';
const deps={allowedOrigin:origin,secret,allow:async(_key:string)=>true};
const payload={apiVersion:'v1',caseBundle:{venue:{jurisdictionCode:'US-OH',courtLevel:'county',county:'Test County'},charges:[{id:'1',offenseName:'TEST FIXTURE',degree:'misdemeanor',disposition:'dismissal'}]}};
const request=(body=JSON.stringify(payload),overrides:Record<string,string>={})=>new Request(origin+'/api',{method:'POST',headers:{origin,'content-type':'application/json','x-fairpath-integration-secret':secret,...overrides},body});
test('stateless evaluation returns source and no private case identity',async()=>{const r=await handlePublicDevEvaluation(request(),deps);assert.equal(r.status,200);const out=await r.json();assert.equal(out.authorityCode,'US-OH');assert.equal('caseId' in out,false);assert.ok(out.results.every((x:any)=>typeof x.source.citation==='string'))});
test('unauthorized, forbidden origin and malformed JSON rejected',async()=>{assert.equal((await handlePublicDevEvaluation(request(undefined,{'x-fairpath-integration-secret':'wrong'}),deps)).status,401);assert.equal((await handlePublicDevEvaluation(request(undefined,{origin:'https://evil.test'}),deps)).status,403);assert.equal((await handlePublicDevEvaluation(request('{bad'),deps)).status,400)});
test('shared limiter rejects or fails closed',async()=>{assert.equal((await handlePublicDevEvaluation(request(),{...deps,allow:async()=>false})).status,429);assert.equal((await handlePublicDevEvaluation(request(),{...deps,allow:async()=>{throw Error('store down')}})).status,503)});
test('rejects oversized and invalid inputs',async()=>{assert.equal((await handlePublicDevEvaluation(request('x'.repeat(65537)),deps)).status,413);assert.equal((await handlePublicDevEvaluation(request('{}'),deps)).status,400)});

test('rejects multibyte UTF-8 body over 64 KiB',async()=>{const body='é'.repeat(33000);assert.ok(body.length<65536);assert.ok(new TextEncoder().encode(body).byteLength>65536);assert.equal((await handlePublicDevEvaluation(request(body),deps)).status,413)});
