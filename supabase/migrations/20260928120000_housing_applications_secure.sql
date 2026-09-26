-- Housing applications: server-controlled status (forward-only).
--
-- PROBLEM (present in the production-derived baseline): an applicant could UPDATE
-- their own housing_applications row with only a user_id check, so they could set
-- status = 'approved' / 'denied' / 'reviewing'. They could also INSERT rows directly
-- (any status, any answers), INSERT their own application events (forging history),
-- INSERT their own FastTrack order (e.g. status 'paid'), insert document rows that
-- point at files that were never uploaded, and insert housing inquiries directly.
--
-- FIX: clients keep read access (and draft deletion). Every state change goes through
-- SECURITY DEFINER functions that derive the user from auth.uid(), validate input and
-- force the resulting status. History is written only by triggers.
--
--   save_housing_application_draft  - creates/updates a DRAFT after meaningful input
--   submit_housing_application      - started -> submitted (validates answers, required documents
--                                     that really exist in storage, FastTrack payment when enforced)
--   withdraw_housing_application    - submitted/reviewing/tour -> withdrawn
--   quote_housing_fasttrack         - creates/refreshes the caller's FastTrack quote (no payment)
--   send_housing_inquiry            - validated, de-duplicated, rate-limited inquiry
--
-- Privacy: only the whitelisted application form fields are ever stored. Nothing from the
-- justice-history tables (convictions, supervision, registration) is read or accepted here.

-- ---------------------------------------------------------------------
-- 1. Close the direct-write paths
-- ---------------------------------------------------------------------
drop policy if exists "Applicants create own housing applications" on public.housing_applications;
drop policy if exists "Applicants update own housing applications" on public.housing_applications;
revoke insert, update on table public.housing_applications from authenticated;
-- (SELECT stays; DELETE stays for the existing draft-only policy.)

drop policy if exists "Applicants create own housing application events" on public.housing_application_events;
revoke insert, update, delete on table public.housing_application_events from authenticated;

drop policy if exists "Users create own FastTrack orders" on public.housing_fasttrack_orders;
revoke insert, update, delete on table public.housing_fasttrack_orders from authenticated;

drop policy if exists "Renters create own housing inquiries" on public.housing_inquiries;
revoke insert, update, delete on table public.housing_inquiries from authenticated;

-- Document rows: keep client upload/delete of draft files, but rows can only be created as
-- 'uploaded' and can never be edited (no fake 'accepted' status).
drop policy if exists "Applicants create own housing documents" on public.housing_application_documents;
create policy "Applicants create own housing documents" on public.housing_application_documents
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'uploaded'
    and rejection_reason is null
    and exists (
      select 1 from public.housing_applications a
      where a.id = housing_application_documents.application_id
        and a.user_id = (select auth.uid())
        and a.status = 'started'
    )
  );
revoke update on table public.housing_application_documents from authenticated;

-- Least privilege: guests never touch these tables (every policy already needs auth.uid()).
revoke all on table public.housing_application_events from anon;
revoke all on table public.housing_application_documents from anon;
revoke all on table public.housing_fasttrack_orders from anon;
revoke all on table public.housing_inquiries from anon;
revoke all on table public.housing_tour_requests from anon;
revoke all on table public.housing_reports from anon;
revoke all on table public.saved_housing_searches from anon;

-- ---------------------------------------------------------------------
-- 2. Draft: created only after meaningful input
-- ---------------------------------------------------------------------
create or replace function public.save_housing_application_draft(
  p_listing_id uuid,
  p_type text,
  p_answers jsonb,
  p_step integer
)
returns table (id uuid, status text, application_type text, current_step integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  l public.housing_listings%rowtype;
  existing public.housing_applications%rowtype;
  step integer := least(greatest(coalesce(p_step, 1), 1), 5);
  clean jsonb;
  allowed constant text[] := array[
    'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'current_address',
    'monthly_income', 'employer', 'employment_status', 'move_in_date', 'occupants',
    'pets', 'housing_history', 'references', 'additional_notes'
  ];
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if p_type is null or p_type not in ('standard', 'fasttrack') then
    raise exception 'INVALID_APPLICATION_TYPE' using errcode = 'P0001';
  end if;

  clean := case when jsonb_typeof(p_answers) = 'object' then coalesce((
    select jsonb_object_agg(t.k, left(btrim(t.v), 2000))
    from jsonb_each_text(p_answers) as t(k, v)
    where t.k = any (allowed)
  ), '{}'::jsonb) else '{}'::jsonb end;

  select * into existing from public.housing_applications a
   where a.user_id = uid and a.listing_id = p_listing_id;

  if found then
    if existing.status <> 'started' then
      raise exception 'APPLICATION_NOT_EDITABLE' using errcode = 'P0001';
    end if;
    update public.housing_applications a
       set answers = clean, current_step = step, updated_at = now()
     where a.id = existing.id;
  else
    -- Opening an application form must not create anything: a draft exists only once the
    -- applicant has completed the first section and continued.
    if step < 2 then
      raise exception 'NO_MEANINGFUL_INPUT' using errcode = 'P0001';
    end if;
    select * into l from public.housing_listings h where h.id = p_listing_id;
    if not found or l.status <> 'published' then
      raise exception 'LISTING_UNAVAILABLE' using errcode = 'P0001';
    end if;
    if p_type = 'fasttrack' and not l.fasttrack_enabled then
      raise exception 'FASTTRACK_NOT_AVAILABLE' using errcode = 'P0001';
    end if;
    insert into public.housing_applications (user_id, listing_id, application_type, status, answers, current_step, updated_at)
    values (uid, p_listing_id, p_type, 'started', clean, step, now());
  end if;

  return query
    select a.id, a.status, a.application_type, a.current_step
    from public.housing_applications a
    where a.user_id = uid and a.listing_id = p_listing_id;
end;
$$;

revoke all on function public.save_housing_application_draft(uuid, text, jsonb, integer) from public, anon;
grant execute on function public.save_housing_application_draft(uuid, text, jsonb, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Submit (same contract as before, now server-controlled)
-- ---------------------------------------------------------------------
create or replace function public.submit_housing_application(p_application_id uuid, p_answers jsonb, p_consent jsonb)
returns table (id uuid, status text, submitted_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.submit_housing_application(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.submit_housing_application(uuid, jsonb, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Withdraw
-- ---------------------------------------------------------------------
create or replace function public.withdraw_housing_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  updated integer;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;

  update public.housing_applications a
     set status = 'withdrawn', updated_at = now()
   where a.id = p_application_id
     and a.user_id = uid
     and a.status in ('submitted', 'reviewing', 'tour');
  get diagnostics updated = row_count;

  if updated = 0 then raise exception 'CANNOT_WITHDRAW' using errcode = 'P0001'; end if;
end;
$$;

revoke all on function public.withdraw_housing_application(uuid) from public, anon;
grant execute on function public.withdraw_housing_application(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. FastTrack quote (no payment is taken here; the order row only records the quote)
-- ---------------------------------------------------------------------
create or replace function public.quote_housing_fasttrack(p_application_id uuid)
returns table (order_id uuid, base_amount_cents integer, discount_cents integer, amount_due_cents integer, status text, payment_enforced boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_plus boolean := false;
  v_order public.housing_fasttrack_orders%rowtype;
  v_enforced boolean := false;
begin
  if v_user is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.housing_applications a
    where a.id = p_application_id and a.user_id = v_user and a.application_type = 'fasttrack'
  ) then
    raise exception 'NOT_FASTTRACK_APPLICATION' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.fairpath_subscriptions s
    where s.user_id = v_user and s.plan = 'fairpath_plus' and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  ) into v_plus;
  select coalesce((c.value #>> '{}')::boolean, false) into v_enforced
  from public.app_config c where c.key = 'fasttrack_payment_enforced';

  insert into public.housing_fasttrack_orders (application_id, user_id, base_amount_cents, discount_cents, amount_due_cents, status, updated_at)
  values (p_application_id, v_user, 7500, case when v_plus then 1000 else 0 end, case when v_plus then 6500 else 7500 end, 'requires_payment', now())
  on conflict (application_id) do update set
    discount_cents = excluded.discount_cents,
    amount_due_cents = excluded.amount_due_cents,
    updated_at = now()
  returning * into v_order;

  return query select v_order.id, v_order.base_amount_cents, v_order.discount_cents, v_order.amount_due_cents, v_order.status, v_enforced;
end;
$$;

revoke all on function public.quote_housing_fasttrack(uuid) from public, anon;
grant execute on function public.quote_housing_fasttrack(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Inquiries: validated, de-duplicated, rate-limited
-- ---------------------------------------------------------------------
create or replace function public.send_housing_inquiry(p_listing_id uuid, p_subject text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  msg text := btrim(coalesce(p_message, ''));
  subj text := left(coalesce(nullif(btrim(coalesce(p_subject, '')), ''), 'Question about this home'), 120);
  existing_id uuid;
  new_id uuid;
begin
  if uid is null then raise exception 'SIGNED_OUT' using errcode = 'P0001'; end if;
  if length(msg) < 10 or length(msg) > 2000 then raise exception 'INVALID_MESSAGE' using errcode = 'P0001'; end if;

  if not exists (select 1 from public.housing_listings h where h.id = p_listing_id and h.status = 'published') then
    raise exception 'LISTING_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Double-tap / retry protection: the same message to the same home within 10 minutes is the same inquiry.
  select i.id into existing_id from public.housing_inquiries i
   where i.user_id = uid and i.listing_id = p_listing_id and i.message = msg
     and i.created_at > now() - interval '10 minutes'
   order by i.created_at desc limit 1;
  if existing_id is not null then return existing_id; end if;

  if (select count(*) from public.housing_inquiries i
       where i.user_id = uid and i.listing_id = p_listing_id and i.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into public.housing_inquiries (user_id, listing_id, subject, message)
  values (uid, p_listing_id, subj, msg)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.send_housing_inquiry(uuid, text, text) from public, anon;
grant execute on function public.send_housing_inquiry(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. History: a 'started' event when a draft is created (status changes are already
--    logged by the existing status trigger). Written by trigger only.
-- ---------------------------------------------------------------------
create or replace function public.log_housing_application_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.housing_application_events (application_id, actor_user_id, event_type, metadata)
  values (new.id, auth.uid(), 'started', jsonb_build_object('type', new.application_type, 'at', now()));
  return null;
end;
$$;

revoke all on function public.log_housing_application_started() from public, anon, authenticated;
grant execute on function public.log_housing_application_started() to service_role;

drop trigger if exists housing_application_started_log on public.housing_applications;
create trigger housing_application_started_log
  after insert on public.housing_applications
  for each row execute function public.log_housing_application_started();
