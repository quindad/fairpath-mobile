-- SQL audit: auth.uid() must be wrapped as (select auth.uid()) for initplan caching.
drop policy if exists "member_record_statements_owner_select" on public.member_record_statements;
create policy "member_record_statements_owner_select" on public.member_record_statements
  for select using ((select auth.uid()) = user_id);

drop policy if exists "member_record_statements_owner_insert" on public.member_record_statements;
create policy "member_record_statements_owner_insert" on public.member_record_statements
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "member_record_statements_owner_update" on public.member_record_statements;
create policy "member_record_statements_owner_update" on public.member_record_statements
  for update using ((select auth.uid()) = user_id);

drop policy if exists "member_record_statements_owner_delete" on public.member_record_statements;
create policy "member_record_statements_owner_delete" on public.member_record_statements
  for delete using ((select auth.uid()) = user_id);
