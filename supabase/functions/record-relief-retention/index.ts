import { createClient } from 'jsr:@supabase/supabase-js@2';
import { json, requireEnv } from '../_shared/http.ts';
import { handleRetention, type RetentionDeps } from './handler.ts';

Deno.serve(async (req: Request) => {
  const url = requireEnv('SUPABASE_URL'), key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json(500, { error: 'server_misconfigured' });
  const db = createClient(url, key, { auth: { persistSession: false } });

  const deps: RetentionDeps = {
    async checkToken(token) {
      const { data } = await db.from('record_relief_monitor_auth').select('token').eq('id', true).maybeSingle();
      return Boolean(data) && token === data!.token;
    },
    async listExpired() {
      const { data, error } = await db
        .from('record_relief_uploads')
        .select('id,storage_path')
        .neq('status', 'deleted')
        .lte('expires_at', new Date().toISOString())
        .limit(500);
      return error ? null : ((data as ExpiredRow[] | null) ?? []);
    },
    async removeFromStorage(path) {
      const { data, error } = await db.storage.from('record-relief-uploads').remove([path]);
      // A successful HTTP response may still contain zero deleted objects.
      // Never scrub the DB unless Storage confirms deletion of this exact path.
      const removed = Array.isArray(data) && data.some((item) => item.name === path);
      return { ok: !error && removed };
    },
    async markDeleted(id) {
      const { error } = await db
        .from('record_relief_uploads')
        .update({ status: 'deleted', extraction: null, storage_path: '', updated_at: new Date().toISOString() })
        .eq('id', id);
      return { ok: !error };
    },
  };

  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    // leave rawBody empty; handleRetention will reject it as invalid_json
  }
  const out = await handleRetention(req.method, rawBody, deps);
  return json(out.status, out.body);
});

type ExpiredRow = { id: string; storage_path: string | null };
