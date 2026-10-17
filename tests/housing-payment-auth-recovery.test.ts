import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { paymentAttemptKey, canReuseIntent } from '../supabase/functions/create-fasttrack-payment/payment-attempt.ts';
import { INVALID_RECOVERY_LINK, isTrustedRecoveryRedirect, parseRecoveryRedirect, recoveryCredentialKind } from '../src/core/auth/password-recovery.ts';

test('duplicate submissions and interrupted first requests keep one Stripe key', () => {
  const first = paymentAttemptKey('app-1', 7500, null);
  assert.equal(first, paymentAttemptKey('app-1', 7500, null));
});

test('declined or expired/canceled recorded attempts get a fresh Stripe key', () => {
  const first = paymentAttemptKey('app-1', 7500, null);
  const retry = paymentAttemptKey('app-1', 7500, { id: 'failed-tx-1' });
  assert.notEqual(retry, first);
  assert.equal(retry, paymentAttemptKey('app-1', 7500, { id: 'failed-tx-1' }));
});

test('abandoned checkout reuses only an unsettled intent at the current server price', () => {
  const tx = { amount_cents: 6500 };
  assert.equal(canReuseIntent(tx, 6500, 'requires_payment_method'), true);
  assert.equal(canReuseIntent(tx, 6500, 'requires_action'), true);
  assert.equal(canReuseIntent(tx, 6500, 'processing'), true);
  assert.equal(canReuseIntent(tx, 7500, 'requires_payment_method'), false);
  assert.equal(canReuseIntent(tx, 6500, 'canceled'), false);
  assert.equal(canReuseIntent(tx, 6500, 'succeeded'), false);
});

test('webhook replay is idempotent and payment cannot submit or approve an application', () => {
  const sql = readFileSync('supabase/migrations/20261009070000_housing_payment_refund_accuracy.sql', 'utf8');
  assert.match(sql, /on conflict \(provider_event_id\) do nothing/);
  assert.match(sql, /return 'duplicate'/);
  assert.doesNotMatch(sql, /update public\.housing_applications|status\s*=\s*'approved'/i);
});

test('multiple partial refunds store the individual signed-webhook refund amount', () => {
  const hook = readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8');
  const sql = readFileSync('supabase/migrations/20261009070000_housing_payment_refund_accuracy.sql', 'utf8');
  assert.match(hook, /refundAmount = latestRefund\?\.amount/);
  assert.match(sql, /p_payload ->> 'refund_amount'/);
  assert.doesNotMatch(sql, /values \(tx\.id, p_refund_id, p_amount_refunded/);
});

test('password recovery accepts PKCE and recovery-only implicit links', () => {
  assert.equal(recoveryCredentialKind(parseRecoveryRedirect('fairpathmobile://reset-password?code=pkce-code')), 'pkce');
  assert.equal(recoveryCredentialKind(parseRecoveryRedirect('fairpathmobile://reset-password#type=recovery&access_token=a&refresh_token=r')), 'implicit');
  assert.equal(recoveryCredentialKind(parseRecoveryRedirect('fairpathmobile://reset-password#type=signup&access_token=a&refresh_token=r')), 'invalid');
  assert.equal(recoveryCredentialKind(parseRecoveryRedirect('fairpathmobile://reset-password')), 'invalid');
});

test('expired and provider-error recovery links expose one generic error', () => {
  const parsed = parseRecoveryRedirect('fairpathmobile://reset-password?error=access_denied&error_description=Email+not+found');
  assert.equal(parsed.error, INVALID_RECOVERY_LINK);
  assert.equal(recoveryCredentialKind(parsed), 'invalid');
  assert.equal(parsed.error?.includes('Email not found'), false);
});

test('recovery credentials are accepted only from FairPath redirect routes', () => {
  assert.equal(isTrustedRecoveryRedirect('fairpathmobile://reset-password?code=ok'), true);
  assert.equal(isTrustedRecoveryRedirect('fairpathmobile://auth/callback?code=wrong-route'), false);
  assert.equal(isTrustedRecoveryRedirect('evilapp://reset-password?code=stolen'), false);
  assert.equal(isTrustedRecoveryRedirect('https://dev.fairpath.example/reset-password?code=ok', 'https://dev.fairpath.example'), true);
  assert.equal(isTrustedRecoveryRedirect('https://evil.example/reset-password?code=stolen', 'https://dev.fairpath.example'), false);
});

test('password reset revokes all account sessions after changing the password', () => {
  const screen = readFileSync('src/app/reset-password.tsx', 'utf8');
  assert.match(screen, /signOut\(\{\s*scope:\s*'global'\s*\}\)/);
  assert.match(screen, /isTrustedRecoveryRedirect/);
});

test('Supabase configuration never falls back to an embedded production project', () => {
  const client = readFileSync('src/lib/supabase.ts', 'utf8');
  assert.doesNotMatch(client, /PRODUCTION_URL_FALLBACK|PRODUCTION_KEY_FALLBACK/);
  assert.doesNotMatch(client, /sb_publishable_[A-Za-z0-9_-]+/);
  assert.match(client, /FairPath configuration error/);
});
