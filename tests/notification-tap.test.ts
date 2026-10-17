import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { notificationTapId, planNotificationTap } from '../src/core/notifications/notification-tap.ts';

const tap = (identifier: string) => ({ notification: { request: { identifier } } });

test('a missing response is not a tap', () => {
  assert.equal(notificationTapId(null), null);
  assert.deepEqual(planNotificationTap('/home', null, null), { consume: false, route: null });
});

test('a new tap opens the inbox once, then the same tap is ignored', () => {
  assert.equal(notificationTapId(tap('tap-1')), 'tap-1');
  assert.deepEqual(planNotificationTap('/home', 'tap-1', null), { consume: true, route: '/notifications' });
  assert.deepEqual(planNotificationTap('/find-jobs', 'tap-1', 'tap-1'), { consume: false, route: null });
});

test('a later different tap can open the inbox again', () => {
  assert.deepEqual(planNotificationTap('/home', 'tap-2', 'tap-1'), { consume: true, route: '/notifications' });
});

test('onboarding and an already-open inbox consume the tap without navigating', () => {
  assert.deepEqual(planNotificationTap('/accept-terms', 'tap-1', null), { consume: true, route: null });
  assert.deepEqual(planNotificationTap('/onboarding', 'tap-1', null), { consume: true, route: null });
  assert.deepEqual(planNotificationTap('/notifications', 'tap-1', null), { consume: true, route: null });
});

test('root layout clears the stored response instead of replaying any truthy response', () => {
  const layout = readFileSync('src/app/_layout.tsx', 'utf8');
  assert.match(layout, /planNotificationTap\(pathnameRef\.current, tapId, handledTapId\)/);
  assert.match(layout, /Notifications\.clearLastNotificationResponse\(\)/);
  assert.doesNotMatch(layout, /if\s*\(\s*response\s*\)\s*openNotification\(\)/);
});
