/** Read-only release gate. This script NEVER invokes deployment commands. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertDevTarget} from './check-public-relief-dev-target.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
try{
 const linkedRef=readFileSync(resolve(root,'supabase/.temp/project-ref'),'utf8').trim();
 assertDevTarget({linkedRef,explicitRef:process.env.FAIRPATH_DEPLOY_TARGET_REF,confirmation:process.env.FAIRPATH_DEV_DEPLOY_CONFIRMATION});
 const config=readFileSync(resolve(root,'supabase/config.toml'),'utf8');
 if(!/\[functions\.public-record-relief-dev\]\s*verify_jwt\s*=\s*false/.test(config))throw Error('missing_function_config');
 console.log('PASS: DEV project and function config verified. NO DEPLOYMENT EXECUTED.');
}catch{console.error('NO-GO: DEV release preflight failed. NO DEPLOYMENT EXECUTED.');process.exitCode=1;}