import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApplicationSharePreview } from '../src/core/jobs/application-share-preview.ts';
import type { OpportunityProfileData } from '../src/core/documents/builders/opportunity-profile.ts';

const profile: OpportunityProfileData = {
  contact: { first_name: 'A', last_name: 'B', phone: null, email: 'a@t.local', zip_code: '43215' },
  work: [{ job_title: 'Cook', employer_name: 'Diner', location_text: null, start_date: '2020-01-01', end_date: null, is_current: true, description: null }],
  education: [],
  credentials: [],
  skills: ['Customer service'],
  preferences: {
    desired_titles: ['Line cook'],
    employment_types: ['full_time'],
    workplace_types: ['on_site'],
    pay_min_hourly: null,
    available_days: [],
    shift_preferences: [],
    earliest_start_date: null,
    transportation_modes: [],
    has_drivers_license: null,
  },
};

describe('application share preview', () => {
  it('includes selected sections only', () => {
    const preview = buildApplicationSharePreview(['summary', 'skills'], profile, 'Reliable cook');
    assert.equal(preview.length, 2);
    assert.ok(preview.some((p) => p.section === 'summary'));
  });

  it('rejects justice-like headline text', () => {
    assert.throws(
      () => buildApplicationSharePreview(['summary'], profile, 'Felony conviction expungement'),
      /justice-record/,
    );
  });
});
