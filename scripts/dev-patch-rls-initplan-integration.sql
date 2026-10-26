-- DEV patch: initplan-safe RLS for integration tables (idempotent).
drop policy if exists resource_reactions_own on public.resource_reactions;
create policy resource_reactions_own on public.resource_reactions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists community_contributions_read_own on public.community_contributions;
create policy community_contributions_read_own on public.community_contributions
  for select to authenticated using (contributor_id = (select auth.uid()));

drop policy if exists community_contributions_insert_own on public.community_contributions;
create policy community_contributions_insert_own on public.community_contributions
  for insert to authenticated with check (contributor_id = (select auth.uid()));

drop policy if exists member_opportunity_plan_items_own on public.member_opportunity_plan_items;
create policy member_opportunity_plan_items_own on public.member_opportunity_plan_items
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
