import { supabase } from '@/lib/supabase';

// Reads the member's PERSISTED opportunity_matches - the canonical, Program-Scout-populated table - rather than
// live-querying incentive_programs at render time. Matches are created/refreshed by
// program_scout_rematch_program() (run inside program_scout_promote_candidate on activation) and by the
// addresses_rematch_on_current_home_change trigger (fires the moment a member's current home address changes,
// so a new match can appear without the member re-opening the app and re-triggering a search). This is still a
// JURISDICTION MATCH, not an eligibility determination - match_status starts at 'potential_match' and nothing
// here evaluates the member's actual facts (wage, hours, household, conviction timeline) against a program's
// real rules. opportunity_matches RLS already restricts reads to the member's own rows.

export type EconomicOpportunity = {
 matchId:string; programId:string; program_name:string; program_domain:string; benefit_type:string;
 jurisdiction_level:string; jurisdiction_state:string|null;
 matchStatus:string; missingInformation:string[]; assessedAt:string;
 max_value:number|null; min_value:number|null; source_url:string|null; source_title:string|null;
};

export type OpportunityDomainCount = { domain:string; label:string; count:number };

async function currentHomeState():Promise<string|null>{
 const { data: { user } } = await supabase.auth.getUser();
 if(!user) throw new Error('SIGNED_OUT');
 const { data, error } = await supabase.from('addresses').select('state').eq('user_id',user.id).eq('label','home').eq('is_current',true).maybeSingle();
 if(error) throw error;
 return data?.state ?? null;
}

export async function loadMyEconomicOpportunities():Promise<{ opportunities:EconomicOpportunity[]; homeState:string|null }>{
 const { data: { user } } = await supabase.auth.getUser();
 if(!user) throw new Error('SIGNED_OUT');
 const homeState = await currentHomeState();

 const { data: matches, error } = await supabase
  .from('opportunity_matches')
  .select('id,program_id,match_status,missing_information,assessed_at')
  .eq('member_id',user.id).eq('context_type','member')
  .neq('match_status','unavailable').neq('match_status','expired').neq('match_status','not_eligible');
 if(error) throw error;
 const programIds = (matches??[]).map(m=>m.program_id);
 if(!programIds.length) return { opportunities:[], homeState };

 const { data: programs, error: progErr } = await supabase
  .from('incentive_programs')
  .select('id,program_name,program_domain,benefit_type,jurisdiction_level,jurisdiction_state')
  .in('id',programIds);
 if(progErr) throw progErr;
 const { data: rules, error: ruleErr } = await supabase
  .from('incentive_program_rule_versions').select('program_id,maximum_value,minimum_value,official_source_url,official_source_title')
  .in('program_id',programIds).order('version_number',{ascending:false});
 if(ruleErr) throw ruleErr;
 const programById = new Map((programs??[]).map(p=>[p.id,p]));
 const ruleByProgram = new Map<string,{maximum_value:number|null;minimum_value:number|null;official_source_url:string;official_source_title:string|null}>();
 for(const r of rules??[]) if(!ruleByProgram.has(r.program_id)) ruleByProgram.set(r.program_id,r);

 const opportunities:EconomicOpportunity[] = (matches??[]).flatMap(m=>{
  const p = programById.get(m.program_id);
  if(!p) return [];
  const rule = ruleByProgram.get(p.id);
  return [{
   matchId:m.id, programId:p.id, program_name:p.program_name, program_domain:p.program_domain, benefit_type:p.benefit_type,
   jurisdiction_level:p.jurisdiction_level, jurisdiction_state:p.jurisdiction_state,
   matchStatus:m.match_status, missingInformation:m.missing_information??[], assessedAt:m.assessed_at,
   max_value:rule?.maximum_value??null, min_value:rule?.minimum_value??null,
   source_url:rule?.official_source_url??null, source_title:rule?.official_source_title??null,
  }];
 });
 return { opportunities, homeState };
}

export const MATCH_STATUS_LABELS:Record<string,string> = {
 potential_match:'Potential match', likely_match:'Likely match', needs_information:'Needs information',
 verified_eligible:'Verified eligible', application_started:'Application started', submitted:'Submitted',
 approved:'Approved', received_realized:'Received', expired:'Expired', unavailable:'Unavailable', not_eligible:'Not eligible',
};

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
