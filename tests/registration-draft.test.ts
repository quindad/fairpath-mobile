import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agreeRegistrationDocument,
  clearRegistrationDraft,
  getRegistrationDraft,
  patchRegistrationDraft,
  registrationDraftLegalReady,
  syncRegistrationDraftFromLegalSession,
} from '../src/core/auth/registration-draft.ts';
import {
  hasAgreedLegalDocument,
  markLegalDocumentOpened,
  resetLegalReviewSession,
} from '../src/core/legal/legal-review-session.ts';

test('registration draft keeps form fields across legal navigation simulation', () => {
  clearRegistrationDraft();
  patchRegistrationDraft({
    firstName: 'Alex',
    lastName: 'Rivera',
    email: 'alex@example.com',
    password: 'secret-pass',
  });

  markLegalDocumentOpened('terms');
  agreeRegistrationDocument('terms');

  const afterTerms = getRegistrationDraft();
  assert.equal(afterTerms.firstName, 'Alex');
  assert.equal(afterTerms.lastName, 'Rivera');
  assert.equal(afterTerms.email, 'alex@example.com');
  assert.equal(afterTerms.password, 'secret-pass');
  assert.equal(afterTerms.agreedTerms, true);
  assert.equal(afterTerms.agreedPrivacy, false);

  markLegalDocumentOpened('privacy');
  agreeRegistrationDocument('privacy');

  const afterBoth = getRegistrationDraft();
  assert.equal(afterBoth.agreedTerms, true);
  assert.equal(afterBoth.agreedPrivacy, true);
  assert.equal(afterBoth.email, 'alex@example.com');
  assert.equal(registrationDraftLegalReady(afterBoth), true);
});

test('opening a legal document without agree does not check agreement boxes', () => {
  clearRegistrationDraft();
  patchRegistrationDraft({ email: 'a@b.co', agreedTerms: false, agreedPrivacy: false });
  resetLegalReviewSession();
  markLegalDocumentOpened('terms');
  syncRegistrationDraftFromLegalSession();
  const d = getRegistrationDraft();
  assert.equal(d.agreedTerms, false);
  assert.equal(hasAgreedLegalDocument('terms'), false);
  assert.equal(registrationDraftLegalReady(d), false);
});

test('clearRegistrationDraft wipes form and legal session', () => {
  patchRegistrationDraft({ firstName: 'X', password: 'pw', agreedTerms: true, agreedPrivacy: true });
  markLegalDocumentOpened('terms');
  agreeRegistrationDocument('terms');
  clearRegistrationDraft();
  const d = getRegistrationDraft();
  assert.equal(d.firstName, '');
  assert.equal(d.password, '');
  assert.equal(d.agreedTerms, false);
  assert.equal(hasAgreedLegalDocument('terms'), false);
});
