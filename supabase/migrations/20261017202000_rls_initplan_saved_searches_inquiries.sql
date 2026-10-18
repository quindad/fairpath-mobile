-- SQL audit: wrap auth.uid() for initplan-safe RLS (saved job searches + housing inquiry threads).

drop policy if exists "Member reads own inquiry thread" on public.housing_inquiry_messages;
create policy "Member reads own inquiry thread" on public.housing_inquiry_messages
  for select to authenticated using (
    exists (
      select 1 from public.housing_inquiries i
      where i.id = housing_inquiry_messages.inquiry_id and i.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users read own job searches" on public.saved_job_searches;
create policy "Users read own job searches" on public.saved_job_searches
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users create own job searches" on public.saved_job_searches;
create policy "Users create own job searches" on public.saved_job_searches
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users update own job searches" on public.saved_job_searches;
create policy "Users update own job searches" on public.saved_job_searches
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own job searches" on public.saved_job_searches;
create policy "Users delete own job searches" on public.saved_job_searches
  for delete to authenticated using (user_id = (select auth.uid()));
