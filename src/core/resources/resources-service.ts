import { supabase } from '@/lib/supabase';
import type { ResourceHoursRow } from '@/core/resources/resource-format';

export type ResourceCategory = { slug: string; label: string; description: string | null; sort_order: number; urgent_default: boolean };
export type ResourceNeed = { need_slug: string; label: string; urgent: boolean; category_slugs: string[]; sort_order?: number };

export type ResourceSummary = {
  id: string;
  title: string;
  summary: string;
  organization: { id: string; name: string; slug: string; org_type: string };
  resource_kind: string;
  delivery_mode: 'in_person' | 'virtual' | 'phone' | 'hybrid';
  is_national: boolean;
  cost_type: 'free' | 'sliding' | 'paid' | 'unknown';
  cost_notes: string | null;
  urgency_tier: number;
  eligibility_summary: string | null;
  official_source_url: string | null;
  source_authority: string;
  last_verified_at: string | null;
  verify_by: string | null;
  freshness: 'fresh' | 'stale' | 'expired' | 'unknown';
  accessibility: string[];
  languages: string[];
  categories: string[];
  nearest_location: { id: string; city: string | null; state_code: string | null; postal_code: string | null; address_line: string | null; phone: string | null; open_now: boolean | null } | null;
  data_origin: string;
  distance_miles: number | null;
};

export type ResourceSearchParams = {
  query?: string;
  zip?: string;
  radiusMiles?: number;
  category?: string | null;
  freeOnly?: boolean;
  urgent?: boolean;
  delivery?: string[];
  includeNational?: boolean;
  offset?: number;
  limit?: number;
};
export type ResourceSearchResult = { resources: ResourceSummary[]; total: number; hasMore: boolean };
export const RESOURCE_PAGE_SIZE = 20;

/** Server-side, paginated, guest-safe. Never filters or ranks on private member data. */
export async function searchResources(p: ResourceSearchParams = {}): Promise<ResourceSearchResult> {
  const limit = p.limit ?? RESOURCE_PAGE_SIZE;
  const offset = p.offset ?? 0;
  const { data, error } = await supabase.rpc('search_resources', {
    p_query: p.query?.trim() || null,
    p_zip: p.zip?.trim() || null,
    p_radius_miles: p.radiusMiles ?? 25,
    p_category: p.category ?? null,
    p_free_only: Boolean(p.freeOnly),
    p_urgent: Boolean(p.urgent),
    p_delivery: p.delivery && p.delivery.length ? p.delivery : null,
    p_include_national: p.includeNational ?? true,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  const rows = (data ?? []) as { resource_row: Omit<ResourceSummary, 'distance_miles'>; distance_miles: number | null; total_count: number | string }[];
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    resources: rows.map((r) => ({ ...r.resource_row, distance_miles: r.distance_miles })),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function loadResourceCategories(): Promise<ResourceCategory[]> {
  const { data, error } = await supabase.from('resource_categories').select('slug,label,description,sort_order,urgent_default').order('sort_order');
  if (error) throw error;
  return (data ?? []) as ResourceCategory[];
}

export async function loadResourceNeeds(): Promise<ResourceNeed[]> {
  const { data, error } = await supabase.from('resource_needs').select('need_slug,label,urgent,category_slugs,sort_order').order('sort_order');
  if (error) throw error;
  return (data ?? []) as ResourceNeed[];
}

export async function resolveResourceNeeds(query: string): Promise<ResourceNeed[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc('resolve_resource_needs', { p_query: query });
  if (error) throw error;
  return (data ?? []) as ResourceNeed[];
}

export type ResourceLocation = {
  id: string; label: string; address_line: string | null; city: string | null; state_code: string | null; postal_code: string | null;
  latitude: number | null; longitude: number | null; phone: string | null; timezone: string; is_virtual: boolean;
  accessibility: string[]; open_now: boolean | null; hours: ResourceHoursRow[];
};
export type ResourceDetail = {
  id: string; title: string; summary: string; description: string | null;
  organization: { id: string; name: string; slug: string; org_type: string; website_url: string | null; description: string | null };
  resource_kind: string; delivery_mode: 'in_person' | 'virtual' | 'phone' | 'hybrid'; is_national: boolean;
  cost_type: 'free' | 'sliding' | 'paid' | 'unknown'; cost_notes: string | null; urgency_tier: number;
  eligibility_summary: string | null; how_to_access: string | null; application_url: string | null; official_source_url: string | null;
  source_authority: string; last_verified_at: string | null; verify_by: string | null; freshness: 'fresh' | 'stale' | 'expired' | 'unknown';
  languages: string[]; accessibility: string[]; hours_note: string | null; data_origin: string; categories: string[];
  locations: ResourceLocation[];
  service_areas: { area_type: string; state_code: string | null; county_fips: string | null; postal_code: string | null; radius_miles: number | null }[];
  eligibility: { rule_type: string; description: string; is_hard: boolean }[];
  contacts: { method: 'phone' | 'email' | 'url' | 'sms' | 'walk_in'; value: string; label: string | null; is_primary: boolean }[];
  required_documents: { document_type: string; description: string | null; is_required: boolean }[];
};

/** Null when the resource does not exist OR is not visible to members (unverified, expired, retired...). */
export async function loadResourceDetail(id: string): Promise<ResourceDetail | null> {
  const { data, error } = await supabase.rpc('get_resource_detail', { p_id: id });
  if (error) throw error;
  return (data as ResourceDetail | null) ?? null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Member state (signed-in only). Progress is SELF-REPORTED and always labelled that way in the UI.
// ---------------------------------------------------------------------------------------------------------------------
export type ResourceProgress = 'started' | 'completed' | null;
export type ResourceMemberState = { is_saved: boolean; progress: ResourceProgress };
export type SavedResourceRow = { resource: ResourceSummary | { id: string }; available: boolean; at: string; progress?: ResourceProgress };
export type ReportReason = 'wrong_info' | 'closed' | 'unsafe' | 'scam_or_fee' | 'other';

export async function isSignedIn(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user);
}

/** Maps a database exception code to a friendly message; unknown errors get a generic one. */
export function resourceActionMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (text.includes('SIGNED_OUT')) return 'Sign in to do that.';
  if (text.includes('RESOURCE_UNAVAILABLE')) return 'This resource is no longer available.';
  if (text.includes('SAVED_LIMIT')) return 'You have reached the saved limit. Remove some saved resources first.';
  if (text.includes('REPORT_RATE_LIMIT')) return 'You have sent several reports today. Please try again tomorrow.';
  return 'Something went wrong. Please try again.';
}

export async function loadResourceStates(ids: string[]): Promise<Record<string, ResourceMemberState>> {
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc('my_resource_states', { p_ids: ids });
  if (error) throw error;
  const out: Record<string, ResourceMemberState> = {};
  for (const r of (data ?? []) as { resource_id: string; is_saved: boolean; progress: ResourceProgress }[]) out[r.resource_id] = { is_saved: r.is_saved, progress: r.progress };
  return out;
}

export async function saveResource(id: string) {
  const { error } = await supabase.rpc('save_resource', { p_id: id });
  if (error) throw error;
}
export async function unsaveResource(id: string) {
  const { error } = await supabase.rpc('unsave_resource', { p_id: id });
  if (error) throw error;
}
export async function setResourceProgress(id: string, state: 'started' | 'completed' | 'cleared') {
  const { error } = await supabase.rpc('set_resource_progress', { p_id: id, p_state: state });
  if (error) throw error;
}
export async function reportResource(id: string, reason: ReportReason, note?: string) {
  const { error } = await supabase.rpc('report_resource', { p_id: id, p_reason: reason, p_note: note?.trim() || null });
  if (error) throw error;
}

export async function loadSavedResources(limit = 50, offset = 0): Promise<{ rows: SavedResourceRow[]; total: number }> {
  const { data, error } = await supabase.rpc('list_my_saved_resources', { p_limit: limit, p_offset: offset });
  if (error) throw error;
  const rows = (data ?? []) as { resource_row: ResourceSummary | { id: string }; saved_at: string; available: boolean; total_count: number | string }[];
  return { rows: rows.map((r) => ({ resource: r.resource_row, available: r.available, at: r.saved_at })), total: rows.length ? Number(rows[0].total_count) : 0 };
}

export async function loadResourceProgress(state: 'started' | 'completed' | null, limit = 50, offset = 0): Promise<{ rows: SavedResourceRow[]; total: number }> {
  const { data, error } = await supabase.rpc('list_my_resource_progress', { p_state: state, p_limit: limit, p_offset: offset });
  if (error) throw error;
  const rows = (data ?? []) as { resource_row: ResourceSummary | { id: string }; progress: ResourceProgress; updated_at: string; available: boolean; total_count: number | string }[];
  return { rows: rows.map((r) => ({ resource: r.resource_row, available: r.available, at: r.updated_at, progress: r.progress })), total: rows.length ? Number(rows[0].total_count) : 0 };
}

export async function loadResourceCounts(): Promise<{ saved: number; started: number; completed: number }> {
  const { data, error } = await supabase.rpc('my_resource_counts');
  if (error) throw error;
  const r = ((data ?? []) as { saved_count: number | string; started_count: number | string; completed_count: number | string }[])[0];
  return { saved: Number(r?.saved_count ?? 0), started: Number(r?.started_count ?? 0), completed: Number(r?.completed_count ?? 0) };
}
