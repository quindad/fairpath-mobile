-- ============================================================================================
-- DRAFT — NOT APPLIED. DO NOT RUN. Outside supabase/migrations on purpose.
-- Depends on 20261021100000_staffing_architecture_DRAFT.sql (staffing_assignments must exist first).
-- Adds the three tables documented as needed but not yet drafted: staffing_audit_log,
-- staffing_rate_card_templates, staffing_provider_events. Mirrors src/core/staffing/{audit,
-- rate-card-template,provider-events}.ts exactly.
-- ============================================================================================

-- ---------------------------------------------------------------------
-- staffing_audit_log: append-only, same immutability trigger pattern as entitlement_audit_log.
-- ---------------------------------------------------------------------
create table if not exists public.staffing_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'requisition_status_changed', 'candidate_submitted', 'screening_requested', 'screening_consent_recorded',
    'restricted_screening_state_viewed', 'onboarding_requested', 'provider_state_changed', 'placement_confirmed',
    'assignment_status_changed', 'rate_card_changed', 'conversion_to_direct_hire', 'assignment_completed')),
  assignment_id uuid references public.staffing_assignments(id) on delete set null,
  requisition_id uuid references public.staffing_requisitions(id) on delete set null,
  details jsonb not null default '{}'::jsonb, -- may contain financial fields for rate_card_changed; never redacted at write time
  created_at timestamptz not null default now()
);
create index if not exists staffing_audit_log_assignment_idx on public.staffing_audit_log (assignment_id, created_at desc);
create index if not exists staffing_audit_log_requisition_idx on public.staffing_audit_log (requisition_id, created_at desc);

create or replace function public.staffing_audit_log_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'staffing_audit_log is append-only';
end;
$$;
drop trigger if exists staffing_audit_log_no_change on public.staffing_audit_log;
create trigger staffing_audit_log_no_change
  before update or delete on public.staffing_audit_log
  for each row execute function public.staffing_audit_log_immutable();

alter table public.staffing_audit_log enable row level security;
revoke all on table public.staffing_audit_log from public, anon, authenticated;
-- NO authenticated read policy. toClientSafeEvent() in audit.ts is the only path to a UI, applied in application
-- code reading through a service-role-backed function — never direct table access for member or employer roles.
grant select, insert on table public.staffing_audit_log to service_role;

-- ---------------------------------------------------------------------
-- staffing_rate_card_templates: effective-dated client commercial terms. Ops-only, same financial isolation as
-- staffing_rate_cards / staffing_economics in the prior draft.
-- ---------------------------------------------------------------------
create table if not exists public.staffing_rate_card_templates (
  id uuid primary key default gen_random_uuid(),
  client_organization_id uuid not null references public.resource_organizations(id) on delete cascade,
  role_title text not null,
  location text not null,
  effective_from date not null,
  effective_to date,
  pay_range_min_hourly numeric check (pay_range_min_hourly is null or pay_range_min_hourly > 0),
  pay_range_max_hourly numeric check (pay_range_max_hourly is null or pay_range_max_hourly > 0),
  bill_rate_hourly numeric check (bill_rate_hourly is null or bill_rate_hourly > 0),
  markup_percent numeric check (markup_percent is null or markup_percent >= 0),
  eor_cost_assumption_hourly numeric check (eor_cost_assumption_hourly is null or eor_cost_assumption_hourly >= 0),
  overtime_rules_text text,
  screening_requirements_text text,
  assignment_minimum_weeks integer check (assignment_minimum_weeks is null or assignment_minimum_weeks > 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);
create index if not exists rate_card_templates_lookup_idx
  on public.staffing_rate_card_templates (client_organization_id, role_title, location, effective_from);

alter table public.staffing_rate_card_templates enable row level security;
revoke all on table public.staffing_rate_card_templates from public, anon, authenticated;
-- Financial table: no authenticated policy, service_role only — same rule as staffing_rate_cards.
grant select, insert, update, delete on table public.staffing_rate_card_templates to service_role;

-- ---------------------------------------------------------------------
-- staffing_provider_events: the idempotency ledger that src/core/staffing/provider-events.ts models in memory.
-- Row shape = IngestionLedger's applied-event tracking, persisted.
-- ---------------------------------------------------------------------
create table if not exists public.staffing_provider_events (
  event_id text primary key, -- provider-issued; the idempotency key itself
  assignment_id uuid not null references public.staffing_assignments(id) on delete cascade,
  provider text not null check (provider in ('foxhire', 'checkr')),
  to_state text not null, -- validated application-side against FoxHireState / ScreeningState; not constrained here
                           -- because the two enums differ and this table serves both providers generically
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  outcome text not null check (outcome in ('applied', 'already_applied', 'rejected_invalid_transition', 'rejected_out_of_order'))
);
create index if not exists staffing_provider_events_assignment_idx on public.staffing_provider_events (assignment_id, occurred_at);

alter table public.staffing_provider_events enable row level security;
revoke all on table public.staffing_provider_events from public, anon, authenticated;
-- Provider integration data: service_role only, same isolation category as staffing_provider_state /
-- staffing_screening_state in the prior draft.
grant select, insert on table public.staffing_provider_events to service_role;
