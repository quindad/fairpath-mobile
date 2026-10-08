-- Cache stable auth helpers once per statement in RLS policies, following Supabase's initPlan guidance.
do $$
declare
  policy_row record;
  optimized_qual text;
  optimized_check text;
  ddl text;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and regexp_replace(
        coalesce(qual, '') || ' ' || coalesce(with_check, ''),
        '\(\s*select\s+auth\.(uid|role|jwt)\(\)(\s+as\s+[a-z_][a-z0-9_]*)?\s*\)',
        '',
        'gi'
      ) ~* 'auth\.(uid|role|jwt)\(\)'
  loop
    optimized_qual := policy_row.qual;
    optimized_check := policy_row.with_check;

    if optimized_qual is not null then
      optimized_qual := regexp_replace(optimized_qual, '\(\s*select\s+auth\.uid\(\)(\s+as\s+[a-z_][a-z0-9_]*)?\s*\)', '__fairpath_auth_uid__', 'gi');
      optimized_qual := regexp_replace(optimized_qual, '\(\s*select\s+auth\.role\(\)(\s+as\s+[a-z_][a-z0-9_]*)?\s*\)', '__fairpath_auth_role__', 'gi');
      optimized_qual := regexp_replace(optimized_qual, '\(\s*select\s+auth\.jwt\(\)(\s+as\s+[a-z_][a-z0-9_]*)?\s*\)', '__fairpath_auth_jwt__', 'gi');
      optimized_qual := replace(optimized_qual, 'auth.uid()', '(select auth.uid())');
      optimized_qual := replace(optimized_qual, 'auth.role()', '(select auth.role())');
      optimized_qual := replace(optimized_qual, 'auth.jwt()', '(select auth.jwt())');
      optimized_qual := replace(optimized_qual, '__fairpath_auth_uid__', '(select auth.uid())');
      optimized_qual := replace(optimized_qual, '__fairpath_auth_role__', '(select auth.role())');
      optimized_qual := replace(optimized_qual, '__fairpath_auth_jwt__', '(select auth.jwt())');
    end if;

    if optimized_check is not null then
      optimized_check := regexp_replace(optimized_check, '\(\s*select\s+auth\.uid\(\)(\s+as\s+[a-z_][a-z0-9_]*)?\s*\)', '__fairpath_auth_uid__', 'gi');
      optimized_check := regexp_replace(optimized_check, '\(\s*select\s+auth\.role\(\)(\s+as\s+[a-z_][a-z0-9_]*)?\s*\)', '__fairpath_auth_role__', 'gi');
      optimized_check := regexp_replace(optimized_check, '\(\s*select\s+auth\.jwt\(\)(\s+as\s+[a-z_][a-z0-9_]*)?\s*\)', '__fairpath_auth_jwt__', 'gi');
      optimized_check := replace(optimized_check, 'auth.uid()', '(select auth.uid())');
      optimized_check := replace(optimized_check, 'auth.role()', '(select auth.role())');
      optimized_check := replace(optimized_check, 'auth.jwt()', '(select auth.jwt())');
      optimized_check := replace(optimized_check, '__fairpath_auth_uid__', '(select auth.uid())');
      optimized_check := replace(optimized_check, '__fairpath_auth_role__', '(select auth.role())');
      optimized_check := replace(optimized_check, '__fairpath_auth_jwt__', '(select auth.jwt())');
    end if;

    ddl := format('alter policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
    if optimized_qual is not null then
      ddl := ddl || format(' using (%s)', optimized_qual);
    end if;
    if optimized_check is not null then
      ddl := ddl || format(' with check (%s)', optimized_check);
    end if;
    execute ddl;
  end loop;
end
$$;
