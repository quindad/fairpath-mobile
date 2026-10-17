// Pure helpers for Meetings (no imports, so audits run them under Node).

/**
 * Status actions (confirm/complete/no-show/cancel) must stay available after the meeting's time has passed: a
 * member who never tapped "mark confirmed" before the meeting would otherwise have no way to ever mark it
 * completed or no-show, since the server only allows scheduled -> confirmed as the first step (by design, not
 * time -- see set_meeting_status in supabase/migrations/20261002110000_meetings.sql). Only "join" and
 * "reschedule" meaningfully require the meeting to still be in the future.
 */
export function canUpdateMeetingStatus(status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'): boolean {
  return status !== 'cancelled' && status !== 'completed' && status !== 'no_show';
}
