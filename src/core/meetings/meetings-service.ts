import { supabase } from '@/lib/supabase';

export type MeetingType = 'employer_interview' | 'nonprofit_appointment' | 'caseworker_meeting' | 'housing_appointment' | 'workshop' | 'office_hours' | 'other';
export type MeetingStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type MeetingProvider = 'zoom' | 'google_meet' | 'microsoft_teams' | 'phone' | 'in_person' | 'other';
export type Meeting = {
  id: string; title: string; meeting_type: MeetingType; organization_name: string | null; host_name: string | null; host_contact: string | null;
  provider: MeetingProvider; meeting_url: string | null; location_text: string | null; start_at: string; end_at: string | null; timezone: string;
  instructions: string | null; status: MeetingStatus; reminder_minutes_before: number; cancelled_reason: string | null; created_at: string; updated_at: string;
};

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  employer_interview: 'Employer interview', nonprofit_appointment: 'Nonprofit appointment', caseworker_meeting: 'Caseworker meeting',
  housing_appointment: 'Housing appointment', workshop: 'Workshop', office_hours: 'Office hours', other: 'Other',
};
export const PROVIDER_LABEL: Record<MeetingProvider, string> = { zoom: 'Zoom', google_meet: 'Google Meet', microsoft_teams: 'Microsoft Teams', phone: 'Phone', in_person: 'In person', other: 'Other' };
export const STATUS_LABEL: Record<MeetingStatus, string> = { scheduled: 'Scheduled', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };

export function meetingsErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (text.includes('SIGNED_OUT')) return 'Sign in to continue.';
  if (text.includes('MEETING_UNAVAILABLE')) return 'That meeting is no longer available.';
  if (text.includes('INVALID_TRANSITION')) return 'That status change is not available for this meeting.';
  if (text.includes('INVALID_STATUS')) return 'That is not a valid status.';
  return 'Something went wrong. Please try again.';
}

export async function loadMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase.from('member_meetings').select('*').order('start_at', { ascending: true });
  if (error) throw error;
  return data as Meeting[];
}
export async function loadMeeting(id: string): Promise<Meeting> {
  const { data, error } = await supabase.from('member_meetings').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Meeting;
}
export type NewMeeting = {
  title: string; meeting_type: MeetingType; organization_name?: string | null; host_name?: string | null; host_contact?: string | null;
  provider: MeetingProvider; meeting_url?: string | null; location_text?: string | null; start_at: string; end_at?: string | null;
  timezone?: string; instructions?: string | null; reminder_minutes_before?: number; related_job_id?: string | null; related_resource_id?: string | null;
};
export async function createMeeting(m: NewMeeting): Promise<Meeting> {
  const { data, error } = await supabase.from('member_meetings').insert(m).select('*').single();
  if (error) throw error;
  return data as Meeting;
}
export async function updateMeeting(id: string, patch: Partial<NewMeeting>): Promise<Meeting> {
  const { data, error } = await supabase.from('member_meetings').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Meeting;
}
export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase.from('member_meetings').delete().eq('id', id);
  if (error) throw error;
}
export async function setMeetingStatus(id: string, status: MeetingStatus, reason?: string): Promise<Meeting> {
  const { data, error } = await supabase.rpc('set_meeting_status', { p_id: id, p_status: status, p_reason: reason ?? null });
  if (error) throw error;
  return data as Meeting;
}
