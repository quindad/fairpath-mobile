import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertProfessionalPreviewSafe,
  buildProfessionalProfilePreview,
  deriveDefaultHeadline,
} from '../src/core/profile/professional-profile-model.ts';
import type { OpportunityProfileData } from '../src/core/documents/builders/opportunity-profile.ts';

const emptyProfile: OpportunityProfileData = {
  contact: { first_name: 'Alex', last_name: 'Rivera', phone: null, email: 'a@test.local', zip_code: '43215' },
  work: [],
  education: [],
  credentials: [],
  skills: [],
  preferences: {
    desired_titles: ['Warehouse lead'],
    employment_types: ['full_time'],
    workplace_types: ['on_site'],
    pay_min_hourly: null,
    available_days: [],
    shift_preferences: [],
    earliest_start_date: null,
    transportation_modes: [],
    has_drivers_license: true,
  },
};

describe('professional profile preview', () => {
  it('derives headline from career interests', () => {
    assert.equal(deriveDefaultHeadline(['Forklift operator'], null), 'Forklift operator');
  });

  it('builds preview without justice fields', () => {
    const preview = buildProfessionalProfilePreview(
      {
        first_name: 'Alex',
        last_name: 'Rivera',
        phone: '',
        zip_code: '43215',
        search_radius_miles: 25,
        email: 'a@test.local',
        professional_headline: 'Reliable warehouse lead',
      } as Parameters<typeof buildProfessionalProfilePreview>[0],
      emptyProfile,
    );
    assert.equal(preview.headline, 'Reliable warehouse lead');
    assert.ok(!JSON.stringify(preview).toLowerCase().includes('conviction'));
  });

  it('rejects justice-like content in preview JSON', () => {
    assert.throws(() => assertProfessionalPreviewSafe('pending felony conviction'), /justice-record/);
  });
});
