// Registry of every document FairPath can generate: sensitivity, formats, retention and who it may be prepared for.
// Adding a document type = add it here + a builder. Pure module (no runtime imports).
import type { DocAudience, DocFormat, DocKind, DocSensitivity } from './spec.ts';

export type DocumentTypeInfo = {
  type: string;
  module: 'resources' | 'profile' | 'credit' | 'record_relief' | 'housing' | 'jobs';
  label: string;
  description: string;
  sensitivity: DocSensitivity;
  kind: DocKind;
  formats: DocFormat[];
  allowedAudiences: DocAudience[];
  templateId: string;
  templateVersion: string;
  /** Sensitive types are metadata-only history until the member keeps a copy. */
  defaultPersist: 'on_demand' | 'history_only';
  /** Which retention choices (days) the member may pick when keeping a copy. */
  retentionChoices: number[];
};

const STD_RETENTION = [30, 90, 365];
const SENSITIVE_RETENTION = [30, 90];

export const DOCUMENT_TYPES: Record<string, DocumentTypeInfo> = {
  saved_resources_list: {
    type: 'saved_resources_list', module: 'resources', label: 'Saved resources list',
    description: 'Every resource you saved, with how to reach it.',
    sensitivity: 'standard', kind: 'summary', formats: ['pdf', 'csv'], allowedAudiences: ['self', 'caseworker'],
    templateId: 'saved_resources_list', templateVersion: '1', defaultPersist: 'history_only', retentionChoices: STD_RETENTION,
  },
  resource_contact_sheet: {
    type: 'resource_contact_sheet', module: 'resources', label: 'Resource contact sheet',
    description: 'Phone numbers, addresses, hours and websites in one printable page.',
    sensitivity: 'standard', kind: 'summary', formats: ['pdf', 'docx'], allowedAudiences: ['self', 'caseworker'],
    templateId: 'resource_contact_sheet', templateVersion: '1', defaultPersist: 'history_only', retentionChoices: STD_RETENTION,
  },
  resource_required_documents: {
    type: 'resource_required_documents', module: 'resources', label: 'What to bring checklist',
    description: 'The documents your saved resources ask you to bring, combined into one checklist.',
    sensitivity: 'standard', kind: 'checklist', formats: ['pdf', 'docx'], allowedAudiences: ['self', 'caseworker'],
    templateId: 'resource_required_documents', templateVersion: '1', defaultPersist: 'history_only', retentionChoices: STD_RETENTION,
  },
  opportunity_profile: {
    type: 'opportunity_profile', module: 'profile', label: 'Opportunity Profile',
    description: 'Your work history, education, skills and availability. You choose what is included.',
    sensitivity: 'standard', kind: 'summary', formats: ['pdf', 'docx'], allowedAudiences: ['self', 'employer', 'caseworker'],
    templateId: 'opportunity_profile', templateVersion: '1', defaultPersist: 'history_only', retentionChoices: STD_RETENTION,
  },
  credit_review_summary: {
    type: 'credit_review_summary', module: 'credit', label: 'Credit review summary',
    description: 'The accounts and items you reviewed, and what you confirmed.',
    sensitivity: 'highly_sensitive', kind: 'summary', formats: ['pdf'], allowedAudiences: ['self'],
    templateId: 'credit_review_summary', templateVersion: '1', defaultPersist: 'on_demand', retentionChoices: SENSITIVE_RETENTION,
  },
  credit_dispute_letter: {
    type: 'credit_dispute_letter', module: 'credit', label: 'Dispute letter',
    description: 'A letter built from the issues you confirmed. You review and edit it before export.',
    sensitivity: 'highly_sensitive', kind: 'letter', formats: ['pdf', 'docx'], allowedAudiences: ['self'],
    templateId: 'credit_dispute_letter', templateVersion: '1', defaultPersist: 'on_demand', retentionChoices: SENSITIVE_RETENTION,
  },
  credit_evidence_checklist: {
    type: 'credit_evidence_checklist', module: 'credit', label: 'Supporting-document checklist',
    description: 'What to include with a dispute, plus the documents you added.',
    sensitivity: 'highly_sensitive', kind: 'checklist', formats: ['pdf', 'docx'], allowedAudiences: ['self'],
    templateId: 'credit_evidence_checklist', templateVersion: '1', defaultPersist: 'on_demand', retentionChoices: SENSITIVE_RETENTION,
  },
  credit_mailing_instructions: {
    type: 'credit_mailing_instructions', module: 'credit', label: 'Mailing instructions',
    description: 'General steps for sending a dispute and keeping a paper trail.',
    sensitivity: 'highly_sensitive', kind: 'worksheet', formats: ['pdf'], allowedAudiences: ['self'],
    templateId: 'credit_mailing_instructions', templateVersion: '1', defaultPersist: 'on_demand', retentionChoices: SENSITIVE_RETENTION,
  },
  credit_identity_correction_letter: {
    type: 'credit_identity_correction_letter', module: 'credit', label: 'Personal information correction letter',
    description: 'A letter asking a bureau to correct your name, address, or other personal information on file.',
    sensitivity: 'highly_sensitive', kind: 'letter', formats: ['pdf', 'docx'], allowedAudiences: ['self'],
    templateId: 'credit_identity_correction_letter', templateVersion: '1', defaultPersist: 'on_demand', retentionChoices: SENSITIVE_RETENTION,
  },
  credit_dispute_history: {
    type: 'credit_dispute_history', module: 'credit', label: 'Dispute history',
    description: 'Your disputes, dates and outcomes.',
    sensitivity: 'highly_sensitive', kind: 'summary', formats: ['pdf', 'csv'], allowedAudiences: ['self'],
    templateId: 'credit_dispute_history', templateVersion: '1', defaultPersist: 'on_demand', retentionChoices: SENSITIVE_RETENTION,
  },
  record_relief_case_summary: {
    type: 'record_relief_case_summary', module: 'record_relief', label: 'Record relief case summary',
    description: 'Your case information, the rule used, and your countdown. This is information, not legal advice.',
    sensitivity: 'highly_sensitive', kind: 'summary', formats: ['pdf'], allowedAudiences: ['self'],
    templateId: 'record_relief_case_summary', templateVersion: '1', defaultPersist: 'on_demand', retentionChoices: SENSITIVE_RETENTION,
  },
  record_relief_filing_checklist: {
    type: 'record_relief_filing_checklist', module: 'record_relief', label: 'Filing checklist',
    description: 'Steps, documents and fees for your case, from the verified rule.',
    sensitivity: 'highly_sensitive', kind: 'checklist', formats: ['pdf', 'docx'], allowedAudiences: ['self'],
    templateId: 'record_relief_filing_checklist', templateVersion: '1', defaultPersist: 'on_demand', retentionChoices: SENSITIVE_RETENTION,
  },
  record_relief_forms_guide: {
    type: 'record_relief_forms_guide', module: 'record_relief', label: 'Forms and filing guide',
    description: 'The verified official forms for your jurisdiction, where to get them, and how they relate to your case.',
    sensitivity: 'highly_sensitive', kind: 'checklist', formats: ['pdf'], allowedAudiences: ['self'],
    templateId: 'record_relief_forms_guide', templateVersion: '1', defaultPersist: 'on_demand', retentionChoices: SENSITIVE_RETENTION,
  },
  record_relief_worksheet: {
    type: 'record_relief_worksheet', module: 'record_relief', label: 'Prepared-information worksheet',
    description: 'Your confirmed case details organized to help you complete the official form. Not an official form.',
    sensitivity: 'highly_sensitive', kind: 'worksheet', formats: ['pdf', 'docx'], allowedAudiences: ['self'],
    templateId: 'record_relief_worksheet', templateVersion: '1', defaultPersist: 'on_demand', retentionChoices: SENSITIVE_RETENTION,
  },
};

export function documentTypeInfo(type: string): DocumentTypeInfo | null {
  return DOCUMENT_TYPES[type] ?? null;
}

/** Landlord/employer exports may never be produced for justice-related module types. */
export function audienceAllowed(type: string, audience: DocAudience): boolean {
  const info = documentTypeInfo(type);
  if (!info) return false;
  if ((audience === 'landlord' || audience === 'employer') && (info.module === 'credit' || info.module === 'record_relief')) return false;
  return info.allowedAudiences.includes(audience);
}
