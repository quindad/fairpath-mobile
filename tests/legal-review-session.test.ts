import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasAgreedLegalDocument,
  hasOpenedLegalDocument,
  markLegalDocumentAgreed,
  markLegalDocumentOpened,
  resetLegalReviewSession,
} from '../src/core/legal/legal-review-session.ts';

test('legal review flags reset and set per document', () => {
  resetLegalReviewSession();
  assert.equal(hasOpenedLegalDocument('terms'), false);
  markLegalDocumentOpened('terms');
  assert.equal(hasOpenedLegalDocument('terms'), true);
  assert.equal(hasAgreedLegalDocument('terms'), false);
  markLegalDocumentAgreed('terms');
  assert.equal(hasAgreedLegalDocument('terms'), true);
  resetLegalReviewSession();
  assert.equal(hasOpenedLegalDocument('terms'), false);
  assert.equal(hasAgreedLegalDocument('terms'), false);
});
