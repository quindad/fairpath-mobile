-- Restore minimum authenticated Record Relief access; ownership is still enforced by RLS.
grant select,insert on public.record_relief_uploads to authenticated;
grant select,insert on public.record_relief_case_packets to authenticated;
grant select on public.record_relief_rules,public.record_relief_forms,public.record_relief_federal_pathways to authenticated;
