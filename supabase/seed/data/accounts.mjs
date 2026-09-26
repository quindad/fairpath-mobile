// Fictional DEV-only organizations. Every name contains "Demo" so nothing here can be mistaken for a
// real employer or landlord, and every account email uses the reserved ".test" TLD (RFC 2606) so it can
// never receive mail or belong to a real person. Accounts are created WITHOUT a password — nobody can
// sign in as them; they exist only to own seeded inventory (jobs.employer_id / housing_listings.owner_id
// are real auth.users foreign keys).
//
// stance -> how the employer treats conviction history (drives eligibility_rules + policy text):
//   explicit   : stated fair-chance / second-chance hiring
//   individual : case-by-case, individualized review
//   waiting    : considered after a lookback period
//   standard   : no stated policy
//   restricted : fair-chance, but certain offense categories are excluded for job-related reasons

export const SEED_EMAIL_DOMAIN = 'dev-seed.fairpath.test';

export const EMPLOYERS = [
  { key: 'lakefront-freight', name: 'Lakefront Demo Freight', industries: ['warehouse_logistics'], stance: 'explicit', size: '500-1,000 employees' },
  { key: 'meridian-fulfillment', name: 'Meridian Demo Fulfillment', industries: ['warehouse_logistics', 'retail'], stance: 'individual', size: '1,000+ employees' },
  { key: 'crossroads-distribution', name: 'Crossroads Demo Distribution', industries: ['warehouse_logistics', 'transportation'], stance: 'waiting', size: '200-500 employees' },
  { key: 'buckeye-fabrication', name: 'Buckeye Demo Fabrication', industries: ['manufacturing'], stance: 'explicit', size: '200-500 employees' },
  { key: 'ironbridge-manufacturing', name: 'Ironbridge Demo Manufacturing', industries: ['manufacturing', 'skilled_trades'], stance: 'individual', size: '500-1,000 employees' },
  { key: 'tri-state-builders', name: 'Tri-State Demo Builders', industries: ['construction'], stance: 'explicit', size: '50-200 employees' },
  { key: 'cornerstone-contractors', name: 'Cornerstone Demo Contractors', industries: ['construction', 'skilled_trades'], stance: 'individual', size: '50-200 employees' },
  { key: 'keystone-mechanical', name: 'Keystone Demo Mechanical Services', industries: ['skilled_trades'], stance: 'explicit', size: '50-200 employees' },
  { key: 'northcoast-trade', name: 'Northcoast Demo Trade Services', industries: ['skilled_trades', 'construction'], stance: 'standard', size: '10-50 employees' },
  { key: 'capital-hospitality', name: 'Capital Demo Hospitality Group', industries: ['hospitality', 'food_service'], stance: 'explicit', size: '1,000+ employees' },
  { key: 'harborview-hotels', name: 'Harborview Demo Hotels', industries: ['hospitality'], stance: 'individual', size: '200-500 employees' },
  { key: 'fireside-kitchens', name: 'Fireside Demo Kitchens', industries: ['food_service'], stance: 'explicit', size: '50-200 employees' },
  { key: 'corner-table', name: 'Corner Table Demo Restaurants', industries: ['food_service', 'hospitality'], stance: 'standard', size: '10-50 employees' },
  { key: 'riverbend-care', name: 'Riverbend Demo Care Partners', industries: ['healthcare_support'], stance: 'restricted', size: '1,000+ employees' },
  { key: 'evergreen-senior-living', name: 'Evergreen Demo Senior Living', industries: ['healthcare_support'], stance: 'individual', size: '200-500 employees' },
  { key: 'summit-transit', name: 'Summit Demo Transit Services', industries: ['transportation'], stance: 'waiting', size: '500-1,000 employees' },
  { key: 'blue-route-logistics', name: 'Blue Route Demo Logistics', industries: ['transportation', 'warehouse_logistics'], stance: 'restricted', size: '200-500 employees' },
  { key: 'beacon-support', name: 'Beacon Demo Support Center', industries: ['customer_service'], stance: 'explicit', size: '500-1,000 employees' },
  { key: 'pathfinder-contact', name: 'Pathfinder Demo Contact Solutions', industries: ['customer_service', 'office_admin'], stance: 'individual', size: '200-500 employees' },
  { key: 'union-square-admin', name: 'Union Square Demo Administrative Services', industries: ['office_admin'], stance: 'standard', size: '50-200 employees' },
  { key: 'harbor-staffing', name: 'Harbor Demo Staffing', industries: ['office_admin', 'warehouse_logistics', 'customer_service'], stance: 'explicit', size: '200-500 employees' },
  { key: 'signal-software', name: 'Signal Demo Software', industries: ['technology'], stance: 'individual', size: '50-200 employees' },
  { key: 'cascade-data', name: 'Cascade Demo Data Labs', industries: ['technology'], stance: 'explicit', size: '10-50 employees' },
  { key: 'main-street-markets', name: 'Main Street Demo Markets', industries: ['retail'], stance: 'explicit', size: '1,000+ employees' },
  { key: 'trailhead-outfitters', name: 'Trailhead Demo Outfitters', industries: ['retail'], stance: 'waiting', size: '200-500 employees' },
];

// Fictional landlords / property managers. `regions` = market regions they list in (see markets.mjs).
export const OWNERS = [
  { key: 'lakeshore-residential', name: 'Lakeshore Demo Residential', regions: ['cleveland', 'other'] },
  { key: 'buckeye-property', name: 'Buckeye Demo Property Group', regions: ['cleveland', 'columbus'] },
  { key: 'olentangy-rentals', name: 'Olentangy Demo Rentals', regions: ['columbus', 'other'] },
  { key: 'capitol-rentals', name: 'Capitol Demo Rentals', regions: ['dc-md'] },
  { key: 'chesapeake-living', name: 'Chesapeake Demo Living', regions: ['dc-md', 'other'] },
  { key: 'potomac-homes', name: 'Potomac Demo Homes', regions: ['dc-md'] },
  { key: 'piedmont-homes', name: 'Piedmont Demo Homes', regions: ['other'] },
  { key: 'gulf-coast-properties', name: 'Gulf Coast Demo Properties', regions: ['other'] },
  { key: 'prairie-state-apartments', name: 'Prairie State Demo Apartments', regions: ['other', 'cleveland'] },
  { key: 'mountain-west-rentals', name: 'Mountain West Demo Rentals', regions: ['other'] },
];

export const employerEmail = (key) => `seed-employer-${key}@${SEED_EMAIL_DOMAIN}`;
export const ownerEmail = (key) => `seed-owner-${key}@${SEED_EMAIL_DOMAIN}`;
