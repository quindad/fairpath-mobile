function timingSafeEqual(a:string|null,b:string):boolean{
 if(a===null)return false;
 const enc=new TextEncoder(),x=enc.encode(a),y=enc.encode(b);
 let diff=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]??0)^(y[i]??0);
 return diff===0;
}import { evaluatePublicRecordRelief } from '../../../src/core/record-relief/public-evaluation.ts';
export type PublicDevDeps={allowedOrigin:string;secret:string;allow(key:string):Promise<boolean>};
const headers=(origin:string)=>({'content-type':'application/json','cache-control':'no-store','vary':'Origin','access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, x-fairpath-integration-secret'});
const json=(status:number,data:unknown,origin:string)=>new Response(JSON.stringify(data),{status,headers:headers(origin)});
/** Server-to-server DEV prototype; do not expose a secret in browser JavaScript. */
export async function handlePublicDevEvaluation(request:Request,deps:PublicDevDeps):Promise<Response>{
 const origin=request.headers.get('origin');
 if(!deps.allowedOrigin||!deps.secret||!origin||origin!==deps.allowedOrigin)return json(403,{error:'forbidden'},deps.allowedOrigin);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
 if(request.method!=='POST')return json(405,{error:'method_not_allowed'},origin);
 if(!timingSafeEqual(request.headers.get('x-fairpath-integration-secret'),deps.secret))return json(401,{error:'unauthorized'},origin);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json(415,{error:'unsupported_media_type'},origin);
 if(Number(request.headers.get('content-length')??'0')>65536)return json(413,{error:'request_too_large'},origin);
 const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>65536)return json(413,{error:'request_too_large'},origin);
 let payload:unknown;try{payload=JSON.parse(raw)}catch{return json(400,{error:'invalid_json'},origin)}
 const key='public-relief-dev'; // Shared global budget; do not trust client-supplied IP headers.
 try{if(!await deps.allow(key))return json(429,{error:'rate_limited'},origin)}catch{return json(503,{error:'rate_limit_unavailable'},origin)}
 try{return json(200,evaluatePublicRecordRelief(payload),origin)}catch{return json(400,{error:'invalid_evaluation_request'},origin)}
}
