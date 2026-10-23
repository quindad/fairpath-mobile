import assert from 'node:assert/strict';
import test from 'node:test';
import { ACADEMY_PROFILE_QUESTION, MEMBER_ACADEMY_PROGRESS_TABLE } from '../src/core/academy/cloud-persistence.ts';

test('academy cloud sync probes dedicated table before profile answers', () => {
  assert.equal(MEMBER_ACADEMY_PROGRESS_TABLE, 'member_academy_progress');
  assert.equal(ACADEMY_PROFILE_QUESTION.enrollments, 'academy.enrollments.v1');
  assert.equal(ACADEMY_PROFILE_QUESTION.workspace, 'academy.workspace.v1');
});
