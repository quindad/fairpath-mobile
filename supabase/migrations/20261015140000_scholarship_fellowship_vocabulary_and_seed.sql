-- Extends the shared incentive_programs benefit-type vocabulary with 'scholarship' and 'fellowship' (previously
-- only 'grant'/'training_funding' existed, which flattened real scholarship programs into the wrong label), then
-- seeds a small set of REAL, live-verified national scholarship programs so "Your opportunities" (the existing
-- member-facing economic-opportunities screen at src/app/opportunities.tsx) shows them alongside the hiring/
-- housing incentive programs it already surfaces. Each source URL below was loaded and read live before this
-- migration was written (2026-10-15) - see commit message / session notes for the verification pass. No
-- fabricated program, amount, or deadline is included; anything genuinely variable is left null rather than
-- guessed.
alter table public.incentive_programs drop constraint if exists incentive_programs_benefit_type_check;
alter table public.incentive_programs add constraint incentive_programs_benefit_type_check check (benefit_type in (
  'tax_credit', 'tax_deduction', 'wage_reimbursement', 'training_reimbursement', 'grant', 'tax_refund',
  'bond_coverage', 'job_creation_credit', 'payroll_credit',
  'direct_assistance', 'rental_subsidy', 'security_deposit_assistance', 'move_in_assistance', 'lease_up_bonus',
  'vacancy_payment', 'damage_mitigation', 'rent_loss_protection', 'training_funding', 'transportation_assistance',
  'childcare_assistance', 'fee_waiver', 'loan', 'loan_guarantee', 'legal_relief', 'scholarship', 'fellowship', 'other'
));

do $$
declare
  v_program_id uuid;
begin
  -- Dell Scholars Program
  insert into public.incentive_programs (
    program_code, program_name, program_domain, benefit_type, jurisdiction_level,
    justice_specific, administering_authority, research_status, requires_member_documentation,
    last_verified_at, last_verified_by
  ) values (
    'dell_scholars_program', 'Dell Scholars Program', 'education_training', 'scholarship', 'federal',
    false, 'Michael & Susan Dell Foundation', 'verified_active', true,
    now(), 'Juice (live site read, 2026-10-15)'
  )
  on conflict (program_code) do nothing
  returning id into v_program_id;
  if v_program_id is not null then
    insert into public.incentive_program_rule_versions (
      program_id, version_number, effective_from, eligibility_requirements, benefit_formula_type,
      maximum_value, official_source_url, official_source_title, source_authority, verified_at, verified_by
    ) values (
      v_program_id, 1, current_date,
      'High school seniors with financial need, a GPA of 2.4+, and participation in a Dell-approved college-readiness program. Covers tuition, housing, and ongoing coaching through graduation.',
      'agency_determined', null,
      'https://www.dellscholars.org/', 'Dell Scholars Program', 'Michael & Susan Dell Foundation',
      now(), 'Juice (live site read, 2026-10-15)'
    );
  end if;

  -- Jack Kent Cooke Foundation (College Scholarship / Undergraduate Transfer / Young Scholars)
  insert into public.incentive_programs (
    program_code, program_name, program_domain, benefit_type, jurisdiction_level,
    justice_specific, administering_authority, research_status, requires_member_documentation,
    last_verified_at, last_verified_by
  ) values (
    'jack_kent_cooke_scholarships', 'Jack Kent Cooke Foundation Scholarships', 'education_training', 'scholarship', 'federal',
    false, 'Jack Kent Cooke Foundation', 'verified_active', true,
    now(), 'Juice (live site read, 2026-10-15)'
  )
  on conflict (program_code) do nothing
  returning id into v_program_id;
  if v_program_id is not null then
    insert into public.incentive_program_rule_versions (
      program_id, version_number, effective_from, eligibility_requirements, benefit_formula_type,
      maximum_value, official_source_url, official_source_title, source_authority, verified_at, verified_by
    ) values (
      v_program_id, 1, current_date,
      'High-achieving students with significant financial need. Three tracks: Young Scholars (middle/high school), College Scholarship (high school seniors), and Undergraduate Transfer Scholarship (top community college students transferring to a four-year school).',
      'agency_determined', null,
      'https://www.jkcf.org/', 'Jack Kent Cooke Foundation', 'Jack Kent Cooke Foundation',
      now(), 'Juice (live site read, 2026-10-15)'
    );
  end if;

  -- Imagine America Foundation (trade/career college scholarships)
  insert into public.incentive_programs (
    program_code, program_name, program_domain, benefit_type, jurisdiction_level,
    justice_specific, administering_authority, research_status, requires_member_documentation,
    last_verified_at, last_verified_by
  ) values (
    'imagine_america_scholarships', 'Imagine America Foundation Scholarships', 'education_training', 'scholarship', 'federal',
    false, 'Imagine America Foundation', 'verified_active', true,
    now(), 'Juice (live site read, 2026-10-15)'
  )
  on conflict (program_code) do nothing
  returning id into v_program_id;
  if v_program_id is not null then
    insert into public.incentive_program_rule_versions (
      program_id, version_number, effective_from, eligibility_requirements, benefit_formula_type,
      maximum_value, official_source_url, official_source_title, source_authority, verified_at, verified_by
    ) values (
      v_program_id, 1, current_date,
      'For students pursuing career-focused training at a trade school or career college (mechanical, health sciences, IT, business, and more) rather than a traditional four-year degree.',
      'agency_determined', null,
      'https://www.imagine-america.org/', 'Imagine America Foundation', 'Imagine America Foundation',
      now(), 'Juice (live site read, 2026-10-15)'
    );
  end if;

  -- Horatio Alger Association Scholarships (undergraduate + career & technical, explicitly includes non-traditional students)
  insert into public.incentive_programs (
    program_code, program_name, program_domain, benefit_type, jurisdiction_level,
    justice_specific, administering_authority, research_status, requires_member_documentation,
    last_verified_at, last_verified_by
  ) values (
    'horatio_alger_scholarships', 'Horatio Alger Association Scholarships', 'education_training', 'scholarship', 'federal',
    false, 'Horatio Alger Association of Distinguished Americans', 'verified_active', true,
    now(), 'Juice (live site read, 2026-10-15)'
  )
  on conflict (program_code) do nothing
  returning id into v_program_id;
  if v_program_id is not null then
    insert into public.incentive_program_rule_versions (
      program_id, version_number, effective_from, eligibility_requirements, benefit_formula_type,
      maximum_value, official_source_url, official_source_title, source_authority, verified_at, verified_by
    ) values (
      v_program_id, 1, current_date,
      'For students with critical financial need who have overcome significant adversity. Includes a dedicated Career & Technical Scholarship track open to non-traditional students pursuing an associate degree or certificate, not just high school seniors headed to a four-year college.',
      'agency_determined', null,
      'https://horatioalger.org/scholarships/', 'Horatio Alger Association', 'Horatio Alger Association of Distinguished Americans',
      now(), 'Juice (live site read, 2026-10-15)'
    );
  end if;
end $$;

-- Populate opportunity_matches for every current member against each newly-seeded verified_active program,
-- the same way program_scout_promote_candidate() does on activation - these are federal/national programs so
-- every member with a current home address matches regardless of state.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.incentive_programs
    where program_code in ('dell_scholars_program','jack_kent_cooke_scholarships','imagine_america_scholarships','horatio_alger_scholarships')
  loop
    perform public.program_scout_rematch_program(v_id);
  end loop;
end $$;
