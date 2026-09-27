// DEV-ONLY Resources fixtures. Fictional organizations and programs used to exercise the real product behavior:
// verified-only visibility, freshness (fresh / stale / expired), unverified + rejected + draft + retired states,
// urgent mode, local vs national vs virtual, cost, hours, eligibility, required documents, accessibility, and an
// area with no local coverage (empty state).
//
// PROVENANCE: every row carries data_origin = 'dev_fixture' and fixture_set = FIXTURE_SET, source_authority =
// 'test_fixture', URLs on the reserved .test TLD and 555-01xx phone numbers. The database refuses these rows unless
// app_config.environment = 'dev', so production cannot receive them. They are loaded ONLY by
// scripts/seed-dev-resources.mjs (DEV guards). None of these organizations is real.
//
// Freshness is relative to the seed run (fresh rows become stale ~6 months later): re-run the seed to refresh.
import { uuidv5 } from '../lib/uuid.mjs';

export const FIXTURE_SET = 'resources-v1';
const NS = 'resources-fixture:';
export const rid = (key) => uuidv5(NS + 'resource:' + key);
export const oid = (key) => uuidv5(NS + 'org:' + key);
const cid = (kind, key, n = 0) => uuidv5(`${NS}${kind}:${key}:${n}`);

// ZIP -> [city, state, lat, lng]. Approximate centres (DEV testing only).
export const ZIPS = {
  '44113': ['Cleveland', 'OH', 41.4835, -81.7046],
  '44105': ['Cleveland', 'OH', 41.4507, -81.6403],
  '44107': ['Lakewood', 'OH', 41.4739, -81.7982],
  '43215': ['Columbus', 'OH', 39.9612, -83.0007],
  '43204': ['Columbus', 'OH', 39.9515, -83.0705],
  '43229': ['Columbus', 'OH', 40.053, -82.96],
  '20001': ['Washington', 'DC', 38.912, -77.0177],
  '20020': ['Washington', 'DC', 38.858, -76.975],
  '21201': ['Baltimore', 'MD', 39.2967, -76.6262],
  '21217': ['Baltimore', 'MD', 39.3104, -76.641],
  '45202': ['Cincinnati', 'OH', 39.1031, -84.512], // deliberately NO local resources: empty-state / national-only market
};

const ORGS = [
  ['lakeshore-pantry', 'Lakeshore Community Pantry', 'nonprofit', false],
  ['harbor-shelter', 'Harbor Light Shelter Network', 'nonprofit', false],
  ['buckeye-workforce', 'Buckeye Workforce Partners', 'nonprofit', false],
  ['capital-legal', 'Capital Reentry Legal Clinic', 'nonprofit', false],
  ['chesapeake-alliance', 'Chesapeake Second Chance Alliance', 'nonprofit', false],
  ['tri-county-mobility', 'Tri-County Mobility Authority', 'government', false],
  ['midwest-benefits', 'Midwest State Benefits Office', 'government', false],
  ['clearpath-health', 'ClearPath Community Health', 'provider', false],
  ['national-id-line', 'National ID Access Line', 'nonprofit', true],
  ['opendoor-online', 'OpenDoor Learning Online', 'nonprofit', true],
  ['fresh-start-cu', 'Fresh Start Credit Union', 'provider', false],
  ['grace-street-kitchen', 'Grace Street Kitchen', 'faith', false],
  ['second-wind-biz', 'Second Wind Business Center', 'nonprofit', false],
  ['national-crisis-text', 'National Crisis Text Support', 'nonprofit', true],
  ['techbridge', 'TechBridge Devices', 'nonprofit', false],
  ['suited-closet', 'Suited for Work Closet', 'nonprofit', false],
];

const WEEKDAY = [1, 2, 3, 4, 5].map((d) => [d, '09:00', '17:00']);
const EVENINGS = [1, 2, 3, 4].map((d) => [d, '16:00', '20:00']);
const WEEKEND = [6, 0].map((d) => [d, '10:00', '14:00']);
const EVERYDAY_MEALS = [0, 1, 2, 3, 4, 5, 6].map((d) => [d, '11:00', '13:00']);
const H24 = 'h24';

// [key, org, title, summary, opts]
//   cats: first = primary category. mode: in_person|virtual|phone|hybrid. zips: local ZIPs (locations).
//   areas: extra service areas [type, value]. state: fresh|stale|expired|unverified|pending|rejected|retired
const R = [
  // ---- Food (Cleveland / Columbus / DC / Baltimore) ----
  ['pantry-cle-44113', 'lakeshore-pantry', 'Lakeshore Neighborhood Food Pantry', 'Free groceries for households in the Cleveland area. Walk in during open hours.', { cats: ['food'], zips: ['44113'], hours: WEEKDAY, cost: 'free', urgency: 2, access: 'Walk in during open hours. Bring a photo ID or a piece of mail with your address.', docs: [['photo_id', 'Photo ID or mail showing your address', true]], elig: [['residency', 'Cuyahoga County residents', true]], acc: ['wheelchair', 'transit_nearby'], areas: [['zip', '44105'], ['zip', '44107']] }],
  ['pantry-cle-stale', 'lakeshore-pantry', 'Eastside Emergency Food Shelf', 'Emergency food boxes on the east side of Cleveland.', { cats: ['food'], zips: ['44105'], hours: EVENINGS, cost: 'free', urgency: 2, state: 'stale', access: 'Call ahead for availability.' }],
  ['pantry-cle-expired', 'lakeshore-pantry', 'Old Warehouse Food Distribution', 'Monthly food distribution (information has not been reverified in a long time).', { cats: ['food'], zips: ['44113'], cost: 'free', urgency: 1, state: 'expired' }],
  ['kitchen-cle-meals', 'grace-street-kitchen', 'Grace Street Community Meals', 'Free hot meals every day, no questions asked.', { cats: ['food', 'emergency_help'], zips: ['44113'], hours: EVERYDAY_MEALS, cost: 'free', urgency: 2, acc: ['wheelchair', 'free_parking'], access: 'Just come during meal hours.' }],
  ['pantry-col-43204', 'lakeshore-pantry', 'Hilltop Family Pantry', 'Weekly groceries and produce for Columbus families.', { cats: ['food'], zips: ['43204'], hours: [...WEEKDAY, ...WEEKEND], cost: 'free', urgency: 2, acc: ['wheelchair', 'translation'], langs: ['en', 'es'], areas: [['zip', '43215']] }],
  ['kitchen-dc-20001', 'grace-street-kitchen', 'Shaw Community Table', 'Free dinner service in Northwest DC.', { cats: ['food'], zips: ['20001'], hours: EVENINGS, cost: 'free', urgency: 2 }],
  ['pantry-bal-21217', 'chesapeake-alliance', 'Druid Heights Food Access Center', 'Grocery assistance and SNAP enrollment help in Baltimore.', { cats: ['food', 'benefits'], zips: ['21217'], hours: WEEKDAY, cost: 'free', urgency: 1 }],
  ['pantry-unverified', 'lakeshore-pantry', 'Lakewood Pop-up Pantry (pending review)', 'A new pop-up pantry awaiting verification. Should never be shown to members.', { cats: ['food'], zips: ['44107'], cost: 'free', urgency: 2, state: 'pending' }],

  // ---- Shelter / emergency ----
  ['shelter-cle-24h', 'harbor-shelter', 'Harbor Light Emergency Shelter', 'Overnight shelter with intake open around the clock.', { cats: ['housing', 'emergency_help'], zips: ['44113'], hours: H24, cost: 'free', urgency: 2, access: 'Intake is open 24 hours. No appointment needed.', acc: ['wheelchair', 'transit_nearby'], elig: [['other', 'Adults 18 and older', true]] }],
  ['shelter-col-women', 'harbor-shelter', 'Riverbend Women and Children Shelter', 'Safe shelter for women with children. Referral or walk-in.', { cats: ['housing', 'emergency_help', 'family'], zips: ['43215'], hours: H24, cost: 'free', urgency: 2, elig: [['family', 'Women, with or without children', true]], acc: ['wheelchair', 'childcare'] }],
  ['shelter-dc-winter', 'harbor-shelter', 'Capitol Hill Winter Shelter', 'Seasonal overnight shelter. Confirm dates before you go.', { cats: ['housing', 'emergency_help'], zips: ['20020'], hours: EVENINGS, cost: 'free', urgency: 2, state: 'stale' }],
  ['housing-help-bal', 'chesapeake-alliance', 'Baltimore Rapid Rehousing Program', 'Short-term rent help and case management to move into stable housing.', { cats: ['housing'], zips: ['21201'], hours: WEEKDAY, cost: 'free', urgency: 1, elig: [['income', 'Household income below 50% of area median', true], ['residency', 'Baltimore City residents', true]], docs: [['photo_id', 'Photo ID', true], ['income_proof', 'Proof of income or a no-income statement', true], ['lease', 'Current lease or eviction notice', false]] }],
  ['housing-navigation-cle', 'harbor-shelter', 'Cleveland Housing Navigation Line', 'Talk to a navigator about shelter, rent help and next steps.', { cats: ['housing', 'emergency_help'], mode: 'phone', zips: [], national: false, areas: [['state', 'OH']], cost: 'free', urgency: 2, kind: 'hotline', hoursNote: 'Phone lines open 8am to 8pm daily.' }],
  ['crisis-text', 'national-crisis-text', 'Crisis Text Line (test)', 'Text with a trained counselor any time, any day.', { cats: ['emergency_help', 'health_wellness'], mode: 'phone', national: true, cost: 'free', urgency: 2, kind: 'hotline', hoursNote: 'Available 24/7.', acc: ['text_relay', 'screen_reader'] }],
  ['utility-assist-cle', 'tri-county-mobility', 'Northeast Ohio Utility Assistance', 'Help paying overdue electric and gas bills to stop a shut-off.', { cats: ['money', 'emergency_help'], zips: ['44105'], hours: WEEKDAY, cost: 'free', urgency: 2, access: 'Apply online or in person with your most recent bill.', appUrl: 'https://utility-assist.example.test/apply', docs: [['utility_bill', 'Most recent utility bill', true], ['photo_id', 'Photo ID', true]], elig: [['income', 'Household income below 150% of the federal poverty level', true]] }],

  // ---- ID and documents ----
  ['id-help-national', 'national-id-line', 'ID Access Guide (national)', 'Step-by-step help getting a state ID, birth certificate and Social Security card replacement.', { cats: ['id_documents'], mode: 'virtual', national: true, cost: 'free', urgency: 0, access: 'Start with the online guide, then call to schedule help.', appUrl: 'https://id-access.example.test/start', docs: [['any_id', 'Any current or expired ID', false]] }],
  ['id-clinic-cle', 'buckeye-workforce', 'Cleveland ID Clinic', 'Walk-in clinic that helps you collect documents and apply for a state ID.', { cats: ['id_documents'], zips: ['44113'], hours: EVENINGS, cost: 'free', urgency: 0, docs: [['birth_certificate', 'Birth certificate if you have it', false], ['release_papers', 'Release or discharge papers', false]], acc: ['wheelchair'] }],
  ['id-fee-waiver-col', 'midwest-benefits', 'Ohio ID Fee Waiver (Columbus)', 'Fee waiver for a state ID for people with no income.', { cats: ['id_documents', 'benefits'], zips: ['43215'], hours: WEEKDAY, cost: 'free', urgency: 0, elig: [['income', 'No income or receiving public assistance', true]] }],
  ['id-dc-help', 'capital-legal', 'DC Vital Records Assistance', 'Help ordering birth and marriage certificates for DC residents.', { cats: ['id_documents'], zips: ['20001'], hours: WEEKDAY, cost: 'sliding', costNotes: 'Fees waived for people with no income.', urgency: 0 }],

  // ---- Jobs / training / education ----
  ['workforce-cle', 'buckeye-workforce', 'Buckeye Job Readiness Program', 'Four-week job readiness, resume help and employer introductions.', { cats: ['jobs'], zips: ['44113', '44105'], hours: WEEKDAY, cost: 'free', urgency: 0, elig: [['justice_related', 'Open to people with a record', false]], acc: ['wheelchair', 'transit_nearby'], areas: [['zip', '44107']] }],
  ['workforce-col', 'buckeye-workforce', 'Columbus Skilled Trades Pre-Apprenticeship', 'Paid pre-apprenticeship in construction trades.', { cats: ['jobs', 'education'], zips: ['43229'], hours: WEEKDAY, cost: 'free', urgency: 0, elig: [['age_min', 'Ages 18 and up', true]], docs: [['photo_id', 'Photo ID', true], ['ged', 'High school diploma or GED (or enrolling)', false]] }],
  ['workforce-dc', 'chesapeake-alliance', 'DC Second Chance Career Center', 'One-on-one job coaching for people returning to the workforce.', { cats: ['jobs'], zips: ['20020'], hours: WEEKDAY, cost: 'free', urgency: 0 }],
  ['workforce-bal', 'chesapeake-alliance', 'Baltimore Warehouse and Logistics Training', 'Short forklift and logistics certifications with employer hiring events.', { cats: ['jobs', 'education'], zips: ['21201'], hours: WEEKDAY, cost: 'free', urgency: 0, state: 'stale' }],
  ['ged-online', 'opendoor-online', 'OpenDoor GED and Skills Online', 'Free self-paced GED prep and digital skills courses.', { cats: ['education', 'jobs'], mode: 'virtual', national: true, cost: 'free', urgency: 0, appUrl: 'https://opendoor.example.test/ged', acc: ['screen_reader', 'translation'], langs: ['en', 'es'] }],
  ['certs-paid', 'opendoor-online', 'Professional Certificate Bootcamp', 'Paid online certificate programs. Financing available.', { cats: ['education', 'jobs'], mode: 'virtual', national: true, cost: 'paid', costNotes: 'Program fees vary; payment plans offered.', urgency: 0 }],
  ['resume-help-virtual', 'buckeye-workforce', 'Virtual Resume and Interview Lab', 'Live online resume reviews and mock interviews.', { cats: ['jobs'], mode: 'virtual', areas: [['state', 'OH']], cost: 'free', urgency: 0, hoursNote: 'Live sessions Tuesday and Thursday evenings.' }],

  // ---- Legal / record relief ----
  ['legal-dc-clinic', 'capital-legal', 'Capital Record Sealing Clinic', 'Free legal help with record sealing and expungement.', { cats: ['legal_record_relief'], zips: ['20001'], hours: EVENINGS, cost: 'free', urgency: 0, elig: [['justice_related', 'People with a criminal record seeking relief', true]], docs: [['case_info', 'Case number or court records if you have them', false]], access: 'Book a clinic slot by phone.' }],
  ['legal-cle-aid', 'buckeye-workforce', 'Cuyahoga Legal Aid Intake', 'Intake for civil legal help including record sealing.', { cats: ['legal_record_relief'], zips: ['44113'], hours: WEEKDAY, cost: 'free', urgency: 0, elig: [['income', 'Income-qualified', true]] }],
  ['legal-online-guide', 'capital-legal', 'Record Relief Self-Help Guide', 'Plain-language guide to record relief options by state.', { cats: ['legal_record_relief'], mode: 'virtual', national: true, cost: 'free', urgency: 0, appUrl: 'https://record-help.example.test/guide' }],
  ['legal-unverified', 'capital-legal', 'Weekend Legal Walk-in (draft)', 'Draft listing submitted by a partner, not yet reviewed.', { cats: ['legal_record_relief'], zips: ['21201'], cost: 'free', urgency: 0, state: 'draft' }],

  // ---- Benefits ----
  ['snap-help-cle', 'midwest-benefits', 'SNAP and Medicaid Enrollment Help (Cleveland)', 'Get help applying for food assistance and health coverage.', { cats: ['benefits', 'food'], zips: ['44113'], hours: WEEKDAY, cost: 'free', urgency: 1, docs: [['photo_id', 'Photo ID', true], ['ssn', 'Social Security number', true]] }],
  ['benefits-online-oh', 'midwest-benefits', 'Ohio Benefits Online Portal Help', 'Apply for state benefits online with a guided walkthrough.', { cats: ['benefits'], mode: 'virtual', areas: [['state', 'OH']], cost: 'free', urgency: 0, appUrl: 'https://benefits.example.test/oh' }],
  ['benefits-bal', 'chesapeake-alliance', 'Maryland Benefits Navigator', 'In-person benefits navigation.', { cats: ['benefits'], zips: ['21217'], hours: WEEKDAY, cost: 'free', urgency: 0, state: 'unverified' }],

  // ---- Transportation ----
  ['transit-pass-cle', 'tri-county-mobility', 'Reduced-Fare Transit Pass (Cleveland)', 'Half-price monthly transit passes for eligible riders.', { cats: ['transportation'], zips: ['44113'], hours: WEEKDAY, cost: 'sliding', costNotes: 'Half fare for income-qualified riders.', urgency: 0, elig: [['income', 'Income-qualified', true]] }],
  ['transit-rides-col', 'tri-county-mobility', 'Columbus Job Ride Program', 'Free rides to job interviews and first weeks of work.', { cats: ['transportation', 'jobs'], zips: ['43215'], hours: WEEKDAY, cost: 'free', urgency: 1, access: 'Request a ride 48 hours ahead.' }],
  ['bikes-dc', 'chesapeake-alliance', 'Earn-a-Bike Program (DC)', 'Volunteer hours earn a refurbished bike.', { cats: ['transportation'], zips: ['20020'], hours: WEEKEND, cost: 'free', urgency: 0 }],
  ['license-restore', 'national-id-line', 'Driver License Reinstatement Guide', 'Understand fees and steps to reinstate a suspended license.', { cats: ['transportation', 'legal_record_relief'], mode: 'virtual', national: true, cost: 'free', urgency: 0 }],

  // ---- Health ----
  ['clinic-cle', 'clearpath-health', 'ClearPath Community Clinic (Cleveland)', 'Sliding-scale primary care, mental health and medication support.', { cats: ['health_wellness'], zips: ['44105'], hours: [...WEEKDAY, ...WEEKEND], cost: 'sliding', costNotes: 'Fees based on income. No one turned away.', urgency: 1, acc: ['wheelchair', 'asl', 'translation'], langs: ['en', 'es'] }],
  ['clinic-bal', 'clearpath-health', 'ClearPath Recovery Support (Baltimore)', 'Outpatient recovery groups and counseling.', { cats: ['health_wellness'], zips: ['21201'], hours: EVENINGS, cost: 'sliding', urgency: 1 }],
  ['telehealth', 'clearpath-health', 'ClearPath Telehealth Visits', 'Video visits with a nurse practitioner.', { cats: ['health_wellness'], mode: 'virtual', areas: [['state', 'OH'], ['state', 'MD']], cost: 'sliding', urgency: 0 }],

  // ---- Money / banking / credit ----
  ['bank-second-chance', 'fresh-start-cu', 'Fresh Start Second-Chance Checking', 'A checking account for people with past banking problems.', { cats: ['banking', 'money'], zips: ['43215'], hours: WEEKDAY, cost: 'free', urgency: 0, access: 'Open an account in person or online.', appUrl: 'https://freshstart.example.test/open' }],
  ['credit-builder', 'fresh-start-cu', 'Credit Builder Loan', 'A small loan that builds your credit history as you repay.', { cats: ['credit', 'money'], mode: 'hybrid', zips: ['43215'], areas: [['state', 'OH']], hours: WEEKDAY, cost: 'paid', costNotes: 'Small monthly fee and interest.', urgency: 0 }],
  ['financial-coach', 'fresh-start-cu', 'Free Financial Coaching', 'Budgeting and debt coaching by phone.', { cats: ['money', 'credit'], mode: 'phone', national: true, cost: 'free', urgency: 0 }],

  // ---- Family / clothing / technology / business ----
  ['childcare-cle', 'harbor-shelter', 'Childcare Subsidy Navigation', 'Help applying for childcare assistance.', { cats: ['family', 'benefits'], zips: ['44107'], hours: WEEKDAY, cost: 'free', urgency: 0, acc: ['childcare'] }],
  ['closet-cle', 'suited-closet', 'Suited for Work Clothing Closet', 'Free interview and work clothing.', { cats: ['clothing', 'jobs'], zips: ['44113'], hours: WEEKDAY, cost: 'free', urgency: 0, access: 'Appointments recommended.' }],
  ['closet-col', 'suited-closet', 'Columbus Work Clothing Closet', 'Free interview outfits and work boots.', { cats: ['clothing'], zips: ['43204'], hours: EVENINGS, cost: 'free', urgency: 0 }],
  ['tech-devices', 'techbridge', 'Refurbished Laptops and Phones', 'Low-cost refurbished devices for job search and school.', { cats: ['technology'], zips: ['43229'], hours: WEEKDAY, cost: 'sliding', urgency: 0 }],
  ['tech-internet', 'techbridge', 'Home Internet Assistance', 'Help enrolling in discounted home internet.', { cats: ['technology', 'benefits'], mode: 'virtual', national: true, cost: 'free', urgency: 0 }],
  ['biz-center', 'second-wind-biz', 'Second Wind Startup Workshop', 'Business plan workshops and micro-loans for people with records.', { cats: ['entrepreneurship'], zips: ['44113'], hours: EVENINGS, cost: 'free', urgency: 0, elig: [['justice_related', 'Open to people with a record', false]] }],
  ['biz-online', 'second-wind-biz', 'Online Business Bootcamp', 'Self-paced business basics course.', { cats: ['entrepreneurship', 'education'], mode: 'virtual', national: true, cost: 'free', urgency: 0, appUrl: 'https://secondwind.example.test/bootcamp' }],

  // ---- State-lifecycle edge cases ----
  ['rejected-example', 'lakeshore-pantry', 'Unverifiable Cash Loan Offer (rejected)', 'A submission that failed verification. Must never reach members.', { cats: ['money'], zips: ['44113'], cost: 'paid', urgency: 0, state: 'rejected' }],
  ['retired-example', 'grace-street-kitchen', 'Closed Community Dinner (retired)', 'A program that has closed.', { cats: ['food'], zips: ['43215'], cost: 'free', urgency: 1, state: 'retired' }],
  ['no-hours-verified', 'buckeye-workforce', 'Job Coaching by Appointment', 'Coaching by appointment only; no walk-in hours.', { cats: ['jobs'], zips: ['43215'], cost: 'free', urgency: 0, access: 'Call to schedule.' }],
  ['radius-only', 'tri-county-mobility', 'Mobile Vaccination Van (radius service)', 'A mobile van serving locations within 15 miles of downtown Columbus.', { cats: ['health_wellness'], mode: 'in_person', zips: [], radiusAreas: [[39.9612, -83.0007, 15]], cost: 'free', urgency: 0 }],
];

const iso = (d) => d.toISOString();
const addDays = (now, n) => new Date(now.getTime() + n * 86400000);

/** Build every row deterministically. `now` = seed time. */
export function buildResourceFixtures(now = new Date()) {
  const rows = { orgs: [], resources: [], links: [], locations: [], areas: [], hours: [], eligibility: [], contacts: [], docs: [], events: [], postalCodes: [] };

  for (const [key, name, type, national] of ORGS) {
    rows.orgs.push({
      id: oid(key), name, slug: key, org_type: type, website_url: `https://${key}.example.test`,
      description: `${name} is a fictional organization used for FairPath DEV testing.`,
      is_national: national, status: 'active', data_origin: 'dev_fixture', fixture_set: FIXTURE_SET,
    });
  }

  const usedZips = new Set();
  let phone = 100;

  for (const [key, org, title, summary, o] of R) {
    const id = rid(key);
    const state = o.state ?? 'fresh';
    const verified = ['fresh', 'stale', 'expired'].includes(state);
    const lastVerified = state === 'fresh' ? addDays(now, -20) : state === 'stale' ? addDays(now, -200) : state === 'expired' ? addDays(now, -520) : null;
    const verifyBy = state === 'fresh' ? addDays(now, 160) : state === 'stale' ? addDays(now, -20) : state === 'expired' ? addDays(now, -340) : null;
    const publish = verified ? 'published' : state === 'pending' ? 'pending_review' : state === 'retired' ? 'retired' : 'draft';
    const isNational = Boolean(o.national);

    rows.resources.push({
      id, organization_id: oid(org), title, summary,
      description: `${summary} This is a fictional DEV test record: ${title}. It exists to exercise search, filters, freshness and detail screens.`,
      resource_kind: o.kind ?? 'program', delivery_mode: o.mode ?? 'in_person', is_national: isNational,
      cost_type: o.cost ?? 'unknown', cost_notes: o.costNotes ?? null, urgency_tier: o.urgency ?? 0,
      eligibility_summary: (o.elig ?? []).length ? o.elig.map((e) => e[1]).join('; ') : 'Open to everyone.',
      how_to_access: o.access ?? 'Contact the organization for the next step.',
      application_url: o.appUrl ?? null, official_source_url: `https://${org}.example.test/${key}`,
      source_authority: 'test_fixture', publish_status: publish,
      verification_state: verified ? 'verified' : state === 'rejected' ? 'rejected' : 'unverified',
      last_verified_at: lastVerified ? iso(lastVerified) : null, verify_by: verifyBy ? iso(verifyBy) : null,
      languages: o.langs ?? ['en'], accessibility: o.acc ?? [], hours_note: o.hoursNote ?? null,
      data_origin: 'dev_fixture', fixture_set: FIXTURE_SET,
    });

    (o.cats ?? []).forEach((slug, i) => rows.links.push({ resource_id: id, category_slug: slug, is_primary: i === 0 }));

    (o.zips ?? []).forEach((zip, i) => {
      const [city, st, lat, lng] = ZIPS[zip];
      usedZips.add(zip);
      const locId = cid('loc', key, i);
      rows.locations.push({
        id: locId, resource_id: id, label: i === 0 ? 'Main location' : `Site ${i + 1}`,
        address_line: `${100 + i * 20} Example Ave`, city, state_code: st, postal_code: zip,
        latitude: lat + i * 0.004, longitude: lng - i * 0.004, phone: `(555) 010-${String(phone++).padStart(4, '0')}`,
        timezone: 'America/New_York', is_virtual: false, accessibility: o.acc ?? [],
      });
      const schedule = o.hours;
      if (schedule === H24) for (let d = 0; d <= 6; d++) rows.hours.push({ id: cid('hr', `${key}-${i}`, d), location_id: locId, weekday: d, opens_at: null, closes_at: null, is_24h: true, note: null });
      else if (Array.isArray(schedule)) schedule.forEach(([d, a, b], n) => rows.hours.push({ id: cid('hr', `${key}-${i}`, n), location_id: locId, weekday: d, opens_at: a, closes_at: b, is_24h: false, note: null }));
    });

    if ((o.mode === 'virtual' || o.mode === 'phone') && !(o.zips ?? []).length) {
      rows.locations.push({ id: cid('loc', key, 0), resource_id: id, label: o.mode === 'phone' ? 'By phone' : 'Online', is_virtual: true, timezone: 'America/New_York', accessibility: o.acc ?? [] });
    }

    if (isNational) rows.areas.push({ id: cid('area', key, 0), resource_id: id, area_type: 'national' });
    (o.areas ?? []).forEach(([type, value], i) => {
      const a = { id: cid('area', key, i + 1), resource_id: id, area_type: type };
      if (type === 'zip') { a.postal_code = value; usedZips.add(value); } else if (type === 'state') a.state_code = value;
      rows.areas.push(a);
    });
    (o.radiusAreas ?? []).forEach(([lat, lng, miles], i) => rows.areas.push({ id: cid('area', key, 50 + i), resource_id: id, area_type: 'radius', center_latitude: lat, center_longitude: lng, radius_miles: miles }));

    (o.elig ?? []).forEach(([type, description, hard], i) => rows.eligibility.push({ id: cid('elig', key, i), resource_id: id, rule_type: type, rule_value: {}, description, is_hard: hard }));
    (o.docs ?? []).forEach(([type, description, req], i) => rows.docs.push({ id: cid('doc', key, i), resource_id: id, document_type: type, description, is_required: req }));

    rows.contacts.push({ id: cid('contact', key, 0), resource_id: id, method: 'phone', value: `(555) 010-${String(phone++).padStart(4, '0')}`, label: 'Main line', is_primary: true });
    rows.contacts.push({ id: cid('contact', key, 1), resource_id: id, method: 'url', value: `https://${org}.example.test/${key}`, label: 'Website', is_primary: false });

    if (verified) rows.events.push({ id: cid('event', key, 0), resource_id: id, event_type: state === 'fresh' ? 'verified' : 'reverified', source_checked_url: `https://${org}.example.test/${key}`, notes: 'DEV fixture verification record.', created_at: iso(lastVerified) });
    if (state === 'rejected') rows.events.push({ id: cid('event', key, 0), resource_id: id, event_type: 'rejected', notes: 'DEV fixture: failed verification.', created_at: iso(addDays(now, -3)) });
    if (state === 'stale') rows.events.push({ id: cid('event', key, 1), resource_id: id, event_type: 'flagged_stale', notes: 'DEV fixture: past its verify-by date.', created_at: iso(addDays(now, -10)) });
  }

  for (const zip of usedZips) {
    const [city, st, lat, lng] = ZIPS[zip];
    rows.postalCodes.push({ postal_code: zip, latitude: lat, longitude: lng, city, state_code: st, source: 'dev-seed-resources' });
  }
  // The empty-state market needs a ZIP centre even though no resource is located there.
  if (!usedZips.has('45202')) {
    const [city, st, lat, lng] = ZIPS['45202'];
    rows.postalCodes.push({ postal_code: '45202', latitude: lat, longitude: lng, city, state_code: st, source: 'dev-seed-resources' });
  }
  return rows;
}

export function summarizeResourceFixtures(rows) {
  const by = {};
  for (const r of rows.resources) {
    const k = `${r.verification_state}/${r.publish_status}`;
    by[k] = (by[k] ?? 0) + 1;
  }
  return { organizations: rows.orgs.length, resources: rows.resources.length, byState: by, locations: rows.locations.length, serviceAreas: rows.areas.length, hours: rows.hours.length, contacts: rows.contacts.length };
}
