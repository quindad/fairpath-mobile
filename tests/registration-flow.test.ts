import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptTermsScreenCopy, registrationConsentContext } from '../src/core/auth/registration-flow.ts';

test('registration consent context distinguishes first acceptance from renewal', () => {
  assert.equal(registrationConsentContext(null), 'registration');
  assert.equal(registrationConsentContext({}), 'registration');
  assert.equal(registrationConsentContext({ terms_accepted_at: '2026-01-01', privacy_accepted_at: null }), 'renewal');
  assert.equal(registrationConsentContext({ terms_accepted_at: '2026-01-01', privacy_accepted_at: '2026-01-01' }), 'renewal');
});

test('accept-terms copy matches registration vs renewal', () => {
  assert.match(acceptTermsScreenCopy('registration').kicker, /FINISH REGISTRATION/);
  assert.match(acceptTermsScreenCopy('renewal').kicker, /UPDATED/);
  assert.doesNotMatch(acceptTermsScreenCopy('registration').body, /ONE LAST STEP/i);
});
