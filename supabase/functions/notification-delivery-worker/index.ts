import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request) => {
  const secret = Deno.env.get('NOTIFICATION_WORKER_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response('Worker not configured', { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.rpc('claim_notification_deliveries', { p_limit: 10 });
  if (error) return Response.json({ error: 'Claim failed' }, { status: 500 });
  let sent = 0;
  let failed = 0;
  for (const job of data ?? []) {
    try {
      const { data: due, error: prepareError } = await db.rpc('prepare_notification_token_attempts', { p_delivery_id: job.delivery_id, p_tokens: job.tokens ?? [] });
      if (prepareError) throw prepareError;
      const tokens: string[] = (due ?? []).map((item: { token: string }) => item.token);
      if (!tokens.length) {
        const { data: attempts, error: attemptsError } = await db.from('notification_token_attempts').select('status').eq('delivery_id', job.delivery_id);
        if (attemptsError) throw attemptsError;
        const unfinished = (attempts ?? []).some((a: { status: string }) => a.status === 'pending');
        const exhausted = (attempts ?? []).some((a: { status: string }) => a.status === 'failed');
        const acceptedPreviously = (attempts ?? []).some((a: { status: string }) => a.status === 'accepted');
        const { error: completionError } = await db.rpc('complete_notification_delivery', {
          p_id: job.delivery_id, p_status: unfinished || exhausted ? 'failed' : (acceptedPreviously ? 'sent' : 'skipped'),
          p_message: null, p_error: unfinished ? 'Token retry pending' : exhausted ? 'Token retry limit reached' : null
        });
        if (completionError) throw completionError;
        continue;
      }
      const messages = tokens.map(to => ({
        to, title: 'FairPath update', body: 'You have a new update in FairPath.',
        sound: 'default', data: { route: '/notifications' }
      }));
      const result = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(15000)
      });
      if (!result.ok) throw new Error('Push provider HTTP ' + result.status);
      const payload = await result.json();
      const tickets = Array.isArray(payload.data) ? payload.data : [payload.data];
      if (tickets.length !== tokens.length) throw new Error('Expo ticket count mismatch');
      const accepted = tickets.map((ticket: { id?: string; status?: string; details?: { error?: string } }, index: number) => ({ ticket, token: tokens[index] }))
        .filter(({ ticket }: { ticket: { status?: string } }) => ticket?.status === 'ok');
      const rejected = tickets.map((ticket: { status?: string; details?: { error?: string } }, index: number) => ({ ticket, token: tokens[index] }))
        .filter(({ ticket }: { ticket: { status?: string } }) => ticket?.status !== 'ok');
      for (const item of rejected) {
        const dead = item.ticket?.details?.error === 'DeviceNotRegistered';
        if (dead) await db.from('push_tokens').update({ disabled_at: new Date().toISOString() }).eq('token', item.token);
        const { error: updateError } = await db.from('notification_token_attempts').update({
          status: dead ? 'dead' : 'pending',
          next_attempt_at: new Date(Date.now() + 300000).toISOString(),
          last_error: item.ticket?.details?.error ?? 'Expo rejected ticket', updated_at: new Date().toISOString()
        }).eq('delivery_id', job.delivery_id).eq('token', item.token);
        if (updateError) throw updateError;
      }
      const receiptRows = accepted.map(({ ticket, token }: { ticket: { id?: string }; token: string }) => ({
        delivery_id: job.delivery_id, token, ticket_id: ticket.id
      }));
      if (receiptRows.some((row: { ticket_id?: string }) => !row.ticket_id)) {
        throw new Error('Expo did not return all ticket IDs');
      }
      if (receiptRows.length) {
        const { error: receiptError } = await db.from('notification_push_receipts').upsert(receiptRows, { onConflict: 'ticket_id' });
        if (receiptError) throw receiptError;
      }
      for (const item of accepted) {
        const { error: acceptedError } = await db.from('notification_token_attempts').update({
          status: 'accepted', last_error: null, updated_at: new Date().toISOString()
        }).eq('delivery_id', job.delivery_id).eq('token', item.token);
        if (acceptedError) throw acceptedError;
      }
      if (rejected.some(item => item.ticket?.details?.error !== 'DeviceNotRegistered')) {
        throw new Error('Transient Expo rejection; retry pending tokens only');
      }
      if (!accepted.length && rejected.length) {
        const { error: skipError } = await db.rpc('complete_notification_delivery', {
          p_id: job.delivery_id, p_status: 'skipped', p_message: null, p_error: null
        });
        if (skipError) throw skipError;
        continue;
      }
      const ids = receiptRows.map((row: { ticket_id?: string }) => row.ticket_id).join(',');
      const { error: completeError } = await db.rpc('complete_notification_delivery', {
        p_id: job.delivery_id, p_status: 'sent', p_message: ids || null, p_error: null
      });
      if (completeError) throw completeError;
      sent++;
    } catch (reason) {
      failed++;
      await db.rpc('complete_notification_delivery', {
        p_id: job.delivery_id, p_status: 'failed', p_message: null,
        p_error: reason instanceof Error ? reason.message : 'Push delivery failed'
      });
    }
  }
  return Response.json({ claimed: data?.length ?? 0, sent, failed });
});
