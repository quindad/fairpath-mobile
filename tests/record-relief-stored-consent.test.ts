import test from 'node:test';
import assert from 'node:assert/strict';
import {handleExtract} from '../supabase/functions/extract-record-relief-case/handler.ts';
const id='123e4567-e89b-12d3-a456-426614174000';
test('AI extraction rejects client consent flag without stored consent before document download',async()=>{
 let downloads=0,engines=0;
 const deps={enabled:()=>true,getUserId:async()=> 'member',getOwnUpload:async()=>({id,status:'uploaded',mime_type:'application/pdf',byte_size:50,storage_path:'member/file.pdf',consented_at:null}),download:async()=>{downloads++;return new Uint8Array([1])},runEngine:async()=>{engines++;return null},save:async()=>({model_version:'x',extracted_at:'now'}),markFailed:async()=>{}};
 const out=await handleExtract('POST','Bearer synthetic',JSON.stringify({consent:true,upload_id:id}),deps);
 assert.equal(out.status,403);assert.deepEqual(out.body,{error:'stored_consent_required'});assert.equal(downloads,0);assert.equal(engines,0);
});
