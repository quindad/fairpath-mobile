import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';
import type { OpportunityProfileData } from '@/core/documents/builders/opportunity-profile';

/**
 * Opportunity Profile data access. Every table is owner-only under RLS (no employer/partner policy exists), so these
 * are plain reads/writes as the member. Employers never read this live data: they only receive the snapshot built by
 * submit_job_application at application time.
 */
export type WorkExperience = {
  id: string; job_title: string; employer_name: string; location_text: string | null; start_date: string; end_date: string | null; is_current: boolean; description: string | null;
};
export type Education = { id: string; school_name: string; credential: string; field_of_study: string | null; start_year: number | null; end_year: number | null; status: string };
export type Credential = { id: string; credential_type: 'certification' | 'license'; name: string; issuer: string | null; issued_date: string | null; expires_date: string | null };
export type Skill = { id: string; skill: string };
export type JobPreferences = {
  desired_titles: string[]; employment_types: string[]; workplace_types: string[]; pay_min_hourly: number | null; available_days: string[];
  shift_preferences: string[]; earliest_start_date: string | null; transportation_modes: string[]; has_drivers_license: boolean | null;
  willing_to_relocate: boolean | null; no_work_experience_yet: boolean;
};
export const EMPTY_PREFERENCES: JobPreferences = {
  desired_titles: [], employment_types: [], workplace_types: [], pay_min_hourly: null, available_days: [], shift_preferences: [], earliest_start_date: null,
  transportation_modes: [], has_drivers_license: null, willing_to_relocate: null, no_work_experience_yet: false,
};
export type CompletionSection = { section_key: string; label: string; is_complete: boolean; detail: string; sort_order: number };

/** Maps a database exception to a member-facing message. */
export function profileErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (text.includes('ROW_LIMIT')) return 'You have reached the limit for this section. Remove an entry to add another.';
  if (text.includes('INVALID_DATE')) return 'Dates cannot be in the future.';
  if (text.includes('duplicate')) return 'You already added that.';
  if (text.includes('violates check')) return 'Please check the dates and values you entered.';
  if (text.includes('SIGNED_OUT')) return 'Sign in to continue.';
  return 'Something went wrong. Please try again.';
}

export async function loadCompletion(): Promise<CompletionSection[]> {
  const { data, error } = await supabase.rpc('get_opportunity_completion');
  if (error) throw error;
  return ((data ?? []) as CompletionSection[]).sort((a, b) => a.sort_order - b.sort_order);
}

export async function loadWork(): Promise<WorkExperience[]> {
  const { data, error } = await supabase.from('member_work_experience').select('*').order('start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkExperience[];
}
export async function saveWork(input: Omit<WorkExperience, 'id'>, id?: string) {
  const user = await currentUser();
  const row = { ...input, user_id: user.id };
  const { error } = id ? await supabase.from('member_work_experience').update(row).eq('id', id) : await supabase.from('member_work_experience').insert(row);
  if (error) throw error;
}
export async function deleteWork(id: string) {
  const { error } = await supabase.from('member_work_experience').delete().eq('id', id);
  if (error) throw error;
}

export async function loadEducation(): Promise<Education[]> {
  const { data, error } = await supabase.from('member_education').select('*').order('end_year', { ascending: false, nullsFirst: true });
  if (error) throw error;
  return (data ?? []) as Education[];
}
export async function saveEducation(input: Omit<Education, 'id'>, id?: string) {
  const user = await currentUser();
  const row = { ...input, user_id: user.id };
  const { error } = id ? await supabase.from('member_education').update(row).eq('id', id) : await supabase.from('member_education').insert(row);
  if (error) throw error;
}
export async function deleteEducation(id: string) {
  const { error } = await supabase.from('member_education').delete().eq('id', id);
  if (error) throw error;
}

export async function loadCredentials(): Promise<Credential[]> {
  const { data, error } = await supabase.from('member_credentials').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Credential[];
}
export async function saveCredential(input: Omit<Credential, 'id'>, id?: string) {
  const user = await currentUser();
  const row = { ...input, user_id: user.id };
  const { error } = id ? await supabase.from('member_credentials').update(row).eq('id', id) : await supabase.from('member_credentials').insert(row);
  if (error) throw error;
}
export async function deleteCredential(id: string) {
  const { error } = await supabase.from('member_credentials').delete().eq('id', id);
  if (error) throw error;
}

export async function loadSkills(): Promise<Skill[]> {
  const { data, error } = await supabase.from('member_skills').select('id,skill').order('skill');
  if (error) throw error;
  return (data ?? []) as Skill[];
}
export async function addSkill(skill: string) {
  const user = await currentUser();
  const { error } = await supabase.from('member_skills').insert({ user_id: user.id, skill: skill.trim() });
  if (error) throw error;
}
export async function deleteSkill(id: string) {
  const { error } = await supabase.from('member_skills').delete().eq('id', id);
  if (error) throw error;
}

export async function loadPreferences(): Promise<JobPreferences> {
  const { data, error } = await supabase.from('member_job_preferences').select('*').maybeSingle();
  if (error) throw error;
  return data ? ({ ...EMPTY_PREFERENCES, ...(data as Partial<JobPreferences>) }) : EMPTY_PREFERENCES;
}
export async function savePreferences(patch: Partial<JobPreferences>) {
  const user = await currentUser();
  const { error } = await supabase.from('member_job_preferences').upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' });
  if (error) throw error;
}

export type ContactInfo = { first_name: string; last_name: string; phone: string; zip_code: string; search_radius_miles: number };
export async function loadContact(): Promise<ContactInfo & { email: string }> {
  const user = await currentUser();
  const { data, error } = await supabase.from('profiles').select('first_name,last_name,phone,zip_code,search_radius_miles').eq('id', user.id).single();
  if (error) throw error;
  return { first_name: data?.first_name ?? '', last_name: data?.last_name ?? '', phone: data?.phone ?? '', zip_code: data?.zip_code ?? '', search_radius_miles: data?.search_radius_miles ?? 25, email: user.email ?? '' };
}
export async function saveContact(input: { first_name: string; last_name: string; phone: string }) {
  const user = await currentUser();
  const { error } = await supabase.from('profiles').update({ first_name: input.first_name.trim(), last_name: input.last_name.trim(), phone: input.phone.trim() || null, updated_at: new Date().toISOString() }).eq('id', user.id);
  if (error) throw error;
}

/** Everything the document builder needs (the member's own confirmed data). */
export async function loadProfileForDocument(): Promise<OpportunityProfileData> {
  const [contact, work, edu, cred, skills, prefs] = await Promise.all([loadContact(), loadWork(), loadEducation(), loadCredentials(), loadSkills(), loadPreferences()]);
  return {
    contact: { first_name: contact.first_name, last_name: contact.last_name, phone: contact.phone || null, email: contact.email || null, zip_code: contact.zip_code || null },
    work, education: edu, credentials: cred, skills: skills.map((s) => s.skill),
    preferences: {
      desired_titles: prefs.desired_titles, employment_types: prefs.employment_types, workplace_types: prefs.workplace_types, pay_min_hourly: prefs.pay_min_hourly,
      available_days: prefs.available_days, shift_preferences: prefs.shift_preferences, earliest_start_date: prefs.earliest_start_date,
      transportation_modes: prefs.transportation_modes, has_drivers_license: prefs.has_drivers_license,
    },
  };
}
