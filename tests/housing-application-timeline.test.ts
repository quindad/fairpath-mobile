import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { housingApplicationEventLabel, housingApplicationTimeline } from '../src/core/housing/application-timeline.ts';

function states(status: string, events: { event_type: string; metadata?: Record<string, unknown> }[] = []) {
  return housingApplicationTimeline(status, events).map((step) => [step.key, step.label, step.state]);
}

test('a denial does not mark an untaken tour as complete', () => {
  const steps = housingApplicationTimeline('denied', [
    { event_type: 'submitted', metadata: { from: 'started', to: 'submitted' } },
    { event_type: 'provider_status_change', metadata: { from: 'submitted', to: 'denied' } },
    { event_type: 'denied', metadata: { from: 'submitted', to: 'denied' } },
  ]);
  assert.deepEqual(steps.map((step) => [step.key, step.state]), [
    ['submitted', 'done'],
    ['reviewing', 'upcoming'],
    ['tour', 'upcoming'],
    ['decision', 'current'],
  ]);
  assert.equal(steps[3].label, 'Not approved');
  assert.match(steps[3].body, /did not approve/);
});

test('a withdrawal keeps the stage the member actually left', () => {
  assert.deepEqual(states('withdrawn', [
    { event_type: 'reviewing', metadata: { from: 'submitted', to: 'reviewing' } },
    { event_type: 'tour', metadata: { from: 'reviewing', to: 'tour' } },
    { event_type: 'withdrawn', metadata: { from: 'tour', to: 'withdrawn' } },
  ]), [
    ['submitted', 'Submitted', 'done'],
    ['reviewing', 'Property review', 'done'],
    ['tour', 'Tour / next step', 'done'],
    ['decision', 'Withdrawn', 'current'],
  ]);
});

test('in-progress review does not claim a tour or a decision', () => {
  assert.deepEqual(states('reviewing'), [
    ['submitted', 'Submitted', 'done'],
    ['reviewing', 'Property review', 'current'],
    ['tour', 'Tour / next step', 'upcoming'],
    ['decision', 'Decision', 'upcoming'],
  ]);
});

test('approval after a recorded tour names the decision', () => {
  const steps = housingApplicationTimeline('approved', [
    { event_type: 'tour', metadata: { from: 'reviewing', to: 'tour' } },
    { event_type: 'approved', metadata: { from: 'tour', to: 'approved' } },
  ]);
  assert.equal(steps.find((step) => step.key === 'tour')?.state, 'done');
  assert.equal(steps.find((step) => step.key === 'decision')?.label, 'Approved');
  assert.equal(steps.find((step) => step.key === 'decision')?.state, 'current');
});

test('provider status events show the real stage instead of a generic change', () => {
  assert.equal(housingApplicationEventLabel({
    event_type: 'provider_status_change',
    metadata: { from: 'reviewing', to: 'denied' },
  }), 'APPLICATION NOT APPROVED');
  assert.equal(housingApplicationEventLabel({ event_type: 'tour', metadata: {} }), 'TOUR / NEXT STEP');
});

test('the application screen uses the timeline helper', () => {
  const src = readFileSync('src/app/housing-application/[id].tsx', 'utf8');
  assert.match(src, /housingApplicationTimeline/);
  assert.doesNotMatch(src, /status==='denied'\?3/);
  assert.doesNotMatch(src, /status==='withdrawn'\?0/);
});
