// Edge Function entry: wires the real dependencies (Supabase clients, renderers) into handleRender().
// Deploy (DEV only): npx supabase functions deploy render-document --project-ref znvhmuhojvwvjzmaqwff
// JWT verification stays ON (default): only signed-in members can call it.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json, requireEnv } from '../_shared/http.ts';
import { renderPdf } from '../_shared/core/documents/render-pdf.ts';
import { renderDocx } from '../_shared/core/documents/render-docx.ts';
import { toCsv, type DocumentSpec, type DocFormat } from '../_shared/core/documents/spec.ts';
import type { ResourceForDoc } from '../_shared/core/documents/builders/resources.ts';
import type { OpportunityProfileData } from '../_shared/core/documents/builders/opportunity-profile.ts';
import { handleRender, type RenderDeps } from './handler.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json(500, { error: 'server_misconfigured' });

  const authHeader = req.headers.get('Authorization');
  // Reads run as the member (their JWT), so RLS decides what data is visible.
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader ?? '' } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const deps: RenderDeps = {
    async getUserId(header) {
      if (!header) return null;
      const { data } = await userClient.auth.getUser();
      return data?.user?.id ?? null;
    },
    async loadResources() {
      const [{ data: saved }, { data: cats }] = await Promise.all([
        userClient.rpc('list_my_saved_resources', { p_limit: 100, p_offset: 0 }),
        userClient.from('resource_categories').select('slug,label'),
      ]);
      const ids = ((saved ?? []) as { resource_row: { id: string }; available: boolean }[]).filter((r) => r.available).map((r) => r.resource_row.id);
      const details = await Promise.all(ids.map((id) => userClient.rpc('get_resource_detail', { p_id: id }).then((r) => r.data as ResourceForDoc | null)));
      return {
        resources: details.filter((d): d is ResourceForDoc => Boolean(d)),
        categoryLabels: Object.fromEntries(((cats ?? []) as { slug: string; label: string }[]).map((c) => [c.slug, c.label])),
      };
    },
    async loadProfile(userId) {
      const [prof, work, edu, cred, skills, prefs, auth] = await Promise.all([
        userClient.from('profiles').select('first_name,last_name,phone,zip_code').eq('id', userId).single(),
        userClient.from('member_work_experience').select('job_title,employer_name,location_text,start_date,end_date,is_current,description').order('start_date', { ascending: false }),
        userClient.from('member_education').select('school_name,credential,field_of_study,start_year,end_year,status'),
        userClient.from('member_credentials').select('credential_type,name,issuer,issued_date,expires_date'),
        userClient.from('member_skills').select('skill').order('skill'),
        userClient.from('member_job_preferences').select('*').maybeSingle(),
        userClient.auth.getUser(),
      ]);
      const p = prof.data as { first_name: string | null; last_name: string | null; phone: string | null; zip_code: string | null } | null;
      return {
        contact: { first_name: p?.first_name ?? '', last_name: p?.last_name ?? '', phone: p?.phone ?? null, email: auth.data.user?.email ?? null, zip_code: p?.zip_code ?? null },
        work: (work.data ?? []) as OpportunityProfileData['work'],
        education: (edu.data ?? []) as OpportunityProfileData['education'],
        credentials: (cred.data ?? []) as OpportunityProfileData['credentials'],
        skills: ((skills.data ?? []) as { skill: string }[]).map((s) => s.skill),
        preferences: (prefs.data as OpportunityProfileData['preferences']) ?? null,
      };
    },
    async register(userId: string, spec: DocumentSpec, format: DocFormat) {
      const { data, error } = await admin.rpc('register_generated_document', {
        p_document_type: spec.documentType, p_source_module: spec.sourceModule, p_source_record_id: spec.sourceRecordId,
        p_subject: spec.subject, p_title: spec.title, p_format: format, p_kind: spec.kind, p_template_id: spec.templateId,
        p_template_version: spec.templateVersion, p_sensitivity: spec.sensitivity,
        p_input_fingerprint: (await import('../_shared/core/documents/spec.ts')).fingerprintOf(spec.inputs),
        p_confirmed_data_at: spec.confirmedDataAt, p_metadata: {}, p_official_form_ref: null, p_target_user: userId,
      });
      if (error) throw new Error('register_failed');
      return data as { id: string; file_name: string; version: number };
    },
    renderPdf, renderDocx, toCsv,
    async sha256(bytes) {
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    },
    now: () => new Date(),
  };

  try {
    const res = await handleRender(req.method, authHeader, await req.text(), deps);
    return json(res.status, res.body);
  } catch {
    // Never echo internals or content back.
    return json(500, { error: 'render_failed' });
  }
});
