// Document intelligence contract. Extraction never produces verified facts. Every extracted field starts as 'proposed',
// carries a source reference and a confidence level, and becomes 'confirmed' only after member review. Sharing requires
// a consent record for that exact document and audience. The original file is preserved and never overwritten.

export type DocumentType =
  | 'court_record'
  | 'sentencing_document'
  | 'credit_report'
  | 'resume'
  | 'employment_record'
  | 'housing_document'
  | 'identification'
  | 'training_certificate'
  | 'business_document';

export type Sensitivity = 'standard' | 'sensitive' | 'highly_sensitive';

/** Sensitivity is set by document type. Credit reports and court records are highly sensitive. */
export const SENSITIVITY_BY_TYPE: Record<DocumentType, Sensitivity> = {
  court_record: 'highly_sensitive',
  sentencing_document: 'highly_sensitive',
  credit_report: 'highly_sensitive',
  identification: 'highly_sensitive',
  employment_record: 'sensitive',
  housing_document: 'sensitive',
  business_document: 'sensitive',
  resume: 'standard',
  training_certificate: 'standard',
};

export type FieldStatus = 'proposed' | 'confirmed' | 'corrected' | 'rejected';
export type Confidence = 'low' | 'medium' | 'high';

export type ExtractedField = {
  key: string;
  value: string;
  sourcePage: number;
  sourceSnippet: string; // short excerpt for review, never the whole document
  confidence: Confidence;
  status: FieldStatus;
  correctedValue: string | null;
};

export type DocumentRecord = {
  id: string;
  ownerId: string;
  type: DocumentType;
  sensitivity: Sensitivity;
  /** Original file is stored once and never overwritten. */
  originalStorageKey: string;
  pageCount: number;
  fields: ExtractedField[];
  /** True only when every proposed field has been reviewed. */
  reviewComplete: boolean;
};

export type Audience = 'member_only' | 'employer' | 'housing_provider' | 'partner_org' | 'case_manager' | 'donor';

export type ConsentGrant = { documentId: string; audience: Audience; revokedAt: string | null };

/** Donors never receive documents. Highly sensitive documents are never shared without the stronger consent flag. */
export function mayShareDocument(doc: DocumentRecord, audience: Audience, grants: readonly ConsentGrant[]): boolean {
  if (audience === 'donor') return false;
  if (audience === 'member_only') return true;
  if (!doc.reviewComplete) return false;
  const grant = grants.find((g) => g.documentId === doc.id && g.audience === audience && g.revokedAt === null);
  return grant !== undefined;
}

/** Applies a member decision to one field. Extraction output is never auto-confirmed. */
export function reviewField(field: ExtractedField, decision: { action: 'confirm' } | { action: 'correct'; value: string } | { action: 'reject' }): ExtractedField {
  if (decision.action === 'confirm') return { ...field, status: 'confirmed' };
  if (decision.action === 'correct') return { ...field, status: 'corrected', correctedValue: decision.value };
  return { ...field, status: 'rejected' };
}

export function recomputeReviewComplete(fields: readonly ExtractedField[]): boolean {
  return fields.every((f) => f.status !== 'proposed');
}

/** Confirmed or corrected value only. Proposed or rejected values never flow into workflows. */
export function usableValue(field: ExtractedField): string | null {
  if (field.status === 'confirmed') return field.value;
  if (field.status === 'corrected') return field.correctedValue;
  return null;
}
