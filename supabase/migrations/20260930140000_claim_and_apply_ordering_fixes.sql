-- Forward fix for two ordering defects found by the authenticated DEV harness (25/27 passed).
-- Already-applied migrations are not edited.
--
-- 1. claim_correctional_transition checked "does this ACCOUNT already hold a correctional grant" BEFORE "was this
--    verified IDENTITY already processed". A repeat claim of the SAME identity by the SAME account therefore reported
--    'account_already_has_benefit' instead of the accurate, idempotent 'already_claimed'. Nothing was ever minted twice,
--    but the answer was wrong. Order is now: (1) identity already processed -> 'already_claimed'; (2) account already
--    holds a correctional grant (with a NEW identity) -> 'account_already_has_benefit'; (3) issue exactly one grant.
--    Both protections are preserved: one benefit per verified identity, one per account.
--
-- 2. submit_job_application ran field validation BEFORE noticing that the member had already applied, so a repeat
--    submission with an incomplete payload said INVALID_APPLICATION:first_name instead of ALREADY_APPLIED. The
--    duplicate check now runs right after the job is confirmed applicable; validation is unchanged for first submissions.

create or replace function public.claim_correctional_transition(
  p_user uuid,
  p_identity_key text,
  p_deployment text,
  p_verified_at timestamptz,
  p_verified_by text
)
returns table (result text, grant_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  event_id uuid;
  ev public.corrections_migration_events%rowtype;
  new_grant uuid;
  ends timestamptz;
begin
  if p_user is null or coalesce(btrim(p_identity_key), '') = '' or coalesce(btrim(p_deployment), '') = '' or p_verified_at is null or coalesce(btrim(p_verified_by), '') = '' then
    raise exception 'INVALID_CLAIM' using errcode = 'P0001';
  end if;

  -- (1) this verified identity was already processed: never mint a second benefit, whoever asks
  select * into ev from public.corrections_migration_events c where c.identity_key = p_identity_key;
  if found then
    insert into public.entitlement_audit_log (user_id, actor, action, grant_id, details)
    values (p_user, p_verified_by, 'correctional_claim_duplicate', ev.grant_id, jsonb_build_object('event_id', ev.id, 'deployment', p_deployment));
    select e.expires_at into ends from public.entitlement_grants e where e.id = ev.grant_id;
    return query select 'already_claimed'::text, ev.grant_id, ends;
    return;
  end if;

  -- (2) one correctional grant per account: checked BEFORE a new identity is consumed
  if exists (select 1 from public.entitlement_grants g where g.user_id = p_user and g.source_type = 'correctional_transition') then
    insert into public.entitlement_audit_log (user_id, actor, action, details)
    values (p_user, p_verified_by, 'correctional_claim_duplicate', jsonb_build_object('reason', 'account_already_has_correctional_grant'));
    return query select 'account_already_has_benefit'::text, null::uuid, null::timestamptz;
    return;
  end if;

  -- (3) exactly one grant; the unique identity_key makes a concurrent duplicate lose the race cleanly
  insert into public.corrections_migration_events (identity_key, deployment, verified_at, verified_by)
  values (p_identity_key, p_deployment, p_verified_at, p_verified_by)
  on conflict (identity_key) do nothing
  returning id into event_id;

  if event_id is null then
    select * into ev from public.corrections_migration_events c where c.identity_key = p_identity_key;
    select e.expires_at into ends from public.entitlement_grants e where e.id = ev.grant_id;
    return query select 'already_claimed'::text, ev.grant_id, ends;
    return;
  end if;

  new_grant := public.issue_entitlement_grant(
    p_user, 'correctional_transition', event_id::text, 'corr:' || p_identity_key, 90, null,
    'Verified correctional-tablet migration from ' || p_deployment);

  update public.corrections_migration_events c
     set claimed_by_user_id = p_user, claimed_at = now(), grant_id = new_grant
   where c.id = event_id;

  insert into public.entitlement_audit_log (user_id, actor, action, grant_id, details)
  values (p_user, p_verified_by, 'correctional_claim', new_grant, jsonb_build_object('event_id', event_id, 'deployment', p_deployment));

  select e.expires_at into ends from public.entitlement_grants e where e.id = new_grant;
  return query select 'granted'::text, new_grant, ends;
end;
$$;
revoke all on function public.claim_correctional_transition(uuid, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.claim_correctional_transition(uuid, text, text, timestamptz, text) to service_role;

create or replace function public.submit_job_application(p_job_id uuid, p_answers jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  j public.jobs%rowtype;
  prof jsonb := coalesce(p_answers -> 'profile', '{}'::jsonb);
  eq jsonb := coalesce(p_answers -> 'employer_questions', '{}'::jsonb);
  first_name text := btrim(coalesce(prof ->> 'first_name', ''));
  last_name text := btrim(coalesce(prof ->> 'last_name', ''));
  phone_digits text := regexp_replace(coalesce(prof ->> 'phone', ''), '[^0-9]', '', 'g');
  email text := btrim(coalesce(auth.jwt() ->> 'email', ''));
  stored_profile jsonb;
  stored_eq jsonb := '{}'::jsonb;
  q jsonb;
  qid text;
  ans text;
  app_id uuid;
  opt text;
begin
  if uid is null then
    raise exception 'SIGNED_OUT' using errcode = 'P0001';
  end if;

  select * into j from public.jobs where id = p_job_id;
  if not found or j.status <> 'published' or (j.expires_at is not null and j.expires_at <= now()) then
    raise exception 'JOB_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if j.application_method = 'external' then
    raise exception 'EXTERNAL_APPLICATION' using errcode = 'P0001';
  end if;

  -- Duplicate first: a member who already applied is told so, whatever the payload looks like.
  if exists (select 1 from public.job_applications a where a.user_id = uid and a.job_id = p_job_id) then
    raise exception 'ALREADY_APPLIED' using errcode = 'P0001';
  end if;

  -- Minimum an employer needs to contact an applicant: name, email, phone.
  if length(first_name) < 2 then raise exception 'INVALID_APPLICATION:first_name' using errcode = 'P0001'; end if;
  if length(last_name) < 2 then raise exception 'INVALID_APPLICATION:last_name' using errcode = 'P0001'; end if;
  if length(phone_digits) <> 10 then raise exception 'INVALID_APPLICATION:phone' using errcode = 'P0001'; end if;
  if email = '' then raise exception 'INVALID_APPLICATION:email' using errcode = 'P0001'; end if;

  stored_profile := jsonb_build_object(
    'first_name', left(first_name, 80),
    'last_name', left(last_name, 80),
    'email', left(email, 254),
    'phone', phone_digits
  );
  foreach opt in array array['education', 'skills', 'certifications', 'desired_roles'] loop
    if nullif(btrim(coalesce(prof ->> opt, '')), '') is not null then
      stored_profile := stored_profile || jsonb_build_object(opt, left(btrim(prof ->> opt), 500));
    end if;
  end loop;
  if (prof ->> 'resume_ready') in ('Yes', 'No') then
    stored_profile := stored_profile || jsonb_build_object('resume_ready', prof ->> 'resume_ready');
  end if;

  -- Only the employer's own questions are accepted; required ones must be answered.
  for q in select * from jsonb_array_elements(coalesce(j.application_questions, '[]'::jsonb)) loop
    qid := q ->> 'id';
    continue when qid is null;
    ans := btrim(coalesce(eq ->> qid, ''));
    if coalesce((q ->> 'required')::boolean, false) and ans = '' then
      raise exception 'INVALID_APPLICATION:question:%', qid using errcode = 'P0001';
    end if;
    if ans <> '' then
      stored_eq := stored_eq || jsonb_build_object(qid, left(ans, 2000));
    end if;
  end loop;

  insert into public.job_applications (user_id, job_id, status, answers, submitted_at, updated_at)
  values (
    uid, p_job_id, 'submitted',
    jsonb_build_object(
      'profile', stored_profile,
      'employer_questions', stored_eq,
      'submitted_via', 'easy_apply',
      'reviewed_by_user', true
    ),
    now(), now()
  )
  on conflict (user_id, job_id) do nothing
  returning id into app_id;

  if app_id is null then
    raise exception 'ALREADY_APPLIED' using errcode = 'P0001';
  end if;
  return app_id;
end;
$$;
revoke all on function public.submit_job_application(uuid, jsonb) from public, anon;
grant execute on function public.submit_job_application(uuid, jsonb) to authenticated, service_role;
