import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterResourcesForMember,
  isMemberVisibleResourceOrigin,
} from '../src/core/resources/resource-member-visibility.ts';

test('production resources are always visible', () => {
  assert.equal(isMemberVisibleResourceOrigin('production'), true);
  assert.equal(isMemberVisibleResourceOrigin(null), true);
});

test('dev_fixture hidden unless QA env flag (default off in tests)', () => {
  assert.equal(isMemberVisibleResourceOrigin('dev_fixture'), false);
});

test('filterResourcesForMember removes fixtures by default', () => {
  const rows = [
    { id: '1', data_origin: 'production' },
    { id: '2', data_origin: 'dev_fixture' },
  ];
  assert.deepEqual(filterResourcesForMember(rows).map((r) => r.id), ['1']);
});
