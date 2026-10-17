/** Opt-in DEV-only Redis REST smoke. No credentials or URLs are logged or stored. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDevTarget } from './check-public-relief-dev-target.mjs';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requiredRef = 'znvhmuhojvwvjzmaqwff';
const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
const base = 'fairpath:record-relief-dev:integration-smoke:';
function checkConfig(){
 const linkedRef=readFileSync(resolve(root,'supabase/.temp/project-ref'),'utf8').trim();
 assertDevTarget({linkedRef,explicitRef:process.env.FAIRPATH_DEPLOY_TARGET_REF,confirmation:process.env.FAIRPATH_DEV_DEPLOY_CONFIRMATION});
 const url=process.env.PUBLIC_RELIEF_DEV_REDIS_URL,token=process.env.PUBLIC_RELIEF_DEV_REDIS_TOKEN;
 if(!url||!token||!url.startsWith('https://')||new URL(url).username||new URL(url).password||process.env.FAIRPATH_REDIS_LIVE_TEST!=='I_APPROVE_DEV_REDIS_TEST')throw Error('missing_dev_only_test_configuration');
 if(!process.env.PUBLIC_RELIEF_DEV_REDIS_PROJECT_REF||process.env.PUBLIC_RELIEF_DEV_REDIS_PROJECT_REF!==requiredRef)throw Error('redis_project_not_explicitly_dev');
 return {url:url.replace(/\/$/,''),token};
}
async function post(config,command){
 const response=await fetch(config.url+'/'+command[0],{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(command.slice(1)),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('redis_http_failure_'+response.status);
 const result=await response.json();
 if(!result||result.error!==undefined)throw Error('redis_provider_error');
 return result.result;
}
async function main(){
 const config=checkConfig();const key=base+randomUUID();
 // Short-lived isolated fixture; no DEL or modification to existing Redis keys.
 const counts=await Promise.all(Array.from({length:4},()=>post(config,['eval',script,1,key,90])));
 const sorted=[...counts].sort((a,b)=>a-b);
 if(JSON.stringify(sorted)!=='[1,2,3,4]')throw Error('atomic_concurrency_failed');
 const ttl=await post(config,['ttl',key]);
 if(!Number.isInteger(ttl)||ttl<1||ttl>90)throw Error('expiry_not_set');
 console.log('PASS: DEV Redis REST EVAL atomic concurrency and 90-second TTL. Fixture expires automatically.');
}
main().catch(()=>{console.error('NO-GO: Redis DEV integration smoke failed or is not explicitly configured. No credentials displayed.');process.exitCode=1;});
