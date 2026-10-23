import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isPublicRoute } from '../src/core/auth/public-routes.ts';
import {
  capabilitiesFromOnboardingToolStep,
  filterGoalLabels,
  filterNextStepsForCapabilities,
  justiceToolsEnabled,
  parseJusticeImpactedField,
  veteranToolsEnabled,
} from '../src/core/profile/member-capabilities-core.ts';
import { resolveGrowthDiscovery } from '../src/core/opportunity/v1-pathways.ts';

test('Neither skip means explicit no for both tools', () => {
  const c = capabilitiesFromOnboardingToolStep(['Neither — skip for now']);
  assert.equal(c.justice, 'no');
  assert.equal(c.veteran, 'no');
});

test('prefer not to say does not enable tools', () => {
  assert.equal(justiceToolsEnabled({ justice: 'prefer_not_to_say', veteran: 'no' }), false);
  assert.equal(veteranToolsEnabled({ justice: 'no', veteran: 'prefer_not_to_say' }), false);
});

test('record relief next steps hidden without justice opt-in', () => {
  const steps = filterNextStepsForCapabilities(
    [{ key: 'rr', title: 'RR', body: '', route: '/record-relief', reason: 'record_relief.eligible_now' }],
    { justice: 'no', veteran: 'no' },
  );
  assert.equal(steps.length, 0);
});

test('Reentry goal hidden from quick links when not opted in', () => {
  const goals = filterGoalLabels(['Work & income', 'Reentry', 'Veteran transition'], { justice: 'no', veteran: 'yes' });
  assert.deepEqual(goals, ['Work & income', 'Veteran transition']);
});

test('parse justice field variants', () => {
  assert.equal(parseJusticeImpactedField('Yes'), 'yes');
  assert.equal(parseJusticeImpactedField('No'), 'no');
  assert.equal(parseJusticeImpactedField('Prefer not to say'), 'prefer_not_to_say');
});

test('growth discovery routes record relief and housing correctly', () => {
  const rr = resolveGrowthDiscovery('record_relief');
  assert.equal(rr.route, '/record-relief');
  const housing = resolveGrowthDiscovery('housing');
  assert.equal(housing.route, '/find-housing');
  const legal = resolveGrowthDiscovery('legal');
  assert.ok(legal.route?.includes('/resources'));
});

test('tool preference settings stay member-only but gates link there', () => {
  assert.equal(isPublicRoute('/member-tool-preferences'), false);
  const gate = readFileSync('src/components/JusticeToolsGate.tsx', 'utf8');
  assert.match(gate, /\/member-tool-preferences/);
  const prefs = readFileSync('src/app/member-tool-preferences.tsx', 'utf8');
  assert.match(prefs, /saveMemberCapabilities/);
});
