-- Step 1 Canonical Profile: versioned offense taxonomy.
--
-- PROVISIONAL. Ships for building/testing the eligibility engine against,
-- but production eligibility decisions stay behind the
-- justice_eligibility_engine_enabled feature flag (see migration 0009)
-- until formal legal review approves the taxonomy (Sterling decision #1).
--
-- Two tables so a future legal-approved revision is a new version + a
-- re-mapping pass, never a destructive rewrite of category definitions
-- that existing convictions rows already point to.
--
-- NOT YET APPLIED to the live project — see supabase/README.md.

create table if not exists public.offense_taxonomy_versions (
  id uuid primary key default gen_random_uuid(),
  version_number integer not null unique,
  status text not null default 'provisional'
    check (status in ('provisional', 'pending_legal_review', 'approved', 'superseded')),
  effective_from date,
  approved_by text,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.offense_taxonomy_versions is
  'Versioned sets of the justice-history offense taxonomy. Version 1 is provisional pending legal/domain review (FairPath V1 Master Product Blueprint, Sec. 16).';

create table if not exists public.offense_taxonomy_categories (
  id uuid primary key default gen_random_uuid(),
  taxonomy_version_id uuid not null references public.offense_taxonomy_versions(id) on delete cascade,
  key text not null,
  display_label text not null,
  sort_order smallint not null,
  unique (taxonomy_version_id, key)
);

comment on table public.offense_taxonomy_categories is
  'Categories within one taxonomy version. convictions.taxonomy_category_id points here, recording which version classified that record.';

alter table public.offense_taxonomy_versions enable row level security;
alter table public.offense_taxonomy_categories enable row level security;

-- Reference data: readable by anyone (including guest/pre-auth flows
-- like Record Relief's eligibility check that need to render a category
-- picker), writable only by service role / Studio until Admin exists.
drop policy if exists "offense_taxonomy_versions_read_all" on public.offense_taxonomy_versions;
create policy "offense_taxonomy_versions_read_all"
  on public.offense_taxonomy_versions for select to anon, authenticated using (true);

drop policy if exists "offense_taxonomy_categories_read_all" on public.offense_taxonomy_categories;
create policy "offense_taxonomy_categories_read_all"
  on public.offense_taxonomy_categories for select to anon, authenticated using (true);

-- Seed version 1 — the 9 categories from the Blueprint, verbatim.
insert into public.offense_taxonomy_versions (version_number, status, notes)
values (1, 'provisional', 'Initial 9-category taxonomy per FairPath V1 Master Product Blueprint Sec. 16. Final category boundaries require legal/domain review before production use.')
on conflict (version_number) do nothing;

insert into public.offense_taxonomy_categories (taxonomy_version_id, key, display_label, sort_order)
select v.id, c.key, c.display_label, c.sort_order
from public.offense_taxonomy_versions v
cross join (values
  ('violence', 'Violence', 1),
  ('weapons', 'Weapons', 2),
  ('drugs', 'Drugs', 3),
  ('property_theft', 'Property / Theft', 4),
  ('fraud_financial', 'Fraud / Financial', 5),
  ('sex_offenses', 'Sex Offenses', 6),
  ('driving_vehicle', 'Driving / Vehicle', 7),
  ('public_order', 'Public Order', 8),
  ('other', 'Other', 9)
) as c(key, display_label, sort_order)
where v.version_number = 1
on conflict (taxonomy_version_id, key) do nothing;
