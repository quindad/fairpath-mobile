import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJobProfileFit } from '../src/core/jobs/job-profile-fit.ts';
import type { Job } from '../src/core/jobs/jobs-service.ts';

const baseJob: Job = {
  id: 'j1',
  title: 'Forklift Operator',
  company_name: 'Acme',
  description: 'Move pallets',
  location_text: 'Columbus, OH',
  city: 'Columbus',
  state: 'OH',
  postal_code: '43215',
  workplace_type: 'on_site',
  employment_type: 'full_time',
  pay_min: 18,
  pay_max: 22,
  pay_period: 'hour',
  benefits: [],
  skills: ['forklift', 'warehouse'],
  requirements: ['OSHA 10'],
  background_policy_summary: 'Fair chance employer',
  eligibility_rules: {},
  application_method: 'fairpath',
  external_apply_url: null,
  source_label: 'test',
  source_url: null,
  featured: false,
  created_at: new Date().toISOString(),
  latitude: null,
  longitude: null,
  location_precision: 'city',
};

describe('job profile fit', () => {
  it('scores skill overlap with reasons', () => {
    const fit = evaluateJobProfileFit(baseJob, {
      skills: ['Forklift', 'Inventory'],
      desiredTitles: ['Warehouse'],
      employmentTypes: ['full_time'],
      workplaceTypes: ['on_site'],
      zipCode: '43215',
      credentialNames: ['OSHA 10'],
    });
    assert.ok(fit.score >= 30);
    assert.ok(fit.reasons.some((r) => r.toLowerCase().includes('forklift') || r.includes('OSHA')));
  });

  it('does not auto-reject when skills missing', () => {
    const fit = evaluateJobProfileFit(baseJob, {
      skills: [],
      desiredTitles: [],
      employmentTypes: [],
      workplaceTypes: [],
      zipCode: null,
      credentialNames: [],
    });
    assert.equal(fit.band, 'explore');
    assert.ok(fit.gaps.length >= 0);
  });
});
