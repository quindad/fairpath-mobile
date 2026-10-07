// DEVELOPMENT FIXTURES ONLY. These are not real provider courses, not real listings and not verified offers.
// Every record is labeled with sourceKind 'curated' and provider 'fixture-*' so it cannot be mistaken for live inventory.
// Delete or replace with authorized feed data once a provider's written permission exists.

import type { CanonicalCourse } from './catalog-contract.ts';

const FIXTURE_LICENSE = 'DEV fixture, not licensed content';
const FETCHED = '2026-10-06T00:00:00Z';

function fixture(p: Partial<CanonicalCourse> & Pick<CanonicalCourse, 'id' | 'title' | 'category' | 'costClass'>): CanonicalCourse {
  return {
    providerId: 'fixture-provider',
    externalId: p.id,
    description: 'DEV fixture description. Not a real course.',
    tags: [],
    skills: [],
    occupationCodes: [],
    priceUsd: 0,
    certificatePriceUsd: null,
    freeAuditAvailable: false,
    deliveryFormat: 'online_self_paced',
    durationHours: 10,
    difficulty: 'beginner',
    language: 'en',
    enrollmentUrl: 'https://example.invalid/dev-fixture',
    eligibility: 'Open to all (fixture)',
    location: null,
    sourceKind: 'curated',
    sourceLicense: FIXTURE_LICENSE,
    lastFetched: FETCHED,
    lastVerified: FETCHED,
    lastChanged: null,
    status: 'active',
    ...p,
  };
}

export const DEV_FIXTURE_COURSES: readonly CanonicalCourse[] = [
  fixture({ id: 'fx-digital-1', title: 'Digital literacy basics (fixture)', category: 'Digital literacy', costClass: 'free', tags: ['computer', 'email'], skills: ['email'] }),
  fixture({ id: 'fx-fin-1', title: 'Budgeting fundamentals (fixture)', category: 'Financial literacy', costClass: 'free', skills: ['budgeting'] }),
  fixture({ id: 'fx-tech-1', title: 'Intro to IT support (fixture)', category: 'Technology training', costClass: 'free_with_paid_certificate', priceUsd: 0, certificatePriceUsd: 49, durationHours: 40, skills: ['troubleshooting'], occupationCodes: ['fixture-it-support'] }),
  fixture({ id: 'fx-trade-1', title: 'Forklift safety (fixture)', category: 'Trade certifications', costClass: 'low_cost', priceUsd: 75, durationHours: 8, deliveryFormat: 'in_person', location: 'fixture-city' }),
  fixture({ id: 'fx-trade-2', title: 'Commercial driving prep (fixture)', category: 'Transportation and logistics', costClass: 'paid', priceUsd: 1200, durationHours: 120, deliveryFormat: 'hybrid', difficulty: 'intermediate' }),
  fixture({ id: 'fx-spons-1', title: 'Sponsored bootcamp seat (fixture)', category: 'Technology training', costClass: 'sponsored', priceUsd: null, durationHours: 200, difficulty: 'intermediate' }),
  fixture({ id: 'fx-stale-1', title: 'Stale course (fixture, should be hidden)', category: 'Digital literacy', costClass: 'free', status: 'stale' }),
  fixture({ id: 'fx-unver-1', title: 'Unverified course (fixture, should be hidden)', category: 'Digital literacy', costClass: 'unknown', priceUsd: null, lastVerified: null }),
];
