// DEVELOPMENT FIXTURE: sample extracted fields for exercising the review screen. Not read from any real document.
import type { ExtractedField } from './extraction-contract.ts';

export const DEV_REVIEW_FIELDS: ExtractedField[] = [
  { key: 'case_number', value: 'FIXTURE-0001', sourcePage: 1, sourceSnippet: 'Case No. FIXTURE-0001', confidence: 'high', status: 'proposed', correctedValue: null },
  { key: 'offense_description', value: 'Sample offense (fixture)', sourcePage: 1, sourceSnippet: 'Offense: sample', confidence: 'medium', status: 'proposed', correctedValue: null },
  { key: 'disposition_date', value: '2020-01-01', sourcePage: 2, sourceSnippet: 'Disposition date 01/01/2020', confidence: 'low', status: 'proposed', correctedValue: null },
];
