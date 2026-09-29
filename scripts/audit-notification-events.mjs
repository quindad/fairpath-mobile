// Canonical notification-event catalog audit. `npm run test:notification-events`
import { NOTIFICATION_EVENTS } from '../src/core/notifications/events.ts';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const ids = Object.keys(NOTIFICATION_EVENTS);
check(ids.length === 14, 'expected all 14 canonical events, found ' + ids.length);

for (const [id, def] of Object.entries(NOTIFICATION_EVENTS)) {
  check(def.id === id, `${id}: def.id must match its key`);
  check(def.route.startsWith('/'), `${id}: route must be an app path`);
  check(def.allowedChannels.includes('in_app'), `${id}: every event must at least allow in_app (nothing skips the inbox)`);
  check(def.allowedChannels.length > 0, `${id}: must allow at least one channel`);
  check(/\{[a-z_]+\}/.test(def.dedupeKeyPattern) || !def.dedupeKeyPattern.includes('{'), `${id}: dedupe pattern placeholders must be snake_case`);
  check(['low', 'normal', 'high'].includes(def.urgency), `${id}: invalid urgency ${def.urgency}`);
  check(typeof def.requiresMarketingConsent === 'boolean', `${id}: requiresMarketingConsent must be boolean`);
  // sensitive events must never be SMS-only or email-only in a way that forces sensitive content into a preview
  // without an in-app fallback already checked above; this just guards the privacy field exists and is valid
  check(['safe', 'sensitive'].includes(def.privacy), `${id}: invalid privacy level ${def.privacy}`);
}

// account-critical events (requiresMarketingConsent = false) must never be silenceable — spot-check the ones that
// matter most: application/inquiry/entitlement/meeting updates are never marketing.
for (const id of ['APPLICATION_UPDATED', 'HOUSING_APPLICATION_UPDATED', 'INQUIRY_RESPONSE', 'MEETING_REMINDER', 'EARLY_ACCESS_GRANTED', 'FAIRPATH_PLUS_EXPIRING']) {
  check(NOTIFICATION_EVENTS[id].requiresMarketingConsent === false, `${id}: account-critical events must not require marketing consent`);
}

if (failures.length) {
  console.error('Notification event catalog audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Notification event catalog audit passed: 14 canonical events, all internally consistent, account-critical events never gated by marketing consent.');
