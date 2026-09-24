import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}
function exists(file) {
  return fs.existsSync(path.join(root, file));
}
/** Strips `-- ...` SQL comment lines so content checks below only see
 * real statements, not the explanatory prose that documents them (which
 * necessarily mentions the exact things it says are absent). */
function stripSqlComments(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

// ---------------------------------------------------------------------
// 1. Required Step 1 files exist
// ---------------------------------------------------------------------
const requiredMigrations = [
  'supabase/migrations/20260924150002_offense_taxonomy.sql',
  'supabase/migrations/20260924150003_profiles_identity_location_consent.sql',
  'supabase/migrations/20260924150004_addresses.sql',
  'supabase/migrations/20260924150005_convictions.sql',
  'supabase/migrations/20260924150006_supervision_records.sql',
  'supabase/migrations/20260924150007_registration_records.sql',
  'supabase/migrations/20260924150008_consent_events.sql',
  'supabase/migrations/20260924150009_feature_flag_justice_engine.sql',
  'supabase/migrations/20260924150010_backfill_canonical_profile.sql',
];
const requiredCode = [
  'src/core/models/offense-taxonomy.ts',
  'src/core/eligibility/categorize-offense.ts',
  'src/core/profile/address-service.ts',
  'src/core/profile/consent-service.ts',
  'src/core/profile/location-service.ts',
  'src/core/profile/profile-service.ts',
  'src/core/profile/conviction-service.ts',
  'src/app/location-setup.tsx',
];
for (const f of [...requiredMigrations, ...requiredCode]) {
  if (!exists(f)) failures.push('Missing required Step 1 file: ' + f);
}
if (failures.length) {
  // Can't safely read files that don't exist — stop here.
  console.error('Canonical profile audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}

const sensitiveTableMigrations = {
  addresses: read('supabase/migrations/20260924150004_addresses.sql'),
  convictions: read('supabase/migrations/20260924150005_convictions.sql'),
  supervision_records: read('supabase/migrations/20260924150006_supervision_records.sql'),
  registration_records: read('supabase/migrations/20260924150007_registration_records.sql'),
  consent_events: read('supabase/migrations/20260924150008_consent_events.sql'),
};
const backfill = read('supabase/migrations/20260924150010_backfill_canonical_profile.sql');
const taxonomySql = read('supabase/migrations/20260924150002_offense_taxonomy.sql');
const featureFlagSql = read('supabase/migrations/20260924150009_feature_flag_justice_engine.sql');

// ---------------------------------------------------------------------
// 2. RLS invariant: no anon access on any justice-history/consent table
// ---------------------------------------------------------------------
for (const [table, sql] of Object.entries(sensitiveTableMigrations)) {
  if (!/enable row level security/i.test(sql)) {
    failures.push(table + ' migration does not enable RLS.');
  }
  if (/to anon/i.test(sql)) {
    failures.push(table + ' migration grants anon access — sensitive tables must be owner-only.');
  }
}

// ---------------------------------------------------------------------
// 3. Sterling decision #3: share_with_employers retired
// ---------------------------------------------------------------------
if (/share_with_employers/i.test(stripSqlComments(sensitiveTableMigrations.convictions))) {
  failures.push('convictions migration still contains share_with_employers (Sterling decision #3: retired).');
}
const convictionServiceSrc = read('src/core/profile/conviction-service.ts');
const convictionServiceCode = convictionServiceSrc.replace(/\/\*[\s\S]*?\*\//g, ''); // strip /** ... */ JSDoc
if (/share_with_employers/i.test(convictionServiceCode)) {
  failures.push('conviction-service.ts still references share_with_employers (Sterling decision #3: retired).');
}

// ---------------------------------------------------------------------
// 4. Sterling decision #6: officer_contact removed
// ---------------------------------------------------------------------
if (/officer_contact/i.test(stripSqlComments(sensitiveTableMigrations.supervision_records))) {
  failures.push('supervision_records migration still contains officer_contact (Sterling decision #6: removed from V1).');
}

// ---------------------------------------------------------------------
// 5. Non-destructive backfill: no DROP TABLE / TRUNCATE / DELETE FROM
//    anywhere across every new migration
// ---------------------------------------------------------------------
for (const [name, sql] of [['taxonomy', taxonomySql], ['feature_flag', featureFlagSql], ...Object.entries(sensitiveTableMigrations), ['backfill', backfill]]) {
  if (/drop table|truncate|delete from/i.test(stripSqlComments(sql))) {
    failures.push(name + ' migration contains a destructive statement (DROP TABLE / TRUNCATE / DELETE FROM) — migrations must be non-destructive.');
  }
}

// ---------------------------------------------------------------------
// 6. Sterling decision #2: no placeholder conviction row from legacy
//    justice_impacted signal. The backfill file may mention
//    justice_impacted only in its read-only verification summary
//    (after the "Verification summary" marker) — not anywhere in the
//    actual insert/update statements above it.
// ---------------------------------------------------------------------
const verificationMarkerIndex = backfill.indexOf('Verification summary');
if (verificationMarkerIndex === -1) {
  failures.push('backfill migration is missing its verification summary section.');
} else {
  const beforeVerificationCode = stripSqlComments(backfill.slice(0, verificationMarkerIndex));
  if (/justice_impacted/i.test(beforeVerificationCode)) {
    failures.push('backfill migration references justice_impacted in an actual statement outside the verification summary — this would recreate the fabricated-placeholder-row bridge Sterling decision #2 removed.');
  }
}

// ---------------------------------------------------------------------
// 7. Sterling decision #1: taxonomy stays provisional; engine stays
//    feature-flagged off
// ---------------------------------------------------------------------
if (!/status\s*=\s*'provisional'/i.test(taxonomySql) && !/'provisional'/i.test(taxonomySql)) {
  failures.push('offense taxonomy migration does not seed status=provisional.');
}
if (!/justice_eligibility_engine_enabled['",\s]*,\s*false/i.test(featureFlagSql)) {
  failures.push('justice_eligibility_engine_enabled feature flag is not seeded as false.');
}

// ---------------------------------------------------------------------
// 8. profiles migration: search_radius_miles default, zip/radius
//    nullable-by-default (progressive onboarding, Sterling decision #7)
// ---------------------------------------------------------------------
const profilesSql = read('supabase/migrations/20260924150003_profiles_identity_location_consent.sql');
if (!/search_radius_miles smallint not null default 25/i.test(profilesSql)) {
  failures.push('profiles migration does not set search_radius_miles default to 25.');
}
if (!/add column if not exists zip_code text/i.test(profilesSql)) {
  failures.push('profiles migration is missing a nullable zip_code column (must not be NOT NULL — progressive onboarding, not required at signup).');
}

// ---------------------------------------------------------------------
// 9. Cross-file taxonomy consistency: TS category keys must exactly
//    match the SQL seed's keys, in the same order
// ---------------------------------------------------------------------
const sqlCategoryKeys = [...taxonomySql.matchAll(/\('([a-z_]+)', '[^']+', \d+\)/g)].map((m) => m[1]);
let tsCategoryKeys = [];
let offenseTaxonomyModule;
try {
  offenseTaxonomyModule = await import(pathToFileURL(path.join(root, 'src/core/models/offense-taxonomy.ts')).href);
  tsCategoryKeys = offenseTaxonomyModule.OFFENSE_TAXONOMY_CATEGORIES.map((c) => c.key);
} catch (e) {
  failures.push('Could not import src/core/models/offense-taxonomy.ts for cross-check: ' + e.message);
}
if (tsCategoryKeys.length && sqlCategoryKeys.length) {
  if (tsCategoryKeys.length !== 9 || sqlCategoryKeys.length !== 9) {
    failures.push('Expected exactly 9 taxonomy categories; found ' + tsCategoryKeys.length + ' in TS, ' + sqlCategoryKeys.length + ' in SQL.');
  }
  if (JSON.stringify(tsCategoryKeys) !== JSON.stringify(sqlCategoryKeys)) {
    failures.push('offense-taxonomy.ts category keys do not match the SQL seed order/content.\n  TS:  ' + tsCategoryKeys.join(', ') + '\n  SQL: ' + sqlCategoryKeys.join(', '));
  }
}

// ---------------------------------------------------------------------
// 10. categorize-offense.ts: real behavioral checks (pure, zero-import
//     module — genuinely executed here, not just string-matched)
// ---------------------------------------------------------------------
try {
  const { categorizeOffense } = await import(pathToFileURL(path.join(root, 'src/core/eligibility/categorize-offense.ts')).href);

  const cases = [
    { input: { offenseTitle: 'Assault in the third degree' }, expect: 'violence' },
    { input: { offenseTitle: 'Sexual assault' }, expect: 'sex_offenses' },
    { input: { offenseTitle: 'Grand theft auto' }, expect: 'property_theft' },
    { input: { offenseTitle: 'Possession of a controlled substance' }, expect: 'drugs' },
    { input: { offenseTitle: 'Wire fraud' }, expect: 'fraud_financial' },
    { input: { offenseTitle: 'Felon in possession of a firearm' }, expect: 'weapons' },
    { input: { offenseTitle: 'DUI - first offense' }, expect: 'driving_vehicle' },
    { input: { offenseTitle: 'Disorderly conduct' }, expect: 'public_order' },
  ];
  for (const c of cases) {
    const result = categorizeOffense(c.input);
    if (!result) failures.push('categorizeOffense returned null for "' + c.input.offenseTitle + '" — expected category "' + c.expect + '".');
    else if (result.categoryKey !== c.expect) failures.push('categorizeOffense("' + c.input.offenseTitle + '") returned "' + result.categoryKey + '", expected "' + c.expect + '".');
    else if (!tsCategoryKeys.includes(result.categoryKey)) failures.push('categorizeOffense returned category "' + result.categoryKey + '" which is not in the taxonomy category list.');
  }

  const nullResult = categorizeOffense({ offenseTitle: 'Jaywalking near the courthouse on a Tuesday' });
  if (nullResult !== null) failures.push('categorizeOffense should return null (no confident guess) for an unmatched offense description, got: ' + JSON.stringify(nullResult));

  const emptyResult = categorizeOffense({});
  if (emptyResult !== null) failures.push('categorizeOffense should return null for empty input, got: ' + JSON.stringify(emptyResult));
} catch (e) {
  failures.push('Could not execute src/core/eligibility/categorize-offense.ts tests: ' + (e && e.message ? e.message : e));
}

// ---------------------------------------------------------------------
// 11. profile-service.ts: legacy justice_impacted -> has_felony
//     inference bridge removed (Sterling decision #2), replaced with a
//     non-fabricating prompt marker; dual-write is fail-soft
// ---------------------------------------------------------------------
const profileService = read('src/core/profile/profile-service.ts');
if (/justice_impacted === 'Yes'\)\s*answers\['convictions\.has_felony'\]\s*=\s*true/.test(profileService)) {
  failures.push('profile-service.ts still fabricates convictions.has_felony from legacy justice_impacted — Sterling decision #2 requires this be removed.');
}
if (!/legacyJusticeSignalUnconverted/.test(profileService)) {
  failures.push('profile-service.ts is missing the legacyJusticeSignalUnconverted prompt marker.');
}
if (!/catch/.test(profileService) || !/dualWrite/.test(profileService)) {
  failures.push('profile-service.ts is missing the fail-soft dualWrite helper — canonical writes must not break existing flows before migrations are applied to the live project.');
}

// ---------------------------------------------------------------------
// 12. Consent + location UI wiring present
// ---------------------------------------------------------------------
const signUp = read('src/app/sign-up.tsx');
if (!/agreedToTerms/.test(signUp)) failures.push('sign-up.tsx is missing the Terms/Privacy consent checkbox state.');
if (!/recordSignUpConsent/.test(signUp)) failures.push('sign-up.tsx does not record consent.');
const authCallback = read('src/app/auth/callback.tsx');
if (!/recordSignUpConsent/.test(authCallback)) failures.push('auth/callback.tsx does not record consent after email verification.');
const meScreen = read('src/app/me.tsx');
if (!/\/location-setup/.test(meScreen)) failures.push('me.tsx has no link to the location-setup screen.');
const locationSetup = read('src/app/location-setup.tsx');
if (!/DEFAULT_SEARCH_RADIUS_MILES/.test(locationSetup)) failures.push('location-setup.tsx is not using the shared default radius constant.');

// ---------------------------------------------------------------------
// 13. Item 15: categorization mechanism exists and is inert — no
//     scheduled/automatic invocation anywhere in the app, no code path
//     mutates real conviction rows with a suggested category
// ---------------------------------------------------------------------
const appSrcFiles = (function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(ts|tsx|mjs)$/.test(e.name) ? [p] : [];
  });
})(path.join(root, 'src'));
for (const f of appSrcFiles) {
  if (f.endsWith(path.normalize('src/core/eligibility/categorize-offense.ts'))) continue;
  const contents = fs.readFileSync(f, 'utf8');
  if (/categorizeOffense/.test(contents)) {
    failures.push('categorizeOffense is referenced outside its own module (' + path.relative(root, f) + ') — Step 1 must not wire automatic categorization of real conviction data.');
  }
}
if (!/DOES NOT RUN AUTOMATICALLY/.test(read('src/core/eligibility/categorize-offense.ts'))) {
  failures.push('categorize-offense.ts is missing its explicit "not wired to run automatically" documentation.');
}

if (failures.length) {
  console.error('Canonical profile audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Canonical profile audit passed: ' + (requiredMigrations.length + requiredCode.length) + ' required files, RLS/migration invariants, taxonomy consistency, and offense-categorization behavior checked.');
