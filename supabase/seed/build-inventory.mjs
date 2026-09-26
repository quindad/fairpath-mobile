// Deterministic DEV inventory generator. Pure: no network, no clock, no filesystem.
//
//   buildInventory({ seed })  -> { users, jobs, listings, media, offenses, flags }
//   materializeJob / materializeListing apply real user ids and real timestamps at write time.
//
// Rows use the real database column names. Keys starting with "_" are seed metadata (industry, market,
// employer key, time offsets) and are stripped by materialize*(). Same seed => byte-identical output.

import { makeRng, hashString, slugify } from './lib/rng.mjs';
import { uuidv5 } from './lib/uuid.mjs';
import { MARKETS } from './data/markets.mjs';
import { EMPLOYERS, OWNERS, employerEmail, ownerEmail } from './data/accounts.mjs';
import { INDUSTRIES, INDUSTRY_LABEL, SCHEDULES, JOB_TEMPLATES, INDUSTRY_DUTIES, BENEFIT_POOL, QUESTION_POOL } from './data/job-templates.mjs';
import * as H from './data/housing-data.mjs';
import { OFFENSE_POOL, OFFENSE_JURISDICTIONS, OFFENSE_SOURCE_AGENCY, OFFENSE_SOURCE_URL, OFFENSE_EFFECTIVE_START } from './data/offenses.mjs';

export const SEED_LABEL = 'FairPath DEV Seed';
export const SEED_VERSION = 1;
export const DEFAULT_RNG_SEED = 20260926;
const DAY = 86400000;

const r4 = (n) => Math.round(n * 10000) / 10000;
const round = (n, step) => Math.round(n / step) * step;

function locate(market, zipEntry) {
  const [zip, neighborhood, cityOverride] = zipEntry;
  const h = hashString(market.key + zip);
  const dLat = ((h & 0xffff) / 0xffff - 0.5) * 0.07;
  const dLng = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 0.09;
  return { zip, neighborhood, city: cityOverride || market.city, state: market.state, lat: r4(market.lat + dLat), lng: r4(market.lng + dLng) };
}

// ------------------------------------------------------------------------------------------------
// Users (real auth accounts are created by the runner via the Auth Admin API)
// ------------------------------------------------------------------------------------------------
function buildUsers() {
  const employers = EMPLOYERS.map((e) => ({
    kind: 'employer', key: e.key, email: employerEmail(e.key),
    user_metadata: { first_name: 'Demo', last_name: 'Employer', account_type: 'employer', company_name: e.name, dev_seed: true },
  }));
  const owners = OWNERS.map((o) => ({
    kind: 'owner', key: o.key, email: ownerEmail(o.key),
    user_metadata: { first_name: 'Demo', last_name: 'Property Manager', account_type: 'property_owner', company_name: o.name, dev_seed: true },
  }));
  return [...employers, ...owners];
}

// ------------------------------------------------------------------------------------------------
// Jobs
// ------------------------------------------------------------------------------------------------
const POLICY_TEXT = {
  explicit: [
    'We are a fair-chance employer. We consider all qualified applicants, including people with criminal records, and review convictions individually for job-relatedness after a conditional offer.',
    'Second-chance hiring is part of how we operate: background checks happen after a conditional offer and only relevant convictions are considered.',
    'People with a criminal history are welcome to apply. A conviction is not an automatic disqualifier.',
  ],
  individual: [
    'Criminal history is reviewed case by case, considering the nature of the offense, time passed and relevance to the role.',
    'Background checks are run after a conditional offer. Decisions are individualized and applicants can provide context.',
  ],
};

function weekWord(unit) { return unit === 'hour' ? 'hour' : unit === 'week' ? 'week' : 'year'; }

function buildJobs(rng) {
  const industryOrder = rng.shuffle(INDUSTRIES);
  const templatesBy = Object.fromEntries(INDUSTRIES.map((i) => [i, rng.shuffle(JOB_TEMPLATES.filter((t) => t.industry === i))]));
  const employersBy = Object.fromEntries(INDUSTRIES.map((i) => [i, rng.shuffle(EMPLOYERS.filter((e) => e.industries.includes(i)))]));
  const tPtr = Object.fromEntries(INDUSTRIES.map((i) => [i, 0]));
  const ePtr = Object.fromEntries(INDUSTRIES.map((i) => [i, 0]));
  const used = new Map();
  const jobs = [];
  let k = 0;

  for (const market of MARKETS) {
    for (let i = 0; i < market.jobs; i++, k++) {
      const industry = industryOrder[k % industryOrder.length];
      const t = templatesBy[industry][tPtr[industry]++ % templatesBy[industry].length];
      const emp = employersBy[industry][ePtr[industry]++ % employersBy[industry].length];
      const loc = locate(market, market.zips[i % market.zips.length]);

      // workplace
      const wp = t.wp === 'O' ? 'onsite'
        : t.wp === 'OH' ? rng.weighted([['onsite', 75], ['hybrid', 25]])
        : t.wp === 'ROH' ? rng.weighted([['remote', 40], ['hybrid', 30], ['onsite', 30]])
        : rng.weighted([['remote', 70], ['hybrid', 30]]);
      const remote = wp === 'remote';

      // pay
      const f = market.wage * rng.stepped(0.96, 1.06, 0.01);
      const step = t.unit === 'hour' ? 0.25 : t.unit === 'week' ? 25 : 500;
      const pay_min = round(t.min * f, step);
      let pay_max = round(t.max * f, step);
      if (pay_max <= pay_min) pay_max = pay_min + step;

      // fair-chance metadata
      const stance = emp.stance;
      const evidence = stance === 'explicit' || stance === 'restricted' ? 'explicit' : stance === 'individual' ? (rng.chance(0.5) ? 'explicit' : 'none') : stance === 'waiting' ? (rng.chance(0.5) ? 'explicit' : 'none') : 'none';
      const waitingYears = rng.int(2, 7);
      const excluded = stance !== 'restricted' ? [] : emp.key === 'riverbend-care' ? ['violence', 'sex_offenses', 'fraud_financial'] : ['driving_vehicle', 'drugs'];
      const policyCode = stance === 'explicit' ? 'considered' : stance === 'waiting' ? 'considered_after_years' : stance === 'standard' ? null : 'individual_review';
      let policyText = null;
      if (stance === 'explicit') policyText = rng.pick(POLICY_TEXT.explicit);
      else if (stance === 'individual') policyText = rng.pick(POLICY_TEXT.individual);
      else if (stance === 'waiting') policyText = `Convictions older than ${waitingYears} years are generally not considered. More recent history is reviewed individually.`;
      else if (stance === 'restricted') policyText = `Fair-chance employer. Certain offense types (${excluded.map((c) => c.replace('_', ' ')).join(', ')}) may be disqualifying for this role because of job-related safety or legal requirements; all other history is reviewed individually.`;

      const eligibility_rules = { second_chance_evidence: evidence };
      if (policyCode) eligibility_rules.conviction_policy = policyCode;
      if (stance === 'waiting') { eligibility_rules.waiting_years = waitingYears; eligibility_rules.waiting_anchor = 'release_date'; }
      if (excluded.length) eligibility_rules.excluded_categories = excluded;
      eligibility_rules.seed = { version: SEED_VERSION, taxonomy: 'provisional-v1', note: 'DEV test rule metadata; only second_chance_evidence is consumed by the app today' };

      // text
      const duties = rng.sample(INDUSTRY_DUTIES[industry], 3);
      const sched = rng.sample(SCHEDULES[t.sched], rng.int(1, 2));
      const isRemoteLine = remote ? 'This role is remote (US).' : wp === 'hybrid' ? 'This role is hybrid: part on-site, part remote.' : `Located in ${loc.neighborhood}, ${loc.city}, ${loc.state}.`;
      const description = `${emp.name} is hiring a ${t.title}. ${t.summary}\n\nWhat you'll do:\n${duties.map((d) => '- ' + d).join('\n')}\n\nSchedule: ${sched.join(', ')}. ${isRemoteLine}\n\nDEV test data - not a real employer or posting.`;
      const requirements = [];
      if (!/^No formal/.test(t.edu)) requirements.push(t.edu);
      if (t.exp !== 'Entry level') requirements.push(`Experience: ${t.exp}`);
      requirements.push(...t.certs);
      if (!remote) requirements.push('Reliable transportation to the work site');
      const partTime = t.type === 'part_time' || t.type === 'gig';
      const benefits = rng.sample(BENEFIT_POOL, partTime ? rng.int(0, 3) : rng.int(3, 6));

      // application path
      const external = rng.chance(t.type === 'gig' || t.type === 'contract' ? 0.5 : 0.2);
      const questions = external ? [] : rng.sample(QUESTION_POOL[industry], rng.int(0, 2));

      const combo = `${emp.key}|${t.key}|${loc.zip}`;
      const n = used.get(combo) ?? 0;
      used.set(combo, n + 1);
      const id = uuidv5(`job|${combo}|${n}`);
      const jobSlug = slugify(`${t.title}-${loc.city}-${n}`);

      jobs.push({
        id,
        title: t.title,
        company_name: emp.name,
        description,
        location_text: remote ? 'Remote (US)' : `${loc.city}, ${loc.state} ${loc.zip}`,
        workplace_type: wp,
        employment_type: t.type,
        pay_min,
        pay_max,
        pay_period: t.unit,
        currency: 'USD',
        schedule: sched,
        benefits,
        skills: t.skills,
        requirements,
        education_requirement: t.edu,
        experience_level: t.exp,
        background_policy_summary: policyText,
        eligibility_rules,
        application_method: external ? 'external' : 'fairpath',
        external_apply_url: external ? `https://example.com/fairpath-dev-seed/careers/${emp.key}/${jobSlug}` : null,
        status: 'published',
        featured: rng.chance(0.1),
        source_label: SEED_LABEL,
        source_url: null,
        city: remote ? null : loc.city,
        state: loc.state,
        postal_code: remote ? null : loc.zip,
        latitude: remote ? null : loc.lat,
        longitude: remote ? null : loc.lng,
        location_precision: remote ? 'remote' : 'city',
        easy_apply_enabled: !external,
        application_questions: questions,
        company_website_url: `https://example.com/fairpath-dev-seed/employers/${emp.key}`,
        _employerKey: emp.key,
        _industry: industry,
        _marketKey: market.key,
        _region: market.region,
        _publishedDaysAgo: rng.int(0, 20),
        _expiresInDays: rng.int(25, 75),
      });
    }
  }
  return jobs;
}

// ------------------------------------------------------------------------------------------------
// Housing
// ------------------------------------------------------------------------------------------------
function buildHousing(rng) {
  const listings = [];
  const media = [];
  const used = new Map();

  for (const market of MARKETS) {
    const owners = OWNERS.filter((o) => o.regions.includes(market.region));
    for (let i = 0; i < market.housing; i++) {
      const loc = locate(market, market.zips[i % market.zips.length]);
      const owner = rng.pick(owners);
      const kindDef = rng.weighted(H.KINDS.map((x) => [x, x.weight]));
      const beds = rng.int(kindDef.beds[0], kindDef.beds[1]);
      const baths = beds <= 1 ? 1 : beds === 2 ? rng.pick([1, 1.5, 2]) : beds === 3 ? rng.pick([1.5, 2, 2.5]) : rng.pick([2, 2.5, 3]);
      const kind = kindDef.kind;

      let rent = H.BASE_RENT_BY_BEDS[beds] * market.rent * rng.stepped(0.9, 1.1, 0.01);
      if (kind === 'room') rent = Math.max(450, rent * 0.55);
      if (kind === 'house' || kind === 'condo') rent *= 1.05;
      rent = round(rent, 25);
      const depositChoice = rng.weighted([['none', 5], ['half', 20], ['full', 55], ['oneHalf', 10], ['unset', 10]]);
      const deposit_amount = depositChoice === 'none' ? 0 : depositChoice === 'half' ? round(rent / 2, 25) : depositChoice === 'full' ? rent : depositChoice === 'oneHalf' ? round(rent * 1.5, 25) : null;
      const application_fee = rng.chance(0.05) ? null : rng.weighted([[0, 15], [25, 20], [35, 25], [45, 20], [50, 20]]);
      const square_feet = kind === 'room' ? round(rng.int(140, 220), 10) : round(H.BASE_SQFT_BY_BEDS[beds] * rng.stepped(0.88, 1.15, 0.01), 10);

      const yard = kind === 'house' ? rng.chance(0.8) : kind === 'duplex' ? rng.chance(0.45) : kind === 'townhome' ? rng.chance(0.25) : false;
      const basement = kind === 'house' ? rng.chance(0.5) : kind === 'duplex' ? rng.chance(0.35) : false;
      const balcony = kind === 'apartment' || kind === 'condo' || kind === 'studio' ? rng.chance(0.45) : kind === 'townhome' ? rng.chance(0.3) : false;
      const garage = kind === 'house' ? (rng.chance(0.6) ? rng.int(1, 2) : 0) : kind === 'townhome' ? (rng.chance(0.5) ? 1 : 0) : 0;
      const isMulti = kind === 'apartment' || kind === 'studio' || kind === 'condo';
      const parking_types = garage ? (kind === 'house' ? ['garage', 'driveway'] : ['garage']) : kind === 'house' || kind === 'duplex' ? ['driveway'] : isMulti ? [rng.chance(0.7) ? 'lot' : 'street'] : ['street'];
      const parking = garage ? `${garage}-car garage${parking_types.includes('driveway') ? ' plus driveway' : ''}` : parking_types.includes('driveway') ? 'Driveway parking' : parking_types.includes('lot') ? 'Off-street parking lot' : 'Street parking';
      const laundry = rng.pick(isMulti ? ['On-site', 'On-site', 'In-unit', 'Hookups', null] : ['In-unit', 'Hookups', 'Hookups', null]);
      const pet = rng.weighted(H.PET_POLICIES.map((p) => [p, p.w]));
      const screening = rng.pick(H.SCREENING);
      const docs = rng.weighted(H.REQUIRED_DOCS.map((d) => [d, d.w])).docs;
      const amenities = [...new Set([...rng.sample(H.AMENITIES_COMMON, rng.int(3, 5)), ...rng.sample(isMulti ? H.AMENITIES_APARTMENT : H.AMENITIES_HOUSE, 2)])];
      const availableInDays = rng.int(0, 75);
      const hasTour = rng.chance(0.3);

      const adj = rng.chance(0.55) ? rng.pick(H.ADJECTIVES) + ' ' : '';
      const bedLabel = beds === 0 ? 'Studio' : `${beds}BR`;
      const title = kind === 'room' ? `${adj}Furnished Private Room in ${loc.neighborhood}`
        : kind === 'studio' ? `${adj}Studio in ${loc.neighborhood}`
        : `${adj}${bedLabel} ${kindDef.label} in ${loc.neighborhood}`.trim();
      const street = `${rng.int(100, 4999)} ${rng.pick(H.STREETS)}`;
      const combo = `${owner.key}|${loc.zip}|${kind}|${beds}`;
      const n = used.get(combo) ?? 0;
      used.set(combo, n + 1);
      const id = uuidv5(`housing|${combo}|${n}`);
      const slug = slugify(`${title}-${loc.zip}-${n}`);

      listings.push({
        id,
        title,
        description: `${title}. ${bedLabel === 'Studio' ? 'Efficient open layout' : `${bedLabel} / ${baths} bath`} in ${loc.neighborhood}, ${loc.city}. ${amenities.slice(0, 3).join(', ')}. Managed by ${owner.name}.\n\nDEV test listing - not a real property.`,
        property_type: kindDef.db,
        address_line1: `[TEST] ${street}`,
        address_line2: isMulti && rng.chance(0.3) ? `Unit ${rng.int(1, 40)}` : null,
        city: loc.city,
        state: loc.state,
        postal_code: loc.zip,
        latitude: loc.lat,
        longitude: loc.lng,
        bedrooms: beds,
        bathrooms: baths,
        square_feet,
        rent_monthly: rent,
        deposit_amount,
        application_fee,
        lease_terms: rng.pick(H.LEASE_TERMS),
        amenities,
        utilities_included: kind === 'room' ? ['Water', 'Electric', 'Internet'] : rng.sample(H.UTILITIES, rng.int(0, 4)),
        pet_policy: pet.text,
        parking,
        accessibility_features: rng.chance(0.14) ? rng.sample(['Step-free entry', 'Elevator access', 'Wheelchair-accessible unit', 'Grab bars in bathroom', 'Wide doorways'], rng.int(1, 2)) : [],
        screening_summary: screening.text,
        eligibility_rules: {
          second_chance_evidence: screening.evidence,
          conviction_policy: screening.policy,
          ...(screening.lookback ? { lookback_years: screening.lookback } : {}),
          seed: { version: SEED_VERSION, taxonomy: 'provisional-v1', note: 'DEV test rule metadata; not consumed by the app yet' },
        },
        virtual_tour_url: hasTour ? `https://example.com/fairpath-dev-seed/tours/${slug}` : null,
        tour_provider: hasTour ? SEED_LABEL : null,
        floor_plan_url: rng.chance(0.25) ? `https://example.com/fairpath-dev-seed/floorplans/${slug}.pdf` : null,
        video_url: rng.chance(0.2) ? `https://example.com/fairpath-dev-seed/videos/${slug}` : null,
        fasttrack_enabled: rng.chance(0.45),
        status: 'published',
        featured: rng.chance(0.08),
        source_label: SEED_LABEL,
        source_url: null,
        garage_spaces: garage,
        parking_types,
        furnished: kind === 'room' ? true : rng.chance(0.06),
        has_basement: basement,
        has_yard: yard,
        has_balcony_patio: balcony,
        laundry_type: laundry,
        has_central_air: rng.chance(0.65),
        pet_types: pet.types,
        move_in_ready: availableInDays <= 10 && rng.chance(0.7),
        // walk_score / transit_score / bike_score / neighborhood_data_provider intentionally omitted (NULL):
        // no fabricated provider data.
        required_application_documents: docs,
        _ownerKey: owner.key,
        _marketKey: market.key,
        _region: market.region,
        _kind: kind,
        _availableInDays: availableInDays,
      });

      const photos = rng.sample(H.PHOTO_POOL, rng.int(3, 6));
      photos.forEach((url, idx) => media.push({
        id: uuidv5(`housing_media|${id}|${idx}`),
        listing_id: id,
        media_type: 'photo',
        url,
        sort_order: idx,
        caption: H.PHOTO_CAPTIONS[idx % H.PHOTO_CAPTIONS.length],
      }));
    }
  }
  return { listings, media };
}

// ------------------------------------------------------------------------------------------------
// Offense catalog, flags
// ------------------------------------------------------------------------------------------------
function buildOffenses(rng) {
  const categories = [...new Set(OFFENSE_POOL.map((o) => o[0]))];
  const rows = [];
  for (const [name, stateCode, jtype, extras] of OFFENSE_JURISDICTIONS) {
    const chosen = categories.map((c) => rng.pick(OFFENSE_POOL.filter((o) => o[0] === c)));
    const rest = OFFENSE_POOL.filter((o) => !chosen.includes(o));
    const picked = [...chosen, ...rng.sample(rest, extras)];
    picked.forEach(([category, title, level, aliases], idx) => {
      const prefix = stateCode || 'US';
      const cls = stateCode === 'OH' ? (level === 'felony' ? rng.pick(['F1', 'F2', 'F3', 'F4', 'F5']) : rng.pick(['M1', 'M2', 'M3', 'M4'])) : null;
      rows.push({
        jurisdiction_type: jtype,
        state_code: stateCode,
        jurisdiction_name: name,
        offense_code: `DEV-${prefix}-${String(idx + 1).padStart(3, '0')}`,
        offense_title: title,
        offense_level: level,
        offense_degree: null,
        offense_class: cls,
        offense_category: category,
        description: `Test catalog entry (${category}). Not a statute citation.`,
        source_agency: OFFENSE_SOURCE_AGENCY,
        source_url: OFFENSE_SOURCE_URL,
        effective_start: OFFENSE_EFFECTIVE_START,
        active: true,
        aliases,
        search_terms: [...new Set([title.toLowerCase(), category.toLowerCase(), ...aliases.map((a) => a.toLowerCase())])],
        last_verified_at: null,
      });
    });
  }
  return rows;
}

// Flags the seed guarantees EXIST (inserted only if missing; existing values are never overwritten).
export const FLAGS = [
  { key: 'marketplace_enabled', enabled: true, description: 'FairPath Marketplace (free-forever, locked into V1 per the Master Blueprint).' },
  { key: 'fairpath_ai_enabled', enabled: false, description: 'FairPath AI tools screen - currently a static menu with no backend/AI gateway.' },
  { key: 'credit_builder_enabled', enabled: false, description: 'Credit Builder - currently a static page with no backend.' },
  { key: 'record_relief_enabled', enabled: false, description: 'Record Relief / Forms & Filing - currently static pages with no backend.' },
  { key: 'justice_eligibility_engine_enabled', enabled: false, description: 'Gates production use of the provisional offense taxonomy. Must stay false until legal review. The seed never enables it.' },
];

// ------------------------------------------------------------------------------------------------
export function buildInventory({ seed = DEFAULT_RNG_SEED } = {}) {
  const rng = makeRng(seed);
  const users = buildUsers();
  const jobs = buildJobs(rng);
  const { listings, media } = buildHousing(rng);
  const offenses = buildOffenses(rng);
  return { seed, users, jobs, listings, media, offenses, flags: FLAGS };
}

export function summarize(inv) {
  const count = (rows, f) => rows.reduce((m, r) => (m[f(r)] = (m[f(r)] || 0) + 1, m), {});
  const zips = (rows) => new Set(rows.map((r) => r.postal_code).filter(Boolean)).size;
  return {
    users: inv.users.length,
    jobs: inv.jobs.length,
    listings: inv.listings.length,
    media: inv.media.length,
    offenses: inv.offenses.length,
    jobsByIndustry: count(inv.jobs, (j) => j._industry),
    jobsByRegion: count(inv.jobs, (j) => j._region),
    jobsByState: count(inv.jobs, (j) => j.state),
    jobsByWorkplace: count(inv.jobs, (j) => j.workplace_type),
    jobsByType: count(inv.jobs, (j) => j.employment_type),
    jobsByPayUnit: count(inv.jobs, (j) => j.pay_period),
    jobsBySecondChance: count(inv.jobs, (j) => j.eligibility_rules.second_chance_evidence),
    listingsByRegion: count(inv.listings, (l) => l._region),
    listingsByState: count(inv.listings, (l) => l.state),
    listingsByKind: count(inv.listings, (l) => l._kind),
    listingsFastTrack: inv.listings.filter((l) => l.fasttrack_enabled).length,
    jobZips: zips(inv.jobs),
    listingZips: zips(inv.listings),
    markets: [...new Set([...inv.jobs, ...inv.listings].map((x) => x._marketKey))].length,
  };
}

// ------------------------------------------------------------------------------------------------
// Materialization: attach REAL auth user ids and timestamps. Strips "_" metadata keys.
// ------------------------------------------------------------------------------------------------
const strip = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_')));

export function materializeJob(job, employerId, now = Date.now()) {
  const published = new Date(now - job._publishedDaysAgo * DAY).toISOString();
  return { ...strip(job), employer_id: employerId, published_at: published, created_at: published, updated_at: new Date(now).toISOString(), expires_at: new Date(now + job._expiresInDays * DAY).toISOString() };
}

export function materializeListing(listing, ownerId, now = Date.now()) {
  return { ...strip(listing), owner_id: ownerId, available_date: new Date(now + listing._availableInDays * DAY).toISOString().slice(0, 10), created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() };
}
