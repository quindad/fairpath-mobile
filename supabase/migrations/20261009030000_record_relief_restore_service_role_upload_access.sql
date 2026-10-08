-- Server-side extraction must save validated results and failure state.
-- Do not grant UPDATE to authenticated members: extraction remains server-owned.
grant select, update on table public.record_relief_uploads to service_role;
