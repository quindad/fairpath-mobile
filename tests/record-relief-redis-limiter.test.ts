import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { checkRedisLimit, REDIS_LIMIT_SCRIPT } from '../supabase/functions/public-record-relief-dev/redis-limiter.ts';
const base={url:'https://redis.example.test',token:'fixture-token',key:'global',now:0};
test('Redis EVAL uses atomic INCR and initial EXPIRE',async()=>{
 let requestBody:unknown;let requestUrl='';
 const ok=await checkRedisLimit({...base,fetcher:async(url,options)=>{requestUrl=String(url);requestBody=JSON.parse(String(options?.body));return new Response(JSON.stringify({result:1}),{status:200})}});
 assert.equal(ok,true);assert.equal(requestUrl,'https://redis.example.test/eval');
 const b=requestBody as unknown[];assert.equal(b[0],REDIS_LIMIT_SCRIPT);assert.equal(b[1],1);assert.match(String(b[2]),/fairpath:record-relief-dev:global:0/);assert.equal(b[3],3600);
 assert.match(REDIS_LIMIT_SCRIPT,/INCR/);assert.match(REDIS_LIMIT_SCRIPT,/EXPIRE/);
});
test('limits on 121st request',async()=>assert.equal(await checkRedisLimit({...base,fetcher:async()=>new Response('{"result":121}',{status:200})}),false));
test('rejects malformed response, HTTP failures and network outage',async()=>{
 for(const fetcher of [async()=>new Response('{"result":"1"}',{status:200}),async()=>new Response('{}',{status:200}),async()=>new Response('oops',{status:500}),async()=>{throw Error('network down')}])await assert.rejects(checkRedisLimit({...base,fetcher}));
});
test('concurrent requests use shared atomic result, no local race',async()=>{
 let counter=0;const fetcher=async()=>new Response(JSON.stringify({result:++counter}),{status:200});
 const outcomes=await Promise.all(Array.from({length:125},()=>checkRedisLimit({...base,fetcher})));
 assert.equal(outcomes.filter(Boolean).length,120);
});