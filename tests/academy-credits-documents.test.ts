import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCost, presentable, isGenuinelyFree, LOW_COST_THRESHOLD_USD } from '../src/core/academy/catalog-contract.ts';
import { mayFetch, nextAllowedFetchMs, type ProviderTerms } from '../src/core/academy/provider-adapters.ts';
import { searchCourses } from '../src/core/academy/catalog-search.ts';
import { DEV_FIXTURE_COURSES } from '../src/core/academy/fixtures.ts';
import { debit, balanceAt, resetMonthly, purchasedExpiry, type Ledger } from '../src/core/credits/ledger.ts';
import {
  mayShareDocument, reviewField, recomputeReviewComplete, usableValue, SENSITIVITY_BY_TYPE,
  type DocumentRecord, type ExtractedField, type ConsentGrant,
} from '../src/core/documents/extraction-contract.ts';

const NOW = '2026-10-06T12:00:00Z';

// ---- Academy: cost classification never labels unknown or paid-certificate courses as free ----

test('unknown price is never classified free', () => {
  assert.equal(classifyCost({ priceUsd: null, certificatePriceUsd: null, freeAuditAvailable: false, sponsored: false }), 'unknown');
});

test('zero price with no certificate fee is free', () => {
  assert.equal(classifyCost({ priceUsd: 0, certificatePriceUsd: null, freeAuditAvailable: false, sponsored: false }), 'free');
});

test('zero price with a paid certificate is free_with_paid_certificate, not free', () => {
  assert.equal(classifyCost({ priceUsd: 0, certificatePriceUsd: 49, freeAuditAvailable: false, sponsored: false }), 'free_with_paid_certificate');
});

test('paid course with free audit is free_with_paid_certificate', () => {
  assert.equal(classifyCost({ priceUsd: 99, certificatePriceUsd: null, freeAuditAvailable: true, sponsored: false }), 'free_with_paid_certificate');
});

test('low-cost threshold boundary', () => {
  assert.equal(classifyCost({ priceUsd: LOW_COST_THRESHOLD_USD, certificatePriceUsd: null, freeAuditAvailable: false, sponsored: false }), 'low_cost');
  assert.equal(classifyCost({ priceUsd: LOW_COST_THRESHOLD_USD + 1, certificatePriceUsd: null, freeAuditAvailable: false, sponsored: false }), 'paid');
});

test('sponsored seat classifies as sponsored regardless of list price', () => {
  assert.equal(classifyCost({ priceUsd: 1200, certificatePriceUsd: null, freeAuditAvailable: false, sponsored: true }), 'sponsored');
});

test('only classification free counts as genuinely free', () => {
  const free = DEV_FIXTURE_COURSES.find((c) => c.id === 'fx-digital-1')!;
  const paidCert = DEV_FIXTURE_COURSES.find((c) => c.id === 'fx-tech-1')!;
  assert.equal(isGenuinelyFree(free), true);
  assert.equal(isGenuinelyFree(paidCert), false);
});

test('stale, withdrawn and never-verified courses are not presentable', () => {
  const stale = DEV_FIXTURE_COURSES.find((c) => c.id === 'fx-stale-1')!;
  const unverified = DEV_FIXTURE_COURSES.find((c) => c.id === 'fx-unver-1')!;
  assert.equal(presentable(stale), false);
  assert.equal(presentable(unverified), false);
});

// ---- Academy search: presentable only, filters and sorting ----

test('search never returns stale or unverified fixtures', () => {
  const ids = searchCourses(DEV_FIXTURE_COURSES, {}).map((c) => c.id);
  assert.equal(ids.includes('fx-stale-1'), false);
  assert.equal(ids.includes('fx-unver-1'), false);
});

test('free-only filter excludes paid-certificate and paid courses', () => {
  const results = searchCourses(DEV_FIXTURE_COURSES, { costClasses: ['free'] });
  assert.ok(results.length > 0);
  for (const c of results) assert.equal(c.costClass, 'free');
});

test('query matches title and tags', () => {
  const ids = searchCourses(DEV_FIXTURE_COURSES, { query: 'email' }).map((c) => c.id);
  assert.deepEqual(ids, ['fx-digital-1']);
});

test('query with no match returns nothing', () => {
  assert.deepEqual(searchCourses(DEV_FIXTURE_COURSES, { query: 'zzzzqqq' }), []);
});

test('duration filter excludes courses over the limit and unknown durations', () => {
  for (const c of searchCourses(DEV_FIXTURE_COURSES, { maxDurationHours: 10 })) {
    assert.ok(c.durationHours !== null && c.durationHours <= 10);
  }
});

test('price sort is ascending with unknown prices last', () => {
  const sorted = searchCourses(DEV_FIXTURE_COURSES, {}, 'price');
  const prices = sorted.map((c) => c.priceUsd ?? Infinity);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

// ---- Provider adapters: no permission, no fetch; hourly only where terms allow ----

const TERMS: ProviderTerms = {
  providerId: 'test-provider',
  displayName: 'Test provider',
  sourceKind: 'licensed_feed',
  permissionReference: null,
  allowsExternalLinking: true,
  allowsEmbeddedContent: false,
  attributionRequired: 'Test attribution',
  minRefreshMinutes: 60,
  maxRequestsPerHour: 10,
  retentionDays: 30,
};

test('no written permission blocks fetching', () => {
  assert.deepEqual(mayFetch(TERMS, null, Date.parse(NOW)), { ok: false, reason: 'no_permission' });
});

test('with permission, first fetch is allowed', () => {
  assert.deepEqual(mayFetch({ ...TERMS, permissionReference: 'LICENSE-REF-1' }, null, Date.parse(NOW)), { ok: true });
});

test('fetch inside the provider minimum interval is refused', () => {
  const t = { ...TERMS, permissionReference: 'LICENSE-REF-1' };
  const last = Date.parse(NOW) - 30 * 60_000;
  assert.deepEqual(mayFetch(t, last, Date.parse(NOW)), { ok: false, reason: 'too_soon' });
});

test('a provider allowing 6-hour refresh is never polled hourly', () => {
  const t = { ...TERMS, permissionReference: 'LICENSE-REF-1', minRefreshMinutes: 360 };
  const last = Date.parse(NOW) - 60 * 60_000;
  assert.equal(mayFetch(t, last, Date.parse(NOW)).ok, false);
  assert.equal(nextAllowedFetchMs(t, last), last + 360 * 60_000);
});

// ---- Credit ledger: frozen spending order, idempotency, expiry, never negative ----

const LEDGER: Ledger = {
  buckets: [
    { kind: 'monthly', remaining: 5, expiresAt: '2026-10-31T00:00:00Z' },
    { kind: 'purchased', remaining: 40, expiresAt: '2027-03-01T00:00:00Z' },
    { kind: 'purchased', remaining: 15, expiresAt: '2026-12-01T00:00:00Z' },
  ],
  appliedDebitIds: [],
};

test('monthly credits are consumed before purchased credits', () => {
  const r = debit(LEDGER, 3, 'd1', NOW);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.ledger.buckets[0]!.remaining, 2);
});

test('purchased credits are consumed earliest-expiry first', () => {
  const r = debit(LEDGER, 7, 'd2', NOW); // 5 monthly + 2 from the earlier-expiring purchased bucket
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.ledger.buckets[0]!.remaining, 0);
    assert.equal(r.ledger.buckets[2]!.remaining, 13);
    assert.equal(r.ledger.buckets[1]!.remaining, 40);
  }
});

test('debit larger than balance is refused and balance never goes negative', () => {
  const total = balanceAt(LEDGER, NOW);
  assert.equal(total, 60);
  assert.deepEqual(debit(LEDGER, 61, 'd3', NOW), { ok: false, reason: 'insufficient_credits' });
});

test('replaying the same debit id is idempotent', () => {
  const first = debit(LEDGER, 2, 'same', NOW);
  assert.equal(first.ok, true);
  if (first.ok) {
    const second = debit(first.ledger, 2, 'same', NOW);
    assert.equal(second.ok && second.alreadyApplied, true);
    assert.equal(balanceAt(second.ok ? second.ledger : first.ledger, NOW), balanceAt(first.ledger, NOW));
  }
});

test('expired buckets are never spent', () => {
  const later = '2027-01-15T00:00:00Z'; // monthly and the Dec purchased bucket have expired
  assert.equal(balanceAt(LEDGER, later), 40);
  assert.deepEqual(debit(LEDGER, 41, 'd4', later), { ok: false, reason: 'insufficient_credits' });
});

test('invalid amounts are refused', () => {
  assert.deepEqual(debit(LEDGER, 0, 'd5', NOW), { ok: false, reason: 'invalid_amount' });
  assert.deepEqual(debit(LEDGER, 1.5, 'd6', NOW), { ok: false, reason: 'invalid_amount' });
});

test('monthly reset does not roll over and leaves purchased credits untouched', () => {
  const reset = resetMonthly(LEDGER, 30, '2026-11-30T00:00:00Z');
  const monthly = reset.buckets.filter((b) => b.kind === 'monthly');
  assert.equal(monthly.length, 1);
  assert.equal(monthly[0]!.remaining, 30);
  assert.equal(reset.buckets.filter((b) => b.kind === 'purchased').reduce((s, b) => s + b.remaining, 0), 55);
});

test('purchased credits expire 12 months after purchase', () => {
  assert.equal(purchasedExpiry('2026-10-06T00:00:00Z'), '2027-10-06T00:00:00.000Z');
});

// ---- Document intelligence: proposed until reviewed, sharing requires consent ----

const FIELD: ExtractedField = {
  key: 'case_number', value: 'CASE-FIXTURE-1', sourcePage: 1, sourceSnippet: 'fixture snippet',
  confidence: 'medium', status: 'proposed', correctedValue: null,
};

const DOC: DocumentRecord = {
  id: 'doc-1', ownerId: 'member-1', type: 'court_record', sensitivity: SENSITIVITY_BY_TYPE.court_record,
  originalStorageKey: 'originals/doc-1', pageCount: 2, fields: [FIELD], reviewComplete: false,
};

test('extracted fields are proposed and not usable until reviewed', () => {
  assert.equal(usableValue(FIELD), null);
  assert.equal(recomputeReviewComplete([FIELD]), false);
});

test('confirming a field makes it usable; correcting uses the corrected value', () => {
  assert.equal(usableValue(reviewField(FIELD, { action: 'confirm' })), 'CASE-FIXTURE-1');
  assert.equal(usableValue(reviewField(FIELD, { action: 'correct', value: 'CASE-FIXTURE-2' })), 'CASE-FIXTURE-2');
  assert.equal(usableValue(reviewField(FIELD, { action: 'reject' })), null);
});

test('review-complete is true only when no field is still proposed', () => {
  const done = [reviewField(FIELD, { action: 'confirm' })];
  assert.equal(recomputeReviewComplete(done), true);
});

test('court records and credit reports are highly sensitive', () => {
  assert.equal(SENSITIVITY_BY_TYPE.court_record, 'highly_sensitive');
  assert.equal(SENSITIVITY_BY_TYPE.credit_report, 'highly_sensitive');
});

test('member can always see their own document', () => {
  assert.equal(mayShareDocument(DOC, 'member_only', []), true);
});

test('donors never receive documents, even with a grant', () => {
  const grants: ConsentGrant[] = [{ documentId: 'doc-1', audience: 'donor', revokedAt: null }];
  const reviewed = { ...DOC, reviewComplete: true };
  assert.equal(mayShareDocument(reviewed, 'donor', grants), false);
});

test('no sharing with an audience until the document is fully reviewed', () => {
  const grants: ConsentGrant[] = [{ documentId: 'doc-1', audience: 'employer', revokedAt: null }];
  assert.equal(mayShareDocument(DOC, 'employer', grants), false);
});

test('sharing needs an active grant for that exact audience', () => {
  const reviewed = { ...DOC, reviewComplete: true };
  assert.equal(mayShareDocument(reviewed, 'employer', []), false);
  assert.equal(mayShareDocument(reviewed, 'employer', [{ documentId: 'doc-1', audience: 'housing_provider', revokedAt: null }]), false);
  assert.equal(mayShareDocument(reviewed, 'employer', [{ documentId: 'doc-1', audience: 'employer', revokedAt: null }]), true);
});

test('revoked grants stop sharing immediately', () => {
  const reviewed = { ...DOC, reviewComplete: true };
  const revoked: ConsentGrant[] = [{ documentId: 'doc-1', audience: 'employer', revokedAt: NOW }];
  assert.equal(mayShareDocument(reviewed, 'employer', revoked), false);
});
