import { supabase } from '@/lib/supabase';

// Mirrors the same jurisdiction-match pattern used on Partner's Job detail Economic Opportunities section
// (quindad-fairpath-partner src/app/jobs/[id]/page.tsx) - a verified_active program whose jurisdiction covers
// the member's current home state. This is a JURISDICTION MATCH, not an eligibility determination: FairPath
// has not evaluated the member's actual facts (wage, hours, household, conviction timeline, etc.) against any
// program's real rules yet. Every result must be labeled accordingly - never "you qualify," always "potential
// match." incentive_programs RLS already restricts reads to research_status='verified_active' rows only, so an
// expired/proposed/needs_verification program can never reach this query's results.

export type EconomicOpportunity = {
 id:string; program_name:string; program_domain:string; benefit_type:string;
 jurisdiction_level:string; jurisdiction_state:string|null; justice_specific:boolean;
 requires_employer_application:boolean; requires_government_certification:boolean; requires_member_documentation:boolean;
 max_value:number|null; min_value:number|null; source_url:string|null; source_title:string|null;
};

export type OpportunityDomainCount = { domain:string; label:string; count:number };

/** The member's current home state, if one is on file - used only as a jurisdiction-match input, nothing else. */
async function currentHomeState():Promise<string|null>{
 const { data: { user } } = await supabase.auth.getUser();
 if(!user) throw new Error('SIGNED_OUT');
 const { data, error } = await supabase.from('addresses').select('state').eq('user_id',user.id).eq('label','home').eq('is_current',true).maybeSingle();
 if(error) throw error;
 return data?.state ?? null;
}

export async function loadMyEconomicOpportunities():Promise<{ opportunities:EconomicOpportunity[]; homeState:string|null }>{
 const homeState = await currentHomeState();
 const filter = homeState ? `jurisdiction_level.eq.federal,jurisdiction_state.eq.${homeState}` : 'jurisdiction_level.eq.federal';
 const { data: programs, error } = await supabase
  .from('incentive_programs')
  .select('id,program_name,program_domain,benefit_type,jurisdiction_level,jurisdiction_state,justice_specific,requires_employer_application,requires_government_certification,requires_member_documentation')
  .or(filter);
 if(error) throw error;
 const ids = (programs??[]).map(p=>p.id);
 const { data: rules, error: ruleErr } = ids.length
  ? await supabase.from('incentive_program_rule_versions').select('program_id,maximum_value,minimum_value,official_source_url,official_source_title').in('program_id',ids).order('version_number',{ascending:false})
  : { data:[] as { program_id:string; maximum_value:number|null; minimum_value:number|null; official_source_url:string; official_source_title:string|null }[], error:null };
 if(ruleErr) throw ruleErr;
 const ruleByProgram = new Map<string,{maximum_value:number|null;minimum_value:number|null;official_source_url:string;official_source_title:string|null}>();
 for(const r of rules??[]) if(!ruleByProgram.has(r.program_id)) ruleByProgram.set(r.program_id,r);
 const opportunities:EconomicOpportunity[] = (programs??[]).map(p=>{
  const rule = ruleByProgram.get(p.id);
  return {
   id:p.id, program_name:p.program_name, program_domain:p.program_domain, benefit_type:p.benefit_type,
   jurisdiction_level:p.jurisdiction_level, jurisdiction_state:p.jurisdiction_state, justice_specific:p.justice_specific,
   requires_employer_application:p.requires_employer_application, requires_government_certification:p.requires_government_certification,
   requires_member_documentation:p.requires_member_documentation,
   max_value:rule?.maximum_value??null, min_value:rule?.minimum_value??null,
   source_url:rule?.official_source_url??null, source_title:rule?.official_source_title??null,
  };
 });
 return { opportunities, homeState };
}

export const DOMAIN_LABELS:Record<string,string> = {
 employment:'Employment', housing:'Housing', record_relief:'Record Relief', education_training:'Training',
 transportation:'Transportation', childcare:'Childcare', benefits:'Benefits', small_business:'Small Business',
 financial_assistance:'Financial Assistance',
};

export const BENEFIT_TYPE_LABELS:Record<string,string> = {
 tax_credit:'Tax credit', tax_deduction:'Tax deduction', wage_reimbursement:'Wage reimbursement',
 training_reimbursement:'Training reimbursement', grant:'Grant', tax_refund:'Tax refund', bond_coverage:'Bond coverage',
 job_creation_credit:'Job-creation credit', payroll_credit:'Payroll credit', direct_assistance:'Direct assistance',
 rental_subsidy:'Rental subsidy', security_deposit_assistance:'Security deposit assistance', move_in_assistance:'Move-in assistance',
 lease_up_bonus:'Lease-up bonus', vacancy_payment:'Vacancy payment', damage_mitigation:'Damage mitigation',
 rent_loss_protection:'Rent-loss protection', training_funding:'Training funding', transportation_assistance:'Transportation assistance',
 childcare_assistance:'Childcare assistance', fee_waiver:'Fee waiver', loan:'Loan', loan_guarantee:'Loan guarantee',
 legal_relief:'Legal relief', other:'Other',
};

export function groupByDomain(opportunities:EconomicOpportunity[]):OpportunityDomainCount[]{
 const counts = new Map<string,number>();
 for(const o of opportunities) counts.set(o.program_domain,(counts.get(o.program_domain)??0)+1);
 return Array.from(counts.entries()).map(([domain,count])=>({domain,label:DOMAIN_LABELS[domain]??domain,count}));
}
