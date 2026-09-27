-- Member reminders (forward-only). Migration 10.
--
-- generate_member_reminders() turns REAL server state into in-app notifications: credit dispute deadlines, record-relief
-- countdown milestones and rule updates, stored documents about to expire, and saved resources that stopped being
-- available. It is a service-role job (run on a schedule by the platform); members cannot call it.
--
-- Rules:
--   * Deduplicated: each event has a stable dedupe key, so re-running the job never repeats a reminder.
--   * No spam: only meaningful thresholds (7 days / 30 days / 90 days, due/overdue, expiry, unavailable).
--   * Lock-screen safe: notification text is generic and never contains creditor names, case labels, case numbers,
--     jurisdictions or document titles. The deep link opens the detail inside the signed-in app.
--   * In-app only. Push delivery remains a separate, unbuilt worker (see notification_deliveries).
--   * Notification preferences do not exist yet in the platform, so none are consulted (called out in the handoff).

create or replace function public.generate_member_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
  made uuid;
begin
  -- Credit disputes
  for r in select * from public.credit_dispute_reminders_due() loop
    made := public.create_notification(r.user_id, 'credit_dispute',
      case r.kind when 'overdue' then 'A dispute response is overdue' when 'due_soon' then 'A dispute response is due soon' else 'Time to follow up on a dispute' end,
      case r.kind when 'overdue' then 'The expected response window for one of your disputes has passed. Open it to record a response or follow up.'
                  when 'due_soon' then 'A response to one of your disputes is expected within the next week. Open it to check your tracker.'
                  else 'You set a reminder to follow up on a dispute. Open it to take the next step.' end,
      '/credit/dispute/' || r.dispute_id::text, 'credit:' || r.kind || ':' || r.dispute_id::text || ':' || coalesce(r.due_on::text, ''), 'credit_dispute', r.dispute_id, '{}'::jsonb);
    if made is not null then n := n + 1; end if;
  end loop;

  -- Record relief countdown milestones (generic wording; the case name is not included)
  for r in select * from public.record_relief_reminders_due() loop
    made := public.create_notification(r.user_id, 'record_relief',
      case r.kind when 'eligible_now' then 'A waiting period may have ended' when 'milestone_7' then 'A waiting period ends within a week' when 'milestone_30' then 'A waiting period ends within a month' else 'A waiting period ends within 90 days' end,
      case r.kind when 'eligible_now' then 'Under the rule FairPath checked, one of your cases may now be eligible for review. This is not a legal determination. Open the case to see the details and next steps.'
                  else 'A countdown you are tracking is getting close. Open the case to see the date, the rule used and your checklist.' end,
      '/record-relief/case/' || r.case_id::text, 'rr:' || r.kind || ':' || r.case_id::text || ':' || coalesce(r.due_on::text, ''), 'record_relief_case', r.case_id, '{}'::jsonb);
    if made is not null then n := n + 1; end if;
  end loop;

  -- Rule changed under an existing evaluation
  for r in
    select e.case_id, e.user_id, e.rule_key, a.rule_version as new_version
    from public.record_relief_evaluations e
    join public.record_relief_cases c on c.id = e.case_id and c.filing_status not in ('granted', 'denied', 'withdrawn')
    join lateral public.record_relief_active_rules(e.jurisdiction_code) a on a.rule_key = e.rule_key and a.id <> e.rule_id
    where not e.superseded and e.rule_id is not null
  loop
    made := public.create_notification(r.user_id, 'record_relief', 'A rule for one of your cases was updated',
      'The verified rule that applies to one of your cases changed. Your countdown may be different. Open the case and re-check it.',
      '/record-relief/case/' || r.case_id::text, 'rr:rule:' || r.case_id::text || ':' || r.rule_key || ':' || r.new_version::text, 'record_relief_case', r.case_id, '{}'::jsonb);
    if made is not null then n := n + 1; end if;
  end loop;

  -- Stored document copies that expire within 7 days
  for r in select d.id, d.user_id from public.generated_documents d where d.status = 'ready' and d.persist_policy = 'stored' and d.expires_at is not null and d.expires_at <= now() + interval '7 days' and d.expires_at > now() loop
    made := public.create_notification(r.user_id, 'documents', 'A stored document copy will be removed soon',
      'A copy you asked FairPath to keep is about to expire. Open My Documents to download it or create a new version.', '/documents', 'doc:expiring:' || r.id::text, 'generated_document', r.id, '{}'::jsonb);
    if made is not null then n := n + 1; end if;
  end loop;

  -- Saved resources that are no longer available (once per resource per member)
  for r in select s.user_id, s.resource_id from public.saved_resources s where not public.resource_is_visible(s.resource_id) loop
    made := public.create_notification(r.user_id, 'resources', 'A saved resource is no longer available',
      'One of the resources you saved was removed or is being re-verified. Open your saved resources to find a replacement.', '/saved-resources', 'res:unavailable:' || r.resource_id::text, 'resource', r.resource_id, '{}'::jsonb);
    if made is not null then n := n + 1; end if;
  end loop;

  return n;
end;
$$;
revoke all on function public.generate_member_reminders() from public, anon, authenticated;
grant execute on function public.generate_member_reminders() to service_role;
