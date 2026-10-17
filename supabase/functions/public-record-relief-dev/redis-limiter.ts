/** Atomic, shared Redis REST EVAL limiter. Never fall back to per-instance memory. */
export const REDIS_LIMIT_SCRIPT = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
export async function checkRedisLimit(args:{url:string;token:string;key:string;now:number;fetcher?:typeof fetch;limit?:number}):Promise<boolean>{
 const {url,token,key,now,fetcher=fetch,limit=120}=args;
 if(!url.startsWith('https://')||!token||!Number.isFinite(now)||!Number.isInteger(limit)||limit<1)throw Error('limiter_not_configured');
 const bucket=Math.floor(now/3600000);
 const response=await fetcher(url.replace(/\/$/,'')+'/eval',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify([REDIS_LIMIT_SCRIPT,1,'fairpath:record-relief-dev:'+key+':'+bucket,3600]),signal:AbortSignal.timeout(2500)});
 if(!response.ok)throw Error('limiter_unavailable');
 const data=await response.json() as {result?:unknown;error?:unknown};
 if(data.error||typeof data.result!=='number'||!Number.isInteger(data.result)||data.result<1)throw Error('limiter_invalid_response');
 return data.result<=limit;
}
