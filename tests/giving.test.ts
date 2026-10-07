import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verify, publish, canTransition, markFulfilled, remainingUsd, type AssistanceNeed } from '../src/core/giving/needs.ts';
import { createPendingDonation, confirmDonation } from '../src/core/giving/donations.ts';
import { publicNeedView, impactSummary } from '../src/core/giving/privacy-and-impact.ts';

const NOW = '2026-10-07T12:00:00Z';
const NEED: AssistanceNeed = {
  id: 'n1', memberId: 'member-1', category: 'meal', amountUsd: 20, fundedUsd: 0, status: 'requested',
  verifiedBy: null, verifiedAt: null, fulfilledAt: null, privateCircumstances: 'SENSITIVE: do not show',
};

test('a request cannot be published without verification', () => {
  assert.equal(publish(NEED), null);
  assert.equal(canTransition('requested', 'published'), false);
});

test('verification requires a named verifier and then allows publishing', () => {
  assert.equal(verify(NEED, '  ', NOW), null);
  const v = verify(NEED, 'partner-7', NOW)!;
  assert.equal(v.status, 'verified');
  assert.equal(publish(v)!.status, 'published');
});

test('donations need a published need, a minimum amount, and not exceed what remains', () => {
  const published = publish(verify(NEED, 'partner-7', NOW)!)!;
  assert.deepEqual(createPendingDonation(NEED, 'd', 5, 'x', NOW), { ok: false, reason: 'need_not_published' });
  assert.deepEqual(createPendingDonation(published, 'd', 0.5, 'x', NOW), { ok: false, reason: 'amount_too_small' });
  assert.deepEqual(createPendingDonation(published, 'd', 25, 'x', NOW), { ok: false, reason: 'exceeds_remaining' });
});

test('members cannot fund their own need', () => {
  const published = publish(verify(NEED, 'partner-7', NOW)!)!;
  assert.deepEqual(createPendingDonation(published, 'member-1', 5, 'x', NOW), { ok: false, reason: 'self_donation' });
});

test('new donations are pending payment, and only a confirmation applies the amount once', () => {
  const published = publish(verify(NEED, 'partner-7', NOW)!)!;
  const d = createPendingDonation(published, 'donor-2', 12, 'don1', NOW);
  assert.equal(d.ok, true);
  if (!d.ok) return;
  assert.equal(d.donation.status, 'pending_payment');
  assert.equal(published.fundedUsd, 0);
  const c = confirmDonation(d.donation, published, NOW)!;
  assert.equal(c.need.fundedUsd, 12);
  assert.equal(confirmDonation(c.donation, c.need, NOW), null, 'confirmation is not repeatable');
});

test('fully funding a need moves it to funded and then fulfillment needs verified delivery', () => {
  const published = publish(verify(NEED, 'partner-7', NOW)!)!;
  const d = createPendingDonation(published, 'donor-2', 20, 'don2', NOW);
  if (!d.ok) assert.fail('setup failed');
  const c = confirmDonation(d.donation, published, NOW)!;
  assert.equal(c.need.status, 'funded');
  assert.equal(remainingUsd(c.need), 0);
  assert.equal(markFulfilled(c.need, NOW)!.status, 'fulfilled');
});

test('public view never includes the member, circumstances or verifier', () => {
  const published = publish(verify(NEED, 'partner-7', NOW)!)!;
  const view = publicNeedView(published)!;
  assert.deepEqual(Object.keys(view).sort(), ['amountUsd', 'category', 'fundedUsd', 'id', 'status']);
  assert.equal(JSON.stringify(view).includes('member-1'), false);
  assert.equal(JSON.stringify(view).includes('SENSITIVE'), false);
  assert.equal(JSON.stringify(view).includes('partner-7'), false);
});

test('unpublished needs have no public view at all', () => {
  assert.equal(publicNeedView(NEED), null);
  assert.equal(publicNeedView(verify(NEED, 'partner-7', NOW)!), null);
});

test('impact counts only verified, fulfilled needs; member-reported items stay separate', () => {
  const fulfilled: AssistanceNeed = { ...NEED, status: 'fulfilled', verifiedBy: 'partner-7', verifiedAt: NOW, fulfilledAt: NOW, fundedUsd: 20 };
  const unverifiedFulfilled: AssistanceNeed = { ...NEED, id: 'n2', status: 'fulfilled', verifiedBy: null, fulfilledAt: NOW, fundedUsd: 99 };
  const s = impactSummary([fulfilled, unverifiedFulfilled], [{ id: 'self-1' }]);
  assert.deepEqual(s, { verifiedFulfilledNeeds: 1, verifiedFundedUsd: 20, memberReportedNeeds: 1 });
});

test('impact never counts requested, published or funded-but-unfulfilled needs', () => {
  const funded: AssistanceNeed = { ...NEED, status: 'funded', verifiedBy: 'p', verifiedAt: NOW, fundedUsd: 20 };
  assert.equal(impactSummary([funded], []).verifiedFulfilledNeeds, 0);
});
