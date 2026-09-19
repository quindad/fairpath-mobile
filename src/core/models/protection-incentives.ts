export type USStateCode =
 'AL'|'AK'|'AZ'|'AR'|'CA'|'CO'|'CT'|'DE'|'FL'|'GA'|'HI'|'ID'|'IL'|'IN'|'IA'|'KS'|'KY'|'LA'|'ME'|'MD'|'MA'|'MI'|'MN'|'MS'|'MO'|'MT'|'NE'|'NV'|'NH'|'NJ'|'NM'|'NY'|'NC'|'ND'|'OH'|'OK'|'OR'|'PA'|'RI'|'SC'|'SD'|'TN'|'TX'|'UT'|'VT'|'VA'|'WA'|'WV'|'WI'|'WY'|'DC';

export type ProgramStatus='active'|'paused'|'lapsed'|'closed'|'pending_verification';
export type EligibilityStatus='potential_match'|'likely_eligible_verify'|'needs_review'|'application_required'|'unavailable'|'program_paused_lapsed'|'not_eligible';
export type VerificationLevel='unverified'|'self_reported'|'document_verified'|'partner_verified'|'agency_confirmed';
export type ProgramCategory=
 'federal_hiring_incentive'|'federal_bonding'|'workforce_reimbursement'|'wioa_ojt'|'apprenticeship'|'state_tax_credit'|'state_training_subsidy'|'local_workforce_grant'|'housing_landlord_incentive'|'deposit_assistance'|'damage_mitigation'|'voucher_landlord_incentive'|'reentry_grant';

export type IncentiveProgram={
 id:string;
 name:string;
 category:ProgramCategory;
 jurisdiction_level:'federal'|'state'|'county'|'city';
 state_code?:USStateCode;
 administering_agency:string;
 official_source_url:string;
 authority_type:'statute'|'regulation'|'agency_program'|'grant';
 status:ProgramStatus;
 effective_start?:string;
 effective_end?:string;
 application_window?:string;
 employer_rules?:Record<string,unknown>;
 participant_rules?:Record<string,unknown>;
 benefit_type?:'tax_credit'|'reimbursement'|'bonding'|'grant'|'subsidy'|'other';
 benefit_formula?:string;
 maximum_benefit?:number;
 reimbursement_percentage?:number;
 duration_text?:string;
 stacking_restrictions?:string[];
 preapproval_required?:boolean;
 deadline_text?:string;
 required_forms?:string[];
 required_documents?:string[];
 submitter?:'employer'|'participant'|'fairpath_assisted'|'provider'|'other';
 automation_level:'automatic'|'assisted'|'manual_review';
 last_verified_at:string;
 next_review_at?:string;
 legal_notes?:string;
};

export type IncentiveEvaluation={
 id:string;
 program_id:string;
 subject_id:string;
 subject_type:'person'|'hire'|'lease'|'employer'|'property';
 status:EligibilityStatus;
 matched_rules:string[];
 failed_rules:string[];
 missing_inputs:string[];
 potential_benefit?:number;
 calculation_explanation?:string;
 required_actions:string[];
 application_deadline?:string;
 verification_level:VerificationLevel;
 evaluated_at:string;
 rules_version:string;
};

export type ProtectionProgramKind='employment'|'housing';

export type ProtectionTier={
 id:string;
 program_kind:ProtectionProgramKind;
 name:string;
 limit_amount:number;
 active:boolean;
 requires_manual_review?:boolean;
};

export type ProtectionEvaluation={
 id:string;
 program_kind:ProtectionProgramKind;
 subject_id:string;
 subject_type:'hire'|'lease';
 status:'not_started'|'ineligible'|'potentially_eligible'|'needs_review'|'approved'|'declined'|'activated'|'expired';
 tier_id?:string;
 approved_limit?:number;
 missing_inputs:string[];
 matched_rules:string[];
 failed_rules:string[];
 verification_level:VerificationLevel;
 evaluated_at:string;
 rules_version:string;
};

export type ProtectionClaimStatus='draft'|'submitted'|'needs_documents'|'under_review'|'referred_to_carrier'|'approved'|'partially_approved'|'denied'|'paid'|'closed';

export type ProtectionClaim={
 id:string;
 protection_record_id:string;
 program_kind:ProtectionProgramKind;
 event_date:string;
 requested_amount:number;
 status:ProtectionClaimStatus;
 carrier_reference?:string;
 internal_notes?:string;
 fraud_flags?:string[];
 created_at:string;
 updated_at:string;
};

export const FAIRPATH_PROTECTION_CONCEPT_TIERS:ProtectionTier[]=[
 {id:'employment-5',program_kind:'employment',name:'FP Employment 5',limit_amount:5000,active:false},
 {id:'employment-10',program_kind:'employment',name:'FP Employment 10',limit_amount:10000,active:false},
 {id:'employment-20',program_kind:'employment',name:'FP Employment 20',limit_amount:20000,active:false},
 {id:'housing-5',program_kind:'housing',name:'FP Housing 5',limit_amount:5000,active:false},
 {id:'housing-10',program_kind:'housing',name:'FP Housing 10',limit_amount:10000,active:false},
 {id:'housing-20',program_kind:'housing',name:'FP Housing 20',limit_amount:20000,active:false},
];
