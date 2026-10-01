-- Bug fix, caught by this pass's own verification migration: program_change_events required program_id OR
-- candidate_id to be non-null, but a change detected at the SOURCE level (content changed, no candidate has
-- ever been extracted from this source yet) legitimately has neither - source_id (already not-null) is
-- sufficient traceability on its own. The prior constraint silently rejected every such insert, and the worker's
-- recordChangeEvent call didn't check for an insert error, so "changed: true" was reported in the API response
-- while no row was ever written - a real gap between what the worker claimed and what it actually persisted.
alter table public.program_change_events drop constraint if exists program_change_events_check;
