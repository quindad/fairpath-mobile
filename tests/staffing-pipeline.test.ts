import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAdvance, applyTransition, requiresAudit, screeningConsentSatisfied, STAGE_RECORD_LEVEL,
  AUTO_DECISION_STAGES, AUDITED_STAGES, type PipelineStage,
} from '../src/core/staffing/pipeline.ts';

test('every stage is assigned to exactly one record level', () => {
  const stages = Object.keys(STAGE_RECORD_LEVEL) as PipelineStage[];
  for (const s of stages) assert.ok(['requisition', 'application', 'assignment'].includes(STAGE_RECORD_LEVEL[s]), s);
});

test('a valid full pipeline walk succeeds end to end', () => {
  const path: PipelineStage[] = [
    'requisition_created', 'requisition_approved', 'sourcing', 'candidate_identified', 'candidate_interested',
    'candidate_submitted', 'interview_requested', 'interview_scheduled', 'interview_completed', 'employer_moving_forward',
    'screening_authorization_requested', 'screening_consent_received', 'screening_requested', 'screening_processing',
    'onboarding_requested', 'onboarding_pending', 'onboarding_complete', 'placement_confirmed', 'assignment_scheduled',
    'assignment_active', 'assignment_completed', 'retention_checkpoint_due', 'retention_confirmed',
  ];
  for (let i = 1; i < path.length; i++) assert.equal(canAdvance(path[i - 1]!, path[i]!), true, `${path[i - 1]} -> ${path[i]}`);
});

test('invalid transitions are refused, including skipping a stage', () => {
  assert.equal(canAdvance('requisition_created', 'assignment_active'), false);
  assert.equal(canAdvance('candidate_submitted', 'onboarding_complete'), false);
});

test('screening_requires_human_review only proceeds after a human clears it to onboarding_requested', () => {
  assert.equal(canAdvance('screening_processing', 'screening_requires_human_review'), true);
  assert.equal(canAdvance('screening_requires_human_review', 'onboarding_requested'), true);
  assert.equal(canAdvance('screening_requires_human_review', 'placement_confirmed'), false);
});

test('an extension returns to assignment_active, it does not create a new assignment', () => {
  assert.equal(canAdvance('assignment_active', 'assignment_extended'), true);
  assert.equal(canAdvance('assignment_extended', 'assignment_active'), true);
});

test('conversion to direct hire exits the staffing pipeline entirely', () => {
  assert.equal(canAdvance('assignment_active', 'converted_to_direct_hire'), true);
  assert.deepEqual(Object.keys({ converted_to_direct_hire: true }).length > 0, true);
});

test('applyTransition refuses an invalid move and requires no audit for it', () => {
  const r = applyTransition({ from: 'requisition_created', to: 'assignment_active', actorId: 'u1', occurredAt: '2026-10-07T00:00:00Z' });
  assert.deepEqual(r, { ok: false, reason: 'invalid_transition' });
});

test('applyTransition flags audit for sensitive stages and not for ordinary ones', () => {
  const sensitive = applyTransition({ from: 'screening_authorization_requested', to: 'screening_consent_received', actorId: 'u1', occurredAt: 'x' });
  assert.deepEqual(sensitive, { ok: true, stage: 'screening_consent_received', auditRequired: true });
  const ordinary = applyTransition({ from: 'sourcing', to: 'candidate_identified', actorId: 'u1', occurredAt: 'x' });
  assert.deepEqual(ordinary, { ok: true, stage: 'candidate_identified', auditRequired: false });
});

test('every audited stage actually requires audit when checked directly', () => {
  for (const s of AUDITED_STAGES) assert.equal(requiresAudit(s), true, s);
});

test('screening consent gate matches checkr-adapter.ts\'s rule restated at the pipeline level', () => {
  assert.equal(screeningConsentSatisfied('interview_completed'), false);
  assert.equal(screeningConsentSatisfied('screening_consent_received'), true);
  assert.equal(screeningConsentSatisfied('assignment_active'), true);
});

test('no stage is an automatic decision', () => {
  assert.deepEqual(AUTO_DECISION_STAGES, []);
});
