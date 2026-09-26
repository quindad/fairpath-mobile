// Housing pools for the DEV inventory seed. Nothing here describes a real property.
//
// Deliberately NOT seeded: walk/transit/bike scores, schools and nearby places. FairPath's product
// rule is "no fabricated provider data"; those fields stay NULL/empty until a real provider is
// connected, so the UI keeps showing its honest empty states.

// Same stock-photo URLs the project already vetted (previously src/core/demo/demo-media.ts). They are
// generic interiors/exteriors used ONLY as DEV test media stored in housing_media — never as an app-side fallback.
export const PHOTO_POOL = [
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600210491369-e753d80a41f3?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600566753051-f0b89df2dd90?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600585154363-67eb9e2e2099?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600607688066-890987f18a86?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=82',
];

export const PHOTO_CAPTIONS = ['Living room', 'Kitchen', 'Bedroom', 'Bathroom', 'Exterior', 'Dining area', 'Entry', 'Backyard'];

// kind -> how the listing is shaped. `label` is used in titles; `db` is the property_type stored.
export const KINDS = [
  { kind: 'studio', db: 'apartment', label: 'Studio', beds: [0, 0], weight: 10 },
  { kind: 'apartment', db: 'apartment', label: 'Apartment', beds: [1, 3], weight: 28 },
  { kind: 'house', db: 'house', label: 'Single-Family Home', beds: [2, 5], weight: 20 },
  { kind: 'townhome', db: 'townhome', label: 'Townhome', beds: [2, 4], weight: 10 },
  { kind: 'duplex', db: 'duplex', label: 'Duplex', beds: [2, 4], weight: 12 },
  { kind: 'condo', db: 'condo', label: 'Condo', beds: [1, 3], weight: 8 },
  { kind: 'room', db: 'room', label: 'Private Room', beds: [1, 1], weight: 5 },
];

export const BASE_RENT_BY_BEDS = [750, 950, 1200, 1500, 1800, 2100];
export const BASE_SQFT_BY_BEDS = [420, 650, 900, 1150, 1500, 1900];

export const ADJECTIVES = ['Bright', 'Spacious', 'Renovated', 'Cozy', 'Sunny', 'Updated', 'Quiet', 'Charming'];
export const STREETS = ['Maple Ave', 'Oak St', 'Cedar Ln', 'Elm St', 'Park Blvd', 'Lakeview Dr', 'Highland Ave', 'Willow Rd', 'Sycamore St', 'Franklin St',
  'Jefferson Ave', 'Washington St', 'Grant Ave', 'Chestnut St', 'Walnut St', 'Birch Ct', 'Riverside Dr', 'Prospect Ave', 'Union St', 'Pine St'];

export const SCREENING = [
  { text: 'Income at least 2.5x monthly rent. Credit is reviewed in context and limited credit history is considered. Criminal history is reviewed case by case with an individualized assessment.', policy: 'individual_review', lookback: null, evidence: 'explicit' },
  { text: 'No minimum credit score. Income verification required (2x rent). Convictions older than 3 years are not considered.', policy: 'considered_after_years', lookback: 3, evidence: 'explicit' },
  { text: 'Standard screening: income 3x rent, credit and rental history check. Applicants with records may provide context and references.', policy: 'individual_review', lookback: null, evidence: 'none' },
  { text: 'Second-chance friendly: we review the full application, not just a background report. Recent evictions require a written explanation.', policy: 'considered', lookback: null, evidence: 'explicit' },
  { text: 'Income at least 2x rent or a verified housing voucher. Background review focuses on offenses related to the safety of residents and property.', policy: 'individual_review', lookback: 5, evidence: 'explicit' },
  { text: 'Credit and rental history required. Background check reviewed against a 7-year lookback for certain offense categories.', policy: 'considered_after_years', lookback: 7, evidence: 'none' },
];

export const LEASE_TERMS = [['12 months'], ['6 months', '12 months'], ['Month-to-month', '12 months'], ['12 months', '24 months']];
export const UTILITIES = ['Water', 'Sewer', 'Trash', 'Gas', 'Electric', 'Internet', 'Heat'];
export const AMENITIES_COMMON = ['Central air', 'Dishwasher', 'Ceiling fans', 'Hardwood floors', 'Updated kitchen', 'Storage', 'Public transit nearby', 'Bike storage', 'Secure entry'];
export const AMENITIES_APARTMENT = ['Elevator', 'Fitness center', 'On-site laundry', 'Package lockers', 'Community room'];
export const AMENITIES_HOUSE = ['Fenced yard', 'Patio', 'Driveway', 'Basement storage', 'Off-street parking'];

export const PET_POLICIES = [
  { text: 'No pets allowed', types: [], w: 25 },
  { text: 'Cats and small dogs welcome. $35/month pet rent per pet', types: ['cat', 'dog'], w: 40 },
  { text: 'Cats only, one-time pet deposit required', types: ['cat'], w: 12 },
  { text: 'Pets negotiable. Refundable pet deposit required', types: ['cat', 'dog'], w: 15 },
  { text: 'Service and assistance animals welcome. No other pets', types: [], w: 8 },
];

export const REQUIRED_DOCS = [
  { docs: [], w: 10 },
  { docs: ['identity'], w: 20 },
  { docs: ['identity', 'income'], w: 35 },
  { docs: ['identity', 'income', 'employment'], w: 20 },
  { docs: ['identity', 'income', 'housing_history'], w: 15 },
];
