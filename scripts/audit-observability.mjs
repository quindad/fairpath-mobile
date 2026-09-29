// Provider-neutral observability wrappers: privacy filtering and adapter-seam audit. `npm run test:observability`
import { sanitizeProperties, track, screen, identify, getAnalyticsAdapter, setAnalyticsAdapter } from '../src/core/observability/analytics.ts';
import { getErrorMonitorAdapter, setErrorMonitorAdapter, captureException } from '../src/core/observability/error-monitor.ts';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

// ---------- forbidden fields are actually stripped, not just documented ----------
const dirty = {
  date_of_birth: '1990-01-01', dob: '1990-01-01', ssn: '123-45-6789', street_address: '123 Main St', zip_code: '43215',
  conviction_type: 'felony', offense_class: 'violent', case_facts: 'stole a car', credit_account_number: '4111',
  dispute_reason: 'this is not my account', document_content: 'PDF bytes', answer_text: 'sensitive answer',
  first_name: 'Sterling', email: 'test@example.com', auth_token: 'sk_live_xxx',
  safe_count: 3, safe_flag: true, safe_result: 'success', safe_screen: 'find-jobs',
};
const { safe, dropped } = sanitizeProperties(dirty);
for (const badKey of ['date_of_birth', 'dob', 'ssn', 'street_address', 'zip_code', 'conviction_type', 'offense_class', 'case_facts', 'credit_account_number', 'dispute_reason', 'document_content', 'answer_text', 'first_name', 'email', 'auth_token']) {
  check(!(badKey in safe), `sanitizeProperties must strip "${badKey}"`);
}
for (const goodKey of ['safe_count', 'safe_flag', 'safe_result', 'safe_screen']) {
  check(goodKey in safe, `sanitizeProperties must keep the safe key "${goodKey}"`);
}
check(dropped.length >= 15, 'every forbidden key must be reported as dropped, found ' + dropped.length);

check(!('nested' in sanitizeProperties({ nested: { anything: 'goes here' } }).safe), 'nested objects are always dropped, even with an innocuous key name, since they could smuggle sensitive fields');
check(!('big_value' in sanitizeProperties({ big_value: 'x'.repeat(201) }).safe), 'oversized strings are dropped as a precaution');
check('normal_value' in sanitizeProperties({ normal_value: 'x'.repeat(200) }).safe, 'strings at the 200-char boundary are kept');

// ---------- real forbidden-field scenario: a caller accidentally passes a Record Relief case fact ----------
const leaked = sanitizeProperties({ event: 'relief_case_viewed', case_facts: 'possession charge from 2016', case_id: 'abc-123' });
check(!('case_facts' in leaked.safe) && 'case_id' in leaked.safe, 'a plausible real call site (case viewed, with case facts accidentally included) is filtered correctly: id kept, facts dropped');

// ---------- adapters are swappable (the seam a future Sentry/PostHog integration needs) and never throw ----------
let calls = [];
setAnalyticsAdapter({ name: 'test', track: (e, p) => calls.push(['track', e, p]), screen: (n, p) => calls.push(['screen', n, p]), identify: (id) => calls.push(['identify', id]), reset: () => calls.push(['reset']) });
track('test_event', { safe_count: 1, dob: 'should not appear' });
screen('test_screen', {});
identify('opaque-user-id-123');
check(calls[0][1] === 'test_event' && !('dob' in calls[0][2]) && calls[0][2].safe_count === 1, 'track() sanitizes before handing off to the adapter');
check(calls[1][1] === 'test_screen' && calls[2][1] === 'opaque-user-id-123', 'screen/identify reach the adapter');
check(getAnalyticsAdapter().name === 'test', 'the adapter seam is genuinely swappable');

let errorCalls = [];
setErrorMonitorAdapter({ name: 'test', captureException: (e, x) => errorCalls.push(['captureException', e, x]), captureMessage: () => {}, setUser: () => {}, clearUser: () => {}, setContext: () => {}, addBreadcrumb: () => {} });
captureException(new Error('boom'), { safe_code: 500, credit_details: 'should not appear' });
check(errorCalls[0][1] instanceof Error && !('credit_details' in errorCalls[0][2]) && errorCalls[0][2].safe_code === 500, 'captureException sanitizes its extra context but never touches the error object itself');
check(getErrorMonitorAdapter().name === 'test', 'the error-monitor adapter seam is genuinely swappable');

if (failures.length) {
  console.error('Observability audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Observability audit passed: privacy denylist strips DOB/SSN/address/justice/credit/dispute/document/PII fields, nested and oversized values always dropped, analytics/error-monitor adapter seams are swappable and sanitize before handoff.');
