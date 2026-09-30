-- Real bug found during live Employer Workspace testing: "Employers update applications for own jobs" (an
-- UPDATE RLS policy, added 2026-09-01) has never actually been reachable, because `authenticated` was only
-- ever granted insert/select/delete on job_applications (20260901000100 line 1155) - UPDATE was never granted
-- at the table level. RLS policies only restrict rows within an already-granted operation; without the table
-- grant, every employer status-change attempt failed with "permission denied for table job_applications"
-- before RLS was even evaluated. This affected the original individual-employer policy too, not just the new
-- organization-scoped one added in 20261007100000 - it was a day-one gap, just never exercised until now.
grant update on table public.job_applications to authenticated;
