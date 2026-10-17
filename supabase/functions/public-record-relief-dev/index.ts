import { handlePublicDevEvaluation } from './handler.ts';
import { checkRedisLimit } from './redis-limiter.ts';
const DEV_REF='znvhmuhojvwvjzmaqwff';
const runtimeUrl=Deno.env.get('SUPABASE_URL')??'';
const expectedUrl=`https://${DEV_REF}.supabase.co`;
// Fail closed if deployed to the wrong Supabase project or if project identity is absent.
if(runtimeUrl.replace(/\/$/,'')!==expectedUrl)throw Error('dev_project_only');
const allowedOrigin=Deno.env.get('PUBLIC_RELIEF_DEV_ALLOWED_ORIGIN')??'';
const secret=Deno.env.get('PUBLIC_RELIEF_DEV_SHARED_SECRET')??'';
const redisUrl=Deno.env.get('PUBLIC_RELIEF_DEV_REDIS_URL')??'';
const redisToken=Deno.env.get('PUBLIC_RELIEF_DEV_REDIS_TOKEN')??'';
Deno.serve(request=>handlePublicDevEvaluation(request,{allowedOrigin,secret,allow:()=>checkRedisLimit({url:redisUrl,token:redisToken,key:'global',now:Date.now()})}));