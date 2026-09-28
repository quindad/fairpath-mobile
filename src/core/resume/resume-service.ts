import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';
import { EMPTY_RESUME_CONTENT, parseResumeContent, type ResumeContent } from '@/core/resume/resume-types';

export type Resume = { id: string; title: string; target_role: string | null; template: 'classic' | 'compact'; content: ResumeContent; imported_from_profile_at: string | null; created_at: string; updated_at: string };
type ResumeRow = Omit<Resume, 'content'> & { content: unknown };

export function resumeErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (text.includes('SIGNED_OUT')) return 'Sign in to continue.';
  if (text.includes('RESUME_LIMIT')) return 'You have reached the limit of 20 resumes. Delete one to make room.';
  if (text.includes('RESUME_UNAVAILABLE')) return 'That resume is no longer available.';
  return 'Something went wrong. Please try again.';
}

const toResume = (r: ResumeRow): Resume => ({ ...r, content: parseResumeContent(r.content) });

export async function loadResumes(): Promise<Resume[]> {
  const { data, error } = await supabase.from('member_resumes').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as ResumeRow[]).map(toResume);
}

export async function loadResume(id: string): Promise<Resume> {
  const { data, error } = await supabase.from('member_resumes').select('*').eq('id', id).single();
  if (error) throw error;
  return toResume(data as ResumeRow);
}

export async function createResume(title: string): Promise<Resume> {
  const user = await currentUser();
  const { data, error } = await supabase.from('member_resumes').insert({ user_id: user.id, title: title.trim() || 'My resume', content: EMPTY_RESUME_CONTENT }).select('*').single();
  if (error) throw error;
  return toResume(data as ResumeRow);
}

export async function updateResume(id: string, patch: Partial<{ title: string; target_role: string | null; template: 'classic' | 'compact'; content: ResumeContent }>): Promise<Resume> {
  const { data, error } = await supabase.from('member_resumes').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return toResume(data as ResumeRow);
}

export async function deleteResume(id: string): Promise<void> {
  const { error } = await supabase.from('member_resumes').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateResume(id: string): Promise<Resume> {
  const { data, error } = await supabase.rpc('duplicate_resume', { p_id: id });
  if (error) throw error;
  return toResume(data as ResumeRow);
}

/**
 * A ONE-TIME copy from the member's own Opportunity Profile into this resume's content. This never creates a live
 * link: after this call, editing the profile does not change the resume, and editing the resume does not change
 * the profile. Anything the member already typed into the resume for a field that would be overwritten is kept
 * unless `overwrite` is true.
 */
export async function importFromProfile(current: ResumeContent, overwrite = false): Promise<ResumeContent> {
  const [{ data: prof }, { data: work }, { data: edu }, { data: cred }, { data: skills }, auth] = await Promise.all([
    supabase.from('profiles').select('first_name,last_name,phone,zip_code').single(),
    supabase.from('member_work_experience').select('job_title,employer_name,location_text,start_date,end_date,is_current').order('start_date', { ascending: false }),
    supabase.from('member_education').select('school_name,credential,field_of_study,end_year'),
    supabase.from('member_credentials').select('name,issuer,issued_date'),
    supabase.from('member_skills').select('skill').order('skill'),
    supabase.auth.getUser(),
  ]);
  const name = prof ? `${prof.first_name ?? ''} ${prof.last_name ?? ''}`.trim() : '';
  const next: ResumeContent = {
    contact: overwrite || !current.contact.name ? { name, email: auth.data.user?.email ?? '', phone: prof?.phone ?? '', location: prof?.zip_code ?? '' } : current.contact,
    summary: current.summary,
    experience: overwrite || !current.experience.length ? (work ?? []).map((w) => ({ title: w.job_title, employer: w.employer_name, location: w.location_text ?? '', start: w.start_date ?? '', end: w.end_date ?? '', current: w.is_current, bullets: [] })) : current.experience,
    education: overwrite || !current.education.length ? (edu ?? []).map((e) => ({ school: e.school_name, credential: e.credential ?? '', field: e.field_of_study ?? '', endYear: e.end_year ? String(e.end_year) : '' })) : current.education,
    skills: overwrite || !current.skills.length ? (skills ?? []).map((s) => s.skill) : current.skills,
    credentials: overwrite || !current.credentials.length ? (cred ?? []).map((c) => ({ name: c.name, issuer: c.issuer ?? '', year: c.issued_date ? String(c.issued_date).slice(0, 4) : '' })) : current.credentials,
  };
  return next;
}
