-- Program Scout foundation, step 1: make the domain list and benefit-type vocabulary DATA, not a hardcoded
-- check constraint, so a new domain (healthcare, legal aid, utilities, ...) can be added later by inserting a
-- row, never by a schema migration. incentive_programs.program_domain is re-pointed from a 2-value check
-- constraint to a foreign key into this table.

create table public.program_domains (
  code text primary key,
  display_name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.program_domains is
  'The extensible domain list Program Scout operates across. Adding a domain is an insert here, never a schema '
  'change - this is what "domain-extensible from day one" means structurally.';

insert into public.program_domains (code, display_name, description) values
  ('employment', 'Employment', 'Hiring/wage-related tax credits, deductions, reimbursements, bonding, and workforce incentives.'),
  ('housing', 'Housing', 'Landlord/tenant funding, protection, and subsidy programs - rental subsidy, deposit/move-in assistance, damage mitigation, rent-loss protection.'),
  ('record_relief', 'Record Relief', 'Expungement, sealing, certificates of qualification, pardons, occupational-license relief, fee waivers, legal aid.'),
  ('education_training', 'Education / Training', 'WIOA training funding, community college programs, apprenticeships, certifications, tuition assistance.'),
  ('transportation', 'Transportation', 'Transit assistance, reduced-fare programs, vehicle repair assistance, driver-license restoration support.'),
  ('childcare', 'Childcare', 'Childcare subsidy, workforce-linked and training-linked childcare assistance.'),
  ('benefits', 'Benefits', 'Public benefits, emergency/utility assistance, financial coaching and support programs.'),
  ('small_business', 'Small Business', 'Entrepreneurship grants, microloans, SBA/partner programs, local economic-development programs.'),
  ('financial_assistance', 'Financial Assistance', 'General financial assistance not covered by a more specific domain above.');

-- Re-point incentive_programs.program_domain at the new lookup table instead of its 2-value check constraint.
alter table public.incentive_programs drop constraint if exists incentive_programs_program_domain_check;
alter table public.incentive_programs add constraint incentive_programs_program_domain_fkey
  foreign key (program_domain) references public.program_domains(code);

-- Expand the benefit-type vocabulary to the normalized set Program Scout needs across all domains - still a
-- single shared vocabulary (not "$ available" flattening), reused identically by program_candidates below so a
-- candidate's extracted benefit_type never has to be translated on promotion to incentive_programs.
alter table public.incentive_programs drop constraint if exists incentive_programs_benefit_type_check;
alter table public.incentive_programs add constraint incentive_programs_benefit_type_check check (benefit_type in (
  'tax_credit', 'tax_deduction', 'wage_reimbursement', 'training_reimbursement', 'grant', 'tax_refund',
  'bond_coverage', 'job_creation_credit', 'payroll_credit',
  'direct_assistance', 'rental_subsidy', 'security_deposit_assistance', 'move_in_assistance', 'lease_up_bonus',
  'vacancy_payment', 'damage_mitigation', 'rent_loss_protection', 'training_funding', 'transportation_assistance',
  'childcare_assistance', 'fee_waiver', 'loan', 'loan_guarantee', 'legal_relief', 'other'
));

grant select on table public.program_domains to authenticated;
grant select, insert, update, delete on table public.program_domains to service_role;
alter table public.program_domains enable row level security;
create policy "program_domains_read_all" on public.program_domains for select to authenticated using (true);
