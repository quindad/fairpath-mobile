import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTradelines, confirmFinding, draftDispute, exportDraft, DISPUTE_DISCLAIMER, type Tradeline } from '../src/core/credit-studio/analysis.ts';

const base = (over: Partial<Tradeline>): Tradeline => ({
  id: 't', creditor: 'Acme Bank', accountRef: '1234', bureau: 'equifax', balanceUsd: 100, limitUsd: 1000,
  status: 'current', reportedDate: '2026-09-01T00:00:00Z', sourcePage: 1, ...over,
});

test('accurate negative item with no conflict is never flagged', () => {
  const f = analyzeTradelines([base({ id: 'late', status: 'late_30' })]);
  assert.deepEqual(f.filter((x) => x.kind !== 'missing_limit' && x.kind !== 'missing_balance'), []);
});

test('same account listed twice on one bureau is a possible duplicate, never verified', () => {
  const f = analyzeTradelines([base({ id: 'a' }), base({ id: 'b' })]);
  const dup = f.find((x) => x.kind === 'possible_duplicate');
  assert.ok(dup);
  assert.equal(dup!.certainty, 'possible');
});

test('different balances for one account across bureaus is a conflict to compare', () => {
  const f = analyzeTradelines([base({ id: 'e', bureau: 'equifax', balanceUsd: 100 }), base({ id: 'x', bureau: 'experian', balanceUsd: 250 })]);
  assert.ok(f.some((x) => x.kind === 'bureau_conflict' && x.certainty === 'possible'));
});

test('matching balances across bureaus produce no conflict', () => {
  const f = analyzeTradelines([base({ id: 'e', bureau: 'equifax' }), base({ id: 'x', bureau: 'experian' })]);
  assert.equal(f.some((x) => x.kind === 'bureau_conflict'), false);
});

test('missing balance and open-without-limit are reported as gaps, not errors', () => {
  const f = analyzeTradelines([base({ id: 'n', balanceUsd: null }), base({ id: 'l', limitUsd: null, accountRef: '9999' })]);
  assert.ok(f.some((x) => x.kind === 'missing_balance'));
  assert.ok(f.some((x) => x.kind === 'missing_limit'));
});

test('findings start as possible; only the member can confirm them', () => {
  const [f] = analyzeTradelines([base({ id: 'n', balanceUsd: null })]);
  assert.equal(f!.certainty, 'possible');
  assert.equal(confirmFinding(f!).certainty, 'confirmed_by_member');
});

test('dispute drafting is blocked for free and plus tiers, per the frozen spec', () => {
  const [f] = analyzeTradelines([base({ id: 'n', balanceUsd: null })]);
  const confirmed = [confirmFinding(f!)];
  assert.deepEqual(draftDispute('free', confirmed, 'Pat', 'equifax'), { status: 'blocked', reason: 'premium_required' });
  assert.deepEqual(draftDispute('plus', confirmed, 'Pat', 'equifax'), { status: 'blocked', reason: 'premium_required' });
});

test('premium drafting uses confirmed findings only and ends with the disclaimer', () => {
  const [f] = analyzeTradelines([base({ id: 'n', balanceUsd: null })]);
  const draft = draftDispute('premium', [f!], 'Pat', 'equifax');
  assert.deepEqual(draft, { status: 'blocked', reason: 'no_confirmed_findings' });
  const ready = draftDispute('premium', [confirmFinding(f!)], 'Pat', 'equifax');
  assert.equal(ready.status, 'ready');
  if (ready.status === 'ready') {
    assert.ok(ready.text.endsWith(DISPUTE_DISCLAIMER));
    assert.equal(/guarantee[sd]? (removal|deletion|increase)/i.test(ready.text), false);
  }
});

test('drafts do not include unconfirmed possible findings', () => {
  const [possible] = analyzeTradelines([base({ id: 'n', balanceUsd: null })]);
  const [other] = analyzeTradelines([base({ id: 'z', creditor: 'Other Co', balanceUsd: null })]);
  const draft = draftDispute('premium', [confirmFinding(other!), possible!], 'Pat', 'equifax');
  if (draft.status === 'ready') assert.equal(draft.text.includes('Acme Bank'), false);
});

test('a bureau with no confirmed evidence gets no draft', () => {
  const [f] = analyzeTradelines([base({ id: 'n', bureau: 'equifax', balanceUsd: null })]);
  assert.deepEqual(draftDispute('premium', [confirmFinding(f!)], 'Pat', 'transunion'), { status: 'blocked', reason: 'no_confirmed_findings' });
});

test('export: plain text ready; PDF and DOCX honestly unavailable until renderers exist', () => {
  assert.equal(exportDraft('hello', 'txt').status, 'ready');
  assert.deepEqual(exportDraft('hello', 'pdf'), { status: 'unavailable', reason: 'pdf_renderer_not_installed' });
  assert.deepEqual(exportDraft('hello', 'docx'), { status: 'unavailable', reason: 'docx_renderer_not_installed' });
});
