import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { communityPlanStatusHint, communityRequestStatusLabel } from '../src/core/community/status-copy.ts';

describe('community status copy', () => {
  it('explains matched is not fulfilled', () => {
    assert.match(communityRequestStatusLabel('matched'), /not fulfilled/i);
    assert.match(communityPlanStatusHint('matched') ?? '', /fulfilled/i);
  });

  it('labels fulfilled clearly', () => {
    assert.match(communityRequestStatusLabel('fulfilled'), /Fulfilled/i);
  });
});
