import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleUnifiedJusticeCases } from '../src/core/justice/unified-assembly.ts';
import { unifiedCaseToCaseBundle } from '../src/core/justice/mappers.ts';
import { previewReliefForBundle } from '../src/core/justice/per-charge-relief.ts';
import type { Conviction } from '../src/core/profile/conviction-service.ts';
import type { ReliefCase } from '../src/core/record-relief/relief-service.ts';

const conviction = (over: Partial<Conviction>): Conviction => ({
  id: 'c1',
  user_id: 'u1',
  offense_catalog_id: null,
  taxonomy_category_id: null,
  origin: 'manual',
  jurisdiction_type: 'state',
  state_code: 'OH',
  county: 'Franklin',
  court_name: 'Franklin County Court',
  case_number: '2026-XXXX',
  offense_code: '2903.11',
  offense_title: 'Felonious assault',
  offense_level: null,
  offense_degree: 'felony',
  offense_class: null,
  disposition: 'conviction',
  conviction_date: '2020-01-15',
  sentence_date: null,
  sentence_summary: null,
  release_date: '2022-06-01',
  supervision_status: null,
  is_violent: true,
  is_sexual: false,
  source_type: 'self_reported',
  verification_state: 'user_confirmed',
  source_reference: null,
  user_notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  ...over,
});

const relief = (over: Partial<ReliefCase>): ReliefCase => ({
  id: 'rr1',
  jurisdiction_code: 'US-OH',
  label: '2026 case',
  court_name: 'Franklin County Court',
  case_number: '2026-XXXX',
  offense_description: 'Count 2 dismissed',
  offense_class: 'misdemeanor',
  disposition: 'dismissal',
  is_juvenile: false,
  out_of_state_conviction: false,
  conviction_date: null,
  disposition_date: '2021-03-01',
  sentence_completion_date: null,
  supervision_completion_date: null,
  release_date: null,
  fines_paid: null,
  restitution_paid: null,
  other_convictions_count: null,
  pending_charges: null,
  notes: null,
  updated_at: '2026-01-03T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  filing_status: 'not_started',
  filed_on: null,
  ...over,
});

test('merges convictions and record relief rows on matching docket number', () => {
  const rows = assembleUnifiedJusticeCases([conviction({})], [relief({})]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].charges.length, 2);
  assert.ok(rows[0].sources.includes('conviction'));
  assert.ok(rows[0].sources.includes('record_relief'));
});

test('multi-charge bundle evaluates without inventing a third store', () => {
  const rows = assembleUnifiedJusticeCases(
    [conviction({ id: 'c1', offense_title: 'Count 1 F2', offense_degree: 'felony' })],
    [relief({ id: 'rr2', case_number: 'OTHER', offense_description: 'Count 3 M1 amended', disposition: 'conviction' })],
  );
  assert.equal(rows.length, 2);
  const multi = rows.find((r) => r.charges.length >= 1)!;
  const bundle = unifiedCaseToCaseBundle(multi);
  assert.ok(bundle.charges.length >= 1);
  const previews = previewReliefForBundle(bundle, new Date('2026-10-01'));
  for (const p of previews) {
    if (p.daysRemaining != null) assert.ok(p.daysRemaining >= 0);
    assert.ok(!/guaranteed/i.test(p.outcome));
  }
});
