import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
export const EXPECTED_DEV_REF='znvhmuhojvwvjzmaqwff';
export function assertDevTarget({linkedRef,explicitRef,confirmation}){
 if(linkedRef!==EXPECTED_DEV_REF||explicitRef!==EXPECTED_DEV_REF||confirmation!=='CONFIRM_FAIRPATH_DEV_ONLY')throw Error('REFUSE_DEPLOY_NON_DEV_OR_UNCONFIRMED');
 return true;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const linkedRef=readFileSync(resolve(root,'supabase/.temp/project-ref'),'utf8').trim();
  assertDevTarget({linkedRef,explicitRef:process.env.FAIRPATH_DEPLOY_TARGET_REF,confirmation:process.env.FAIRPATH_DEV_DEPLOY_CONFIRMATION});
  console.log('DEV target preflight passed. This check does NOT deploy.');
 }catch{console.error('NO-GO: DEV target not explicitly verified. No deployment attempted.');process.exitCode=1;}
}