import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync('supabase/functions/notification-receipt-worker/index.ts','utf8');
assert.match(source, /\.order\('created_at',\s*\{\s*ascending:\s*true\s*\}\)/, 'pending receipts must be processed oldest first so newer volume cannot starve older receipts');
async function run({env={},pending=[],provider=async()=>Response.json({data:{}}),lookupError=null}={}){
 let handler;const updates=[];
 const chain={select(){return this},eq(){return this},lt(){return this},order(){return this},limit:async()=>({data:pending,error:lookupError}),update(values){updates.push(values);return this}};
 const db={from:()=>chain};
 const js=ts.transpileModule(source.replace(/import \{ createClient \} from 'npm:@supabase\/supabase-js@2';/,'').replace('Deno.serve(','globalThis.__setHandler('),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInContext(js,vm.createContext({Response,Request,Headers,AbortSignal,Date,fetch:provider,createClient:()=>db,Deno:{env:{get:k=>env[k]}},__setHandler:fn=>{handler=fn}}));
 const response=await handler(new Request('https://receipt.test',{method:'POST',headers:{authorization:env.REQUEST_AUTH??''}}));
 const text=await response.text();let body;try{body=JSON.parse(text)}catch{body=text}
 return {response,body,updates};
}
let r=await run();assert.equal(r.response.status,401);
const env={NOTIFICATION_WORKER_SECRET:'s',REQUEST_AUTH:'Bearer s',SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'k'};
r=await run({env});assert.deepEqual(r.body,{checked:0});
r=await run({env,lookupError:{message:'down'}});assert.equal(r.response.status,500);
const pending=[{id:'r1',ticket_id:'t1',token:'ExponentPushToken[dead]'}];
r=await run({env,pending,provider:async()=>Response.json({data:{t1:{status:'error',message:'gone',details:{error:'DeviceNotRegistered'}}}})});
assert.deepEqual(r.body,{checked:1,invalidated:1});
assert.ok(r.updates.some(x=>x.error_code==='DeviceNotRegistered'));
assert.ok(r.updates.some(x=>x.disabled_at));
r=await run({env,pending,provider:async()=>new Response('down',{status:503})});assert.equal(r.response.status,502);
r=await run({env,pending,provider:async()=>{throw new Error('network timeout')}});assert.equal(r.response.status,502);
r=await run({env,pending,provider:async()=>new Response('not-json',{status:200})});assert.equal(r.response.status,502);
r=await run({env,pending,provider:async()=>Response.json({data:[]})});assert.equal(r.response.status,502);
r=await run({env,pending,provider:async()=>Response.json({data:{t1:{status:'unknown'}}})});assert.deepEqual(r.body,{checked:0,invalidated:0});assert.equal(r.updates.length,0);
console.log('PASS receipt auth, config, lookup failure, provider outage, receipt reconciliation and invalid-token retirement');
