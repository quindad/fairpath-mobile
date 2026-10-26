import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterNotificationsForCapabilities,
  notificationVisibleForCapabilities,
  type MemberCapabilities,
} from '../src/core/profile/member-capabilities-core.ts';

const neither: MemberCapabilities = { justice: 'no', veteran: 'no' };
const justiceOnly: MemberCapabilities = { justice: 'yes', veteran: 'no' };

test('hides record relief notifications when justice tools disabled', () => {
  assert.equal(
    notificationVisibleForCapabilities({ category: 'community', route: '/record-relief' }, neither),
    false,
  );
  assert.equal(
    notificationVisibleForCapabilities({ category: 'record_relief', route: '/home' }, neither),
    false,
  );
  assert.equal(
    notificationVisibleForCapabilities({ category: 'community', route: '/record-relief/case/1' }, justiceOnly),
    true,
  );
});

test('hides veteran notifications when veteran tools disabled', () => {
  assert.equal(notificationVisibleForCapabilities({ category: 'veteran_benefits', route: '/veterans' }, neither), false);
  assert.equal(notificationVisibleForCapabilities({ category: 'jobs', route: '/find-jobs' }, neither), true);
});

test('filterNotificationsForCapabilities preserves order', () => {
  const rows = [
    { id: '1', category: 'jobs', route: '/find-jobs' },
    { id: '2', category: 'record_relief', route: '/record-relief' },
  ];
  const out = filterNotificationsForCapabilities(rows, neither);
  assert.deepEqual(out.map((r) => r.id), ['1']);
});
