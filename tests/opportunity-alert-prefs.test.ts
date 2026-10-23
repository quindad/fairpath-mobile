import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_OPPORTUNITY_ALERT_PREFS,
  opportunityDeepLinkFromMetadata,
} from '../src/core/opportunity/opportunity-alert-prefs.ts';

describe('opportunity alert prefs', () => {
  it('defaults to opt-out master switch', () => {
    assert.equal(DEFAULT_OPPORTUNITY_ALERT_PREFS.enabled, false);
  });

  it('builds community deep link from notification metadata', () => {
    assert.equal(
      opportunityDeepLinkFromMetadata({ request_id: 'abc-123' }),
      '/community/need-help/abc-123',
    );
  });

  it('builds referral deep link when resource id present', () => {
    assert.equal(
      opportunityDeepLinkFromMetadata({ referral_request_id: 'r1', resource_id: 'res-9' }),
      '/resource/res-9',
    );
  });
});
