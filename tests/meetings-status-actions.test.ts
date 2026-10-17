// Regression test for a real defect: src/app/meetings/[id].tsx used to hide ALL status-update buttons once a
// meeting's start_at was in the past (it gated them behind `upcoming`). A meeting the member never tapped "mark
// confirmed" on before its time passed had no way to ever become 'confirmed', and therefore -- since the server's
// set_meeting_status only allows scheduled -> confirmed as the first step (by design, see
// supabase/migrations/20261002110000_meetings.sql) -- no way to ever become 'completed' or 'no_show' either. It
// was permanently stuck as "Scheduled", with delete as the only remaining action. Fixed by making status actions
// available based on the meeting's own status (not the clock), reserving "join"/"reschedule" for future meetings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { canUpdateMeetingStatus } from '../src/core/meetings/meetings-format.ts';

test('a scheduled meeting that has already passed can still be confirmed, cancelled, or (via confirm) completed', () => {
  assert.equal(canUpdateMeetingStatus('scheduled'), true);
  assert.equal(canUpdateMeetingStatus('confirmed'), true);
});

test('a meeting already in a final state offers no further status action', () => {
  assert.equal(canUpdateMeetingStatus('completed'), false);
  assert.equal(canUpdateMeetingStatus('cancelled'), false);
  assert.equal(canUpdateMeetingStatus('no_show'), false);
});
