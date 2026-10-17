-- Real gap found during a competitive feature audit (2026-10-16): housing_inquiries was built as a true
-- one-shot contact form (one message, one reply, enforced by `and i.response_message is null` in
-- partner_reply_housing_inquiry, 20260929100000) -- not the 2-way back-and-forth chat Zillow-style housing
-- apps have. The reply side of a real conversation belongs to the listing's owning Partner account
-- (housing_listings.owner_id), which is Command Center/Partner-app territory, explicitly out of scope for this
-- pass. This migration adds ONLY the member-side half: a real message thread a member can keep adding follow-up
-- questions to under ONE inquiry (instead of filing a brand new unrelated inquiry each time), mirroring the
-- proven marketplace_messages/send_marketplace_pickup_message pattern. The existing single `message` +
-- `response_message` columns on housing_inquiries are left untouched and still work exactly as before; this is
-- purely additive. When Free Buff's Partner side later supports multiple replies, it can write into this same
-- table and the thread "just works" on the member side with zero further Mobile changes.
create table public.housing_inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.housing_inquiries(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) >= 1 and length(btrim(body)) <= 2000),
  created_at timestamptz not null default now()
);
create index housing_inquiry_messages_inquiry_idx on public.housing_inquiry_messages (inquiry_id, created_at);

comment on table public.housing_inquiry_messages is
  'Member-side follow-up thread for a housing_inquiries row. Only the inquiry''s own member (housing_inquiries.user_id) may send into it right now -- the landlord/Partner reply side is not yet wired to this table, see migration header.';

alter table public.housing_inquiry_messages enable row level security;
revoke all on table public.housing_inquiry_messages from anon, authenticated;
grant select, insert on table public.housing_inquiry_messages to authenticated;
grant all on table public.housing_inquiry_messages to service_role;

create policy "Member reads own inquiry thread" on public.housing_inquiry_messages
  for select to authenticated using (
    exists (select 1 from public.housing_inquiries i where i.id = housing_inquiry_messages.inquiry_id and i.user_id = auth.uid())
  );

-- Seeds the thread with the original question (and the landlord's one reply, if any) the first time a member
-- opens it, so the thread reads as continuous history rather than starting empty after an existing reply.
create or replace function public.send_housing_inquiry_followup(p_inquiry_id uuid, p_body text)
returns table(id uuid, inquiry_id uuid, sender_id uuid, body text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_inquiry public.housing_inquiries%rowtype;
  v_created public.housing_inquiry_messages%rowtype;
  v_msg text := btrim(coalesce(p_body, ''));
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  if length(v_msg) < 1 or length(v_msg) > 2000 then raise exception 'MESSAGE_INVALID'; end if;

  select * into v_inquiry from public.housing_inquiries hi where hi.id = p_inquiry_id and hi.user_id = v_user;
  if not found then raise exception 'INQUIRY_NOT_FOUND'; end if;

  -- Backfill the thread with prior history exactly once, so it isn't empty if this is the first follow-up
  -- after the original single-shot message/response_message pair.
  if not exists (select 1 from public.housing_inquiry_messages him where him.inquiry_id = p_inquiry_id) then
    insert into public.housing_inquiry_messages (inquiry_id, sender_id, body, created_at)
    values (p_inquiry_id, v_user, v_inquiry.message, v_inquiry.created_at);
    if v_inquiry.response_message is not null and v_inquiry.responded_by is not null then
      insert into public.housing_inquiry_messages (inquiry_id, sender_id, body, created_at)
      values (p_inquiry_id, v_inquiry.responded_by, v_inquiry.response_message, coalesce(v_inquiry.responded_at, now()));
    end if;
  end if;

  insert into public.housing_inquiry_messages (inquiry_id, sender_id, body)
  values (p_inquiry_id, v_user, v_msg)
  returning * into v_created;

  return query select v_created.id, v_created.inquiry_id, v_created.sender_id, v_created.body, v_created.created_at;
end;
$$;
revoke all on function public.send_housing_inquiry_followup(uuid, text) from public, anon;
grant execute on function public.send_housing_inquiry_followup(uuid, text) to authenticated, service_role;

create or replace function public.load_housing_inquiry_thread(p_inquiry_id uuid)
returns table(id uuid, sender_id uuid, body text, created_at timestamptz, is_me boolean)
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.sender_id, m.body, m.created_at, m.sender_id = auth.uid()
  from public.housing_inquiry_messages m
  join public.housing_inquiries i on i.id = m.inquiry_id
  where m.inquiry_id = p_inquiry_id and i.user_id = auth.uid()
  order by m.created_at asc;
$$;
revoke all on function public.load_housing_inquiry_thread(uuid) from public, anon;
grant execute on function public.load_housing_inquiry_thread(uuid) to authenticated, service_role;
