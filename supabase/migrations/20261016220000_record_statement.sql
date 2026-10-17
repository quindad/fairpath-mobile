-- "Explain my record" pre-disclosure tool. A member writes ONE private statement about their record, once, and
-- chooses -- per application -- whether to attach a snapshot of it to a specific job or housing application.
-- Never shown to anyone unless the member explicitly opts in at the moment they apply. Never public, never
-- auto-attached, never required.

create table if not exists public.member_record_statements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 3000),
  updated_at timestamptz not null default now()
);

alter table public.member_record_statements enable row level security;

grant select, insert, update, delete on table public.member_record_statements to authenticated;
grant select, insert, update, delete on table public.member_record_statements to service_role;

drop policy if exists "member_record_statements_owner_select" on public.member_record_statements;
create policy "member_record_statements_owner_select" on public.member_record_statements
  for select using (auth.uid() = user_id);

drop policy if exists "member_record_statements_owner_insert" on public.member_record_statements;
create policy "member_record_statements_owner_insert" on public.member_record_statements
  for insert with check (auth.uid() = user_id);

drop policy if exists "member_record_statements_owner_update" on public.member_record_statements;
create policy "member_record_statements_owner_update" on public.member_record_statements
  for update using (auth.uid() = user_id);

drop policy if exists "member_record_statements_owner_delete" on public.member_record_statements;
create policy "member_record_statements_owner_delete" on public.member_record_statements
  for delete using (auth.uid() = user_id);

create or replace function public.touch_record_statement_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists member_record_statements_touch on public.member_record_statements;
create trigger member_record_statements_touch before update on public.member_record_statements
  for each row execute function public.touch_record_statement_updated_at();

-- Easy Apply: attach a snapshot of the member's own record statement when they explicitly opt in.
drop function if exists public.submit_job_application(uuid, jsonb, uuid);
create or replace function public.submit_job_application(p_job_id uuid, p_answers jsonb default '{}'::jsonb, p_resume_id uuid default null::uuid, p_include_statement boolean default false)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  stored_answers jsonb;
  share boolean := coalesce((p_answers ->> 'share_opportunity_profile')::boolean, false);
  share_sections text[] := '{}';
  snap jsonb;
  resume_row public.member_resumes%rowtype;
  statement_body text;
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

  if exists (select 1 from public.job_applications a where a.user_id = uid and a.job_id = p_job_id) then
    raise exception 'ALREADY_APPLIED' using errcode = 'P0001';
  end if;

  if p_resume_id is not null then
    select * into resume_row from public.member_resumes r where r.id = p_resume_id and r.user_id = uid;
    if not found then raise exception 'RESUME_NOT_FOUND' using errcode = 'P0001'; end if;
  end if;

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

  stored_answers := jsonb_build_object(
    'profile', stored_profile,
    'employer_questions', stored_eq,
    'submitted_via', 'easy_apply',
    'reviewed_by_user', true
  );

  if resume_row.id is not null then
    stored_answers := stored_answers || jsonb_build_object('resume_snapshot', jsonb_build_object(
      'resume_id', resume_row.id, 'title', resume_row.title, 'content', resume_row.content
    ));
  end if;

  if p_include_statement then
    select s.body into statement_body from public.member_record_statements s where s.user_id = uid;
    if nullif(btrim(coalesce(statement_body, '')), '') is not null then
      stored_answers := stored_answers || jsonb_build_object('record_statement_snapshot', jsonb_build_object('body', statement_body, 'captured_at', now()));
    end if;
  end if;

  if share then
    select coalesce(array_agg(x), '{}') into share_sections
    from jsonb_array_elements_text(coalesce(p_answers -> 'share_sections', '[]'::jsonb)) x;
    snap := public.build_opportunity_snapshot(uid, share_sections);
    if snap is not null then
      stored_answers := stored_answers || jsonb_build_object('opportunity_snapshot', snap);
    end if;
  end if;

  insert into public.job_applications (user_id, job_id, status, answers, submitted_at, updated_at)
  values (uid, p_job_id, 'submitted', stored_answers, now(), now())
  on conflict (user_id, job_id) do nothing
  returning id into app_id;

  if app_id is null then
    raise exception 'ALREADY_APPLIED' using errcode = 'P0001';
  end if;
  return app_id;
end;
$function$;

-- Housing application: same opt-in attachment, stored inside the answers jsonb (outside the strict whitelist,
-- added after it so the whitelist filter never strips it).
drop function if exists public.submit_housing_application(uuid, jsonb, jsonb);
create or replace function public.submit_housing_application(p_application_id uuid, p_answers jsonb, p_consent jsonb, p_include_statement boolean default false)
 returns table(id uuid, status text, submitted_at timestamp with time zone)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_now timestamptz := now();
  v_type text;
  v_listing_id uuid;
  v_listing_status text;
  v_required_docs text[] := '{}';
  v_required_doc text;
  v_enforced boolean := false;
  v_payment text;
  v_phone text;
  v_occupants integer;
  v_income numeric;
  v_clean jsonb;
  v_statement_body text;
  allowed constant text[] := array[
    'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'current_address',
    'monthly_income', 'employer', 'employment_status', 'move_in_date', 'occupants',
    'pets', 'housing_history', 'references', 'additional_notes'
  ];
begin
  if v_user is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if coalesce((p_consent ->> 'accuracy')::boolean, false) is not true
     or coalesce((p_consent ->> 'submit')::boolean, false) is not true then
    raise exception 'CONSENT_REQUIRED' using errcode = 'P0001';
  end if;

  select a.application_type, a.listing_id, l.required_application_documents, l.status
    into v_type, v_listing_id, v_required_docs, v_listing_status
  from public.housing_applications a
  join public.housing_listings l on l.id = a.listing_id
  where a.id = p_application_id
    and a.user_id = v_user
    and a.status = 'started';

  if v_type is null then raise exception 'APPLICATION_NOT_SUBMITTABLE' using errcode = 'P0001'; end if;
  if v_listing_status <> 'published' then raise exception 'LISTING_UNAVAILABLE' using errcode = 'P0001'; end if;
  if v_type = 'fasttrack' and coalesce((p_consent ->> 'fasttrack_ack')::boolean, false) is not true then
    raise exception 'FASTTRACK_ACK_REQUIRED' using errcode = 'P0001';
  end if;

  v_clean := case when jsonb_typeof(p_answers) = 'object' then coalesce((
    select jsonb_object_agg(t.k, left(btrim(t.v), 2000))
    from jsonb_each_text(p_answers) as t(k, v)
    where t.k = any (allowed)
  ), '{}'::jsonb) else '{}'::jsonb end;

  -- Server-side required-answer enforcement; client validation is not trusted as the only gate.
  if length(trim(coalesce(v_clean ->> 'first_name', ''))) < 2
     or length(trim(coalesce(v_clean ->> 'last_name', ''))) < 2
     or trim(coalesce(v_clean ->> 'email', '')) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or trim(coalesce(v_clean ->> 'current_address', '')) = ''
     or trim(coalesce(v_clean ->> 'employment_status', '')) = ''
     or trim(coalesce(v_clean ->> 'move_in_date', '')) !~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
     or trim(coalesce(v_clean ->> 'date_of_birth', '')) !~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
     or trim(coalesce(v_clean ->> 'pets', '')) = ''
     or trim(coalesce(v_clean ->> 'housing_history', '')) = ''
     or trim(coalesce(v_clean ->> 'references', '')) = '' then
    raise exception 'APPLICATION_INCOMPLETE' using errcode = 'P0001';
  end if;

  v_phone := regexp_replace(coalesce(v_clean ->> 'phone', ''), '[^0-9]', '', 'g');
  if length(v_phone) <> 10 then raise exception 'APPLICATION_INCOMPLETE' using errcode = 'P0001'; end if;

  begin
    v_occupants := (v_clean ->> 'occupants')::integer;
  exception when others then
    raise exception 'APPLICATION_INCOMPLETE' using errcode = 'P0001';
  end;
  if v_occupants is null or v_occupants < 1 then raise exception 'APPLICATION_INCOMPLETE' using errcode = 'P0001'; end if;

  begin
    v_income := regexp_replace(coalesce(v_clean ->> 'monthly_income', ''), '[^0-9.]', '', 'g')::numeric;
  exception when others then
    raise exception 'APPLICATION_INCOMPLETE' using errcode = 'P0001';
  end;
  if v_income is null or v_income < 0 then raise exception 'APPLICATION_INCOMPLETE' using errcode = 'P0001'; end if;

  if v_clean ->> 'employment_status' <> 'Unemployed' and trim(coalesce(v_clean ->> 'employer', '')) = '' then
    raise exception 'APPLICATION_INCOMPLETE' using errcode = 'P0001';
  end if;

  -- Required documents must exist as a row AND as a real uploaded file in storage.
  foreach v_required_doc in array coalesce(v_required_docs, '{}'::text[]) loop
    if not exists (
      select 1
      from public.housing_application_documents d
      join storage.objects o
        on o.bucket_id = 'housing-application-documents' and o.name = d.storage_path
      where d.application_id = p_application_id
        and d.user_id = v_user
        and d.document_type = v_required_doc
        and d.status <> 'rejected'
    ) then
      raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode = 'P0001';
    end if;
  end loop;

  if v_type = 'fasttrack' then
    select coalesce((c.value #>> '{}')::boolean, false) into v_enforced
    from public.app_config c where c.key = 'fasttrack_payment_enforced';

    if v_enforced then
      select o.status into v_payment
      from public.housing_fasttrack_orders o
      where o.application_id = p_application_id and o.user_id = v_user;
      if coalesce(v_payment, '') not in ('paid', 'waived') then
        raise exception 'PAYMENT_REQUIRED' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if p_include_statement then
    select s.body into v_statement_body from public.member_record_statements s where s.user_id = v_user;
    if nullif(btrim(coalesce(v_statement_body, '')), '') is not null then
      v_clean := v_clean || jsonb_build_object('record_statement_snapshot', jsonb_build_object('body', v_statement_body, 'captured_at', v_now));
    end if;
  end if;

  update public.housing_applications a
     set answers = v_clean,
         current_step = 5,
         status = 'submitted',
         submitted_at = v_now,
         updated_at = v_now,
         applicant_snapshot = v_clean,
         consent_snapshot = p_consent || jsonb_build_object('confirmed_at', v_now)
   where a.id = p_application_id
     and a.user_id = v_user
     and a.status = 'started';

  if not found then raise exception 'APPLICATION_NOT_SUBMITTABLE' using errcode = 'P0001'; end if;

  return query
    select a.id, a.status, a.submitted_at
    from public.housing_applications a
    where a.id = p_application_id and a.user_id = v_user;
end;
$function$;
