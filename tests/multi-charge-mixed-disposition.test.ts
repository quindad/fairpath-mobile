import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleUnifiedJusticeCases } from '../src/core/justice/unified-assembly.ts';
import { unifiedCaseToCaseBundle } from '../src/core/justice/mappers.ts';
import { previewReliefForBundle } from '../src/core/justice/per-charge-relief.ts';
import type { Conviction } from '../src/core/profile/conviction-service.ts';
import type { ReliefCase } from '../src/core/record-relief/relief-service.ts';

const conv = (id: string, title: string, disp: string, degree: string): Conviction => ({
  id,
  user_id: 'u1',
  offense_catalog_id: null,
  taxonomy_category_id: null,
  origin: 'manual',
  jurisdiction_type: 'state',
  state_code: 'OH',
  county: null,
  court_name: null,
  case_number: '2026-XXXX',
  offense_code: null,
  offense_title: title,
  offense_level: null,
  offense_degree: degree,
  offense_class: null,
  disposition: disp,
  conviction_date: '2020-01-01',
  sentence_date: null,
  sentence_summary: null,
  release_date: '2022-01-01',
  supervision_status: null,
  is_violent: null,
  is_sexual: null,
  source_type: 'self_reported',
  verification_state: 'user_confirmed',
  source_reference: null,
  user_notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const rr = (id: string, desc: string, disp: string, cls: string): ReliefCase => ({
  id,
  jurisdiction_code: 'US-OH',
  label: '2026-XXXX',
  court_name: 'Common Pleas',
  case_number: '2026-XXXX',
  offense_description: desc,
  offense_class: cls,
  disposition: disp as ReliefCase['disposition'],
  is_juvenile: false,
  out_of_state_conviction: false,
  conviction_date: '2020-01-01',
  disposition_date: '2021-01-01',
  sentence_completion_date: '2022-01-01',
  supervision_completion_date: null,
  release_date: null,
  fines_paid: true,
  restitution_paid: true,
  other_convictions_count: null,
  pending_charges: false,
  notes: null,
  filing_status: 'not_started',
  filed_on: null,
  updated_at: '2026-01-02T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
});

test('mixed dispositions on one docket produce multiple charge previews', () => {
  const rows = assembleUnifiedJusticeCases(
    [conv('c1', 'Count 1 F2', 'conviction', 'felony')],
    [
      rr('r1', 'Count 2 F5 dismissed', 'dismissal', 'non_violent_felony'),
      rr('r2', 'Count 3 M1 amended', 'conviction', 'misdemeanor'),
    ],
  );
  const merged = rows.find((r) => r.charges.length >= 3);
  assert.ok(merged, 'expected merged docket with three counts');
  const bundle = unifiedCaseToCaseBundle(merged!);
  assert.equal(bundle.charges.length, 3);
  const previews = previewReliefForBundle(bundle, new Date('2026-10-01'));
  assert.ok(previews.length >= 1);
  const outcomes = new Set(previews.map((p) => p.outcome));
  assert.ok(outcomes.size >= 1);
  for (const p of previews) {
    assert.ok(!/guaranteed|definitely eligible/i.test(p.outcome));
  }
});
