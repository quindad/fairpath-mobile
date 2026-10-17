import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async request => {
 const secret = Deno.env.get('NOTIFICATION_WORKER_SECRET');
 if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
  return new Response('Unauthorized', { status: 401 });
 }
 const url = Deno.env.get('SUPABASE_URL');
 const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if (!url || !key) return new Response('Worker not configured', { status: 503 });
 const db = createClient(url, key, { auth: { persistSession: false } });
 const cutoff = new Date(Date.now() - 60_000).toISOString();
 const { data: pending, error } = await db.from('notification_push_receipts')
  .select('id,ticket_id,token').eq('status','pending').lt('created_at',cutoff).order('created_at', { ascending: true }).limit(100);
 if (error) return Response.json({ error: 'Receipt lookup failed' }, { status: 500 });
 if (!pending?.length) return Response.json({ checked: 0 });
 let response: Response;
 try {
 response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: pending.map(r=>r.ticket_id) }),
  signal: AbortSignal.timeout(15000)
 });
 } catch {
  return Response.json({ error: 'Receipt provider request failed' }, { status: 502 });
 }
 if (!response.ok) return Response.json({ error: 'Receipt provider unavailable' }, { status: 502 });
 let payload: { data?: Record<string, { status?: string; details?: { error?: string }; message?: string }> };
 try { payload = await response.json(); } catch {
  return Response.json({ error: 'Invalid receipt provider response' }, { status: 502 });
 }
 if (!payload || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
  return Response.json({ error: 'Invalid receipt provider response' }, { status: 502 });
 }
 let checked=0, invalidated=0;
 for (const item of pending) {
  const receipt=payload.data?.[item.ticket_id];
  if (!receipt || (receipt.status !== 'ok' && receipt.status !== 'error')) continue;
  const status=receipt.status;
  const code=receipt.details?.error ?? null;
  const { error: saveError }=await db.from('notification_push_receipts').update({
   status, error_code:code, error_message:receipt.message ?? null,
   checked_at:new Date().toISOString()
  }).eq('id',item.id).eq('status','pending');
  if (saveError) continue;
  checked++;
  if (code==='DeviceNotRegistered') {
   const { error: tokenError }=await db.from('push_tokens')
    .update({ disabled_at:new Date().toISOString() }).eq('token',item.token);
   if (!tokenError) invalidated++;
  }
 }
 return Response.json({ checked, invalidated });
});
