import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toClientSafeEvent, isFinancialAction, type AuditEvent } from '../src/core/staffing/audit.ts';
import { templateIsComplete, templateEffectiveOn, resolveBillRateHourly, type RateCardTemplate } from '../src/core/staffing/rate-card-template.ts';

// ---- Audit: financial and credential-shaped fields never reach the client-safe version ----

const EVENT: AuditEvent = {
  id: 'ae1', actorId: 'u1', action: 'rate_card_changed', assignmentId: 'a1', requisitionId: null, occurredAt: '2026-10-07T00:00:00Z',
  details: { billRateHourly: 32, eorCostHourly: 2, providerRef: 'mock-foxhire-a1', note: 'rate updated after negotiation' },
};

test('financial fields are stripped from the client-safe event', () => {
  const safe = toClientSafeEvent(EVENT);
  assert.equal('billRateHourly' in safe.details, false);
  assert.equal('eorCostHourly' in safe.details, false);
});

test('credential-shaped fields are stripped regardless of action type', () => {
  const safe = toClientSafeEvent(EVENT);
  assert.equal('providerRef' in safe.details, false);
});

test('ordinary, non-financial detail fields pass through unchanged', () => {
  const safe = toClientSafeEvent(EVENT);
  assert.equal(safe.details.note, 'rate updated after negotiation');
});

test('rate_card_changed is the only action flagged financial', () => {
  assert.equal(isFinancialAction('rate_card_changed'), true);
  assert.equal(isFinancialAction('candidate_submitted'), false);
});

// ---- Rate card templates: data architecture only, no real pricing invented ----

const TEMPLATE: RateCardTemplate = {
  id: 'rc1', clientOrganizationId: 'org1', roleTitle: 'Warehouse Associate', location: 'Columbus, OH',
  effectiveFrom: '2026-09-01', effectiveTo: null, payRangeMinHourly: 18, payRangeMaxHourly: 21,
  billRateHourly: null, markupPercent: 60, eorCostAssumptionHourly: 2, overtimeRulesText: null,
  screeningRequirementsText: null, assignmentMinimumWeeks: 4,
};

test('a template with only ranges and markup is not complete until a bill rate resolves and EOR cost is set', () => {
  assert.equal(templateIsComplete(TEMPLATE), true); // markup + range lets resolveBillRateHourly derive one, and EOR is set
  assert.equal(templateIsComplete({ ...TEMPLATE, eorCostAssumptionHourly: null }), false);
});

test('bill rate resolves from markup over the midpoint of the pay range when no explicit rate is set', () => {
  assert.equal(resolveBillRateHourly(TEMPLATE), 31.2); // 19.5 * 1.6
});

test('an explicit bill rate always wins over markup derivation', () => {
  assert.equal(resolveBillRateHourly({ ...TEMPLATE, billRateHourly: 35 }), 35);
});

test('no bill rate resolves when neither an explicit rate nor a complete markup input exists', () => {
  assert.equal(resolveBillRateHourly({ ...TEMPLATE, markupPercent: null, billRateHourly: null }), null);
});

test('effective dating picks the template that applies on the given date, respecting an end date', () => {
  const older: RateCardTemplate = { ...TEMPLATE, id: 'rc-old', effectiveFrom: '2026-01-01', effectiveTo: '2026-09-01' };
  const current: RateCardTemplate = { ...TEMPLATE, id: 'rc-new', effectiveFrom: '2026-09-01', effectiveTo: null };
  const found = templateEffectiveOn([older, current], 'org1', 'Warehouse Associate', 'Columbus, OH', '2026-10-01');
  assert.equal(found!.id, 'rc-new');
  const foundOld = templateEffectiveOn([older, current], 'org1', 'Warehouse Associate', 'Columbus, OH', '2026-06-01');
  assert.equal(foundOld!.id, 'rc-old');
});

test('no template matches a different role, location or client', () => {
  assert.equal(templateEffectiveOn([TEMPLATE], 'org1', 'Forklift Operator', 'Columbus, OH', '2026-10-01'), null);
  assert.equal(templateEffectiveOn([TEMPLATE], 'org1', 'Warehouse Associate', 'Cincinnati, OH', '2026-10-01'), null);
  assert.equal(templateEffectiveOn([TEMPLATE], 'org2', 'Warehouse Associate', 'Columbus, OH', '2026-10-01'), null);
});
