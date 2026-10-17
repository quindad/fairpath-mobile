// Output contract per workflow. Every FairPath Signal output is advisory: a draft a human edits and sends, a
// read-only summary, an explanation, or structured data a human reviews. There is no "decision" kind, so the
// gateway cannot be configured to produce one. Sensitivity mirrors SENSITIVE_WORKFLOWS and is enforced in the
// gateway, not trusted from here.
import { WORKFLOWS, SENSITIVE_WORKFLOWS, type WorkflowId } from './gateway.ts';

export const OUTPUT_KINDS = ['draft', 'read_only_summary', 'explanation', 'structured'] as const;
export type OutputKind = (typeof OUTPUT_KINDS)[number];

export type WorkflowSpec = { kind: OutputKind; sensitive: boolean };

const KIND: Record<WorkflowId, OutputKind> = {
  // Drafts a person edits and decides to send
  requisition_draft: 'draft', candidate_followup: 'draft', interview_kit: 'draft', housing_listing_writer: 'draft',
  provider_followup: 'draft', job_writer: 'draft', campaign_writer: 'draft', dispute_letter_draft: 'draft', resume_bullet_draft: 'draft', marketplace_listing_draft: 'draft',
  // Read-only summaries over records the viewer is already allowed to see
  signal_daily_brief: 'read_only_summary', staffing_daily_brief: 'read_only_summary', staffing_operations_summary: 'read_only_summary',
  housing_queue_intelligence: 'read_only_summary', housing_outcomes: 'read_only_summary', retention_intelligence: 'read_only_summary',
  workforce_report: 'read_only_summary', supervisor_brief: 'read_only_summary', executive_brief: 'read_only_summary',
  board_update: 'read_only_summary', impact_summary: 'read_only_summary', bottleneck_analysis: 'read_only_summary',
  // Explanations of existing facts, rules or evidence
  job_fit_explanation: 'explanation', housing_criteria_explainer: 'explanation', opportunity_intelligence: 'explanation',
  employer_trust_explainer: 'explanation', referral_intelligence: 'explanation', renter_preparation: 'explanation',
  candidate_preparation: 'explanation', credit_report_explanation: 'explanation', member_signal: 'explanation',
  // Schema-bound output a person reviews before anything is saved
  structured_extraction: 'structured', program_scout: 'structured', case_plan_goal_builder: 'structured',
  milestone_builder: 'structured', document_extraction: 'structured', credit_report_extraction: 'structured', document_vision: 'structured',
};

export const WORKFLOW_SPECS: Record<WorkflowId, WorkflowSpec> = Object.fromEntries(
  (Object.values(WORKFLOWS) as WorkflowId[]).map((w) => [w, { kind: KIND[w], sensitive: SENSITIVE_WORKFLOWS.has(w) }]),
) as Record<WorkflowId, WorkflowSpec>;
