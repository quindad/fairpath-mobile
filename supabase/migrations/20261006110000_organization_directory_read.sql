-- Found via real Partner Browser QA: the referral "send to" picker needs to list OTHER active organizations
-- to refer into, but resource_organizations only grants a member read of their OWN org (20261005110000). A
-- referral target directory is not sensitive - organization name/type/national flag is already effectively
-- public (resource_summary_json returns it to any Mobile member browsing resources via a security-definer
-- function that bypasses RLS entirely). This policy just makes that same non-sensitive fact directly
-- queryable by authenticated clients too, for exactly this kind of legitimate "which orgs can I refer to"
-- lookup. It does NOT grant anything about an organization's members, caseload, referrals, or any other table.
drop policy if exists "resource_organizations_read_directory" on public.resource_organizations;
create policy "resource_organizations_read_directory" on public.resource_organizations
  for select to authenticated using (status = 'active');
