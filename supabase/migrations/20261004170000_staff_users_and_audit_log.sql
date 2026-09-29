-- FairPath Command Center foundation: staff identity/roles + a generic audit log.
--
-- Architecture decision, stated explicitly: Command Center's Admin app is a SEPARATE, privileged application
-- (Next.js, server-rendered/server-actions) that authenticates staff via the SAME Supabase Auth used by Mobile,
-- then does all data reads/writes through the SERVICE ROLE KEY on the server side - never through the anon key
-- with RLS-as-staff. This means Mobile's existing member-facing RLS policies do NOT need to change at all to
-- support Admin - exactly matching the standing rule "do not reopen frozen Mobile feature scope unless Command
-- Center exposes a genuine shared-backend defect." staff_users exists so the Admin server can check "is this
-- signed-in identity actually staff, and what can they do" before using its service-role privileges - it is
-- deliberately NOT a table any client-side RLS ever grants broader access based on.

create table if not exists public.staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'admin', 'moderator', 'support', 'read_only')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  display_name text check (display_name is null or length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists staff_users_role_idx on public.staff_users (role, status);

alter table public.staff_users enable row level security;
revoke all on table public.staff_users from public, anon, authenticated;
grant select, insert, update, delete on table public.staff_users to service_role;
-- No policy for anon/authenticated at all, deliberately: staff status is checked server-side with the service
-- role key, never client-side. An ordinary Mobile member's authenticated session can never read this table,
-- not even their own row - there is no "am I staff" self-check exposed to the Mobile app.

-- Generic append-only audit log for every Admin action, per the real gap named in
-- docs/MOBILE_TO_COMMAND_CENTER_HANDOFF.md ("only entitlement_audit_log exists today"). One generic table
-- instead of one bespoke table per Admin surface - reusable, not duplicated per module.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  action text not null check (length(btrim(action)) between 2 and 80),
  target_table text,
  target_id text,
  before_state jsonb,
  after_state jsonb,
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_actor_idx on public.admin_audit_log (actor_user_id, created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_table, target_id, created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;
grant select, insert on table public.admin_audit_log to service_role;
-- Append-only in practice: no update/delete grant to any role, including service_role - a real audit trail must
-- not be editable even by the system that writes it. If a correction is ever needed, insert a new row
-- referencing the old one via notes, never mutate history.
