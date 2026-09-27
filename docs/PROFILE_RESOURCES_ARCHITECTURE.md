# Profile + Resources — proposed architecture (for review, NO migrations written yet)

Status: proposal 2026-09-26. Target: DEV `znvhmuhojvwvjzmaqwff` only. Nothing here touches production.

## 1. Existing tables reused (no shape change unless noted)
- `profiles` (name, account_type; `account_type='organization'|'admin'` already exists and is server-controlled since `20260929120000`).
- `profile_answers` + `readiness-engine.ts`: stays the justice/readiness questionnaire. NOT the opportunity profile and NOT merged with it.
- `addresses`, saved ZIP + radius (location-service), `postal_codes` (ZIP centroids for radius math, same as `search_jobs`/`search_housing`).
- `consent_events` (append-only ledger) for Privacy.
- `job_applications`, `saved_jobs`, `housing_applications`, `saved_housing`, `user_notifications`, entitlement functions (FairPath+), `app_config`, `feature_flags`, `product_events`.
- `submit_job_application` is EXTENDED (whitelist gains the opportunity-profile snapshot; still no DOB/address/justice data).

## 2. New tables

### Resources (normalized where it pays, arrays where it does not)
| Table | Purpose / key columns |
|---|---|
| `resource_organizations` | id, name, slug, org_type (government/nonprofit/faith/employer/provider/other), website, description, is_national, status (active/suspended), data_origin, fixture_set |
| `organization_members` | org_id, user_id, role (owner/manager/editor), status. Ownership/management for Partner. |
| `resources` | id, organization_id, title, summary, description, resource_kind (program/service/benefit/hotline/document_help/course_link), delivery_mode (in_person/virtual/phone/hybrid), is_national, cost_type (free/sliding/paid/unknown), cost_notes, urgent_capable, urgency_tier, eligibility_summary, how_to_access, application_url, official_source_url, source_authority (government/nonprofit/partner_submitted/community/test_fixture), publish_status (draft/pending_review/published/retired), verification_state (unverified/verified/rejected), last_verified_at, verify_by, languages text[], accessibility text[], hours_note, revision_of (reserved for Partner edit flow), data_origin (production/dev_fixture), fixture_set, search_tsv (generated) |
| `resource_locations` | resource_id, label, address, city, state, zip, lat, lng, phone, timezone, is_virtual, accessibility text[] (physical differences per site) |
| `resource_service_areas` | resource_id, area_type (national/state/county/zip/radius), state, county_fips, zip, center_lat/lng, radius_miles |
| `resource_hours` | location_id, weekday, opens, closes, is_24h, note (drives open-now + urgent ranking) |
| `resource_eligibility` | resource_id, rule_type (age_min/age_max/residency/income/family/veteran/justice_related/other), value jsonb, description, is_hard. DISPLAY only; search never filters on the member's sensitive data. |
| `resource_contacts` | resource_id, method (phone/email/url/sms/walk_in), value, label, is_primary |
| `resource_required_documents` | resource_id, document_type (aligned with future Documents Vault types), description, is_required |
| `resource_categories` | slug, parent_slug, label, sort, urgent_default. Seeded by migration (taxonomy is product data, safe for prod): the 17 blueprint categories. |
| `resource_category_links` | resource_id, category_slug, is_primary |
| `resource_needs` | need_slug, label, synonyms text[], category_slugs text[], urgent. Data-driven plain-language mapping ("food today", "somewhere to stay", "ID", "transportation", "legal help", "training", "healthcare", "benefits", "financial help"). Also seeded by migration. |
| `resource_verification_events` | append-only: resource_id, event_type (submitted/verified/rejected/flagged_stale/reverified/retired/reported), actor_id, source_checked_url, notes, created_at |
| `saved_resources` | user_id, resource_id |
| `resource_interactions` | user_id, resource_id, state (started/completed), self-reported, unique(user,resource) |
| `resource_reports` | user_id, resource_id, reason (wrong_info/closed/unsafe/other), note. Feeds Admin freshness queue. |

Tags = `resource_categories` sub-slugs plus need synonyms (no separate tag table until Admin CMS needs one).

### Opportunity profile (member-owned, never employer-readable directly)
`member_work_experience`, `member_education`, `member_credentials` (certification/license: name, issuer, issued, expires; no license numbers), `member_skills` (unique per user), `member_job_preferences` (one row: desired titles, employment types, pay min/unit, availability days/shifts, start date, remote ok, transportation modes, has_drivers_license). Preferred location/radius reuses the existing saved ZIP + radius.

### Privacy / achievements
- Privacy: no new consent table. New RPC over `consent_events` (latest event per type). Optional `account_deletion_requests` (App Store requires in-app account deletion; see Decisions).
- Achievements: `achievement_definitions` (key, title, description, category, criteria jsonb, active) and `member_achievements` (user_id, key, awarded_at, source_event, source_ref, unique(user,key)).

## 3. RPCs / functions
- `is_fairpath_admin()`, `is_org_manager(org_id)` (security definer helpers).
- `resolve_resource_needs(query)` -> matched needs/categories (shown to the user as "Showing: Food today").
- `search_resources(p_query, p_zip, p_radius_miles, p_category, p_free_only, p_urgent, p_delivery text[], p_include_national, p_limit, p_offset)` -> rows + total_count, server-paginated. Sources: location distance via `postal_codes`, service-area match (zip/county/state/national), virtual/national flags. Rank: need/category match, `ts_rank(websearch_to_tsquery)`, proximity, freshness tier, open-now (urgent). Free-text queries are not stored against the user; analytics record category only.
- `get_resource_detail(id)` (locations, hours, contacts, docs, eligibility, freshness state).
- Member: `save_resource`/`unsave_resource`, `set_resource_interaction`, `report_resource`.
- `get_member_home_summary()`: all Profile metrics, scoped to `auth.uid()`.
- `upsert_*` RPCs for opportunity-profile sections with server validation (dates ordered, no future start, lengths).
- `get_privacy_state()`, `record_consent_choice()` (reuses ledger).
- `evaluate_member_achievements(user)` (service/definer only).
- Deferred (schema ready, no Admin build now): `admin_set_resource_verification`, `admin_list_resources`, partner `submit_resource_for_review`.

## 4. RLS / security boundaries
- All `resource_*` base tables: RLS on, NO direct select for anon/authenticated. Members read only through the security-definer RPCs, which return only `publish_status='published' AND verification_state='verified'` and apply freshness.
- Freshness: fresh (within `verify_by`) = normal; stale (past `verify_by`) = shown with "may be out of date" warning, ranked lower, excluded from urgent mode; expired (2x window) = hidden. Unverified/draft/rejected never reach members. Admin-state records are exercised through service-role harness now and `admin_*` RPCs later.
- Partner: `organization_members` rows grant write on that org's drafts only. Partners can never set `verification_state`, `last_verified_at` or `publish_status='published'`; only admin functions can. A partner edit of a published record creates a draft via `revision_of`.
- Member tables (`saved_resources`, `resource_interactions`, `member_*`, `member_achievements`): owner-only; clients get no insert on achievements; `resource_interactions` are self-reported and labeled so.
- Employer boundary: no employer/partner policy on any `member_*` table. Employer-facing data exists only as the snapshot written by `submit_job_application`. Audit asserts the snapshot has no DOB/address/conviction/registration/supervision fields and no join to justice tables.
- New-table grants are explicit (enforced by `test:baseline`).

## 5. DEV seed strategy
- Fixtures NEVER in migrations (migrations run on prod). Taxonomy (`resource_categories`, `resource_needs`) is in a migration because it is product data.
- `scripts/seed-dev-resources.mjs`: service key from env, refuses unless `supabase/.temp/project-ref` and the URL are the DEV ref, idempotent and deletable by `fixture_set`.
- Provenance at data level: `data_origin='dev_fixture'`, `fixture_set='resources-v1'`, `source_authority='test_fixture'`, URLs on `.test`, phones `555-01xx`, fictional organizations. A trigger rejects `dev_fixture` rows unless `app_config.environment='dev'` (unset = reject), so production physically cannot receive them.
- The member UI shows a small DEV badge when a returned row's `data_origin <> 'production'`; fixture rows are NOT auto-hidden.
- Coverage: 4+ markets (multiple ZIP clusters), national, online, phone-only, free/sliding/paid, differing eligibility, hours (24h, weekday-only, closed weekends), required documents, accessibility variants, verified-current, stale, expired, unverified, rejected, draft, urgent-capable and non-urgent, all 17 categories, plus a ZIP with zero results for the empty state. Verified-only, stale, urgent, and empty behavior are asserted by the harness.

## 6. Partner/Admin ownership path
Org record -> `organization_members` -> draft resources -> `submit_resource_for_review` -> Admin queue reads `resource_verification_events` and `resource_reports` -> `admin_set_resource_verification` writes verified/last_verified_at/verify_by. Freshness monitoring is a query over `verify_by` (no new machinery). Only the `organization_members` table and the reserved columns exist now; no Partner/Admin UI is built.

## 7. Profile metrics (all from `get_member_home_summary`, no client math on trust-sensitive data)
- Jobs Applied = `job_applications` with `submitted_at` set, broken out by status. Saved Jobs = `saved_jobs`.
- Housing Applications = submitted `housing_applications` by status. Saved Homes = `saved_housing`.
- Resources Saved = `saved_resources`. Resources Started/Completed = `resource_interactions`, labeled "marked by you".
- FairPath+ = existing entitlement function.
- Profile completion = fixed, documented checklist over real rows: name+phone, location, work experience, education, skills, job preferences, availability, transportation. Reported as "N of 8 sections", not a made-up score. Distinct from justice-readiness, which is unchanged.
- Next Step: a pure, audit-tested `next-step.ts` over the summary (ordered rules with reason codes): no location, unfinished job/housing draft, unread housing inquiry reply, FairPath+ expiring within 14 days, next incomplete profile section, else search jobs. No AI wording, no fabricated personalization.
- Resume status: no resume backend exists. Not shown as a metric this pass (see Decisions).

## 8. Achievement architecture
Server-owned only. Definitions are data; awards are written by `evaluate_member_achievements` (definer, no client grant) from authoritative events: first submitted job application, first submitted housing application, profile 8/8, FairPath+ activated. Self-reported resource completion never awards anything. UI shows earned achievements only: no points, no locked-badge gamification, no FairPoints yet.

## 9. Theme architecture (client, no migration)
- `src/core/theme/`: `tokens.ts` (semantic tokens and dark/light palettes), `ThemeProvider` (mode system/light/dark persisted locally), `useTheme()`, `makeStyles(theme => ...)` helper.
- Tokens: background, surface, surfaceRaised, text, textStrong, textMuted, border, borderStrong, accent, onAccent, accentText, error, success, warning, info, overlay, statusBar. Dark keeps today's values. Lime `#A8F32C` stays the accent FILL in both modes, with `onAccent` near-black. Lime is too low-contrast as light-mode TEXT, so light `accentText` is a darker green. The audit validates WCAG contrast for every text/background pair.
- Sharp corners unchanged (existing radius tokens).
- Progressive migration: `FairPathColors` stays for legacy screens. A pure `themed-routes.ts` allowlist lists migrated routes. `ScreenFrame` renders any route NOT on it inside a forced-dark scope (light mode never produces a dark screen inside light chrome). Migrating a screen = convert it and add it to the list. `audit-theme` fails if a listed screen imports `FairPathColors` or hardcodes hex, and fails if a shared component imported by a migrated screen does.
- Migrated this pass: `ScreenFrame`, `PageHeader`, bottom nav, `FairBackButton`, `FairPathDatePicker`, `FormScrollView`/`KeyboardFooterLayout`, notify sheets, plus the new Profile, Resources and Privacy screens. Appearance control (System/Light/Dark) lives on `/me`.

## 10. Migration sequence (one at a time, each followed by audit + DEV harness before the next)
0. Theme foundation (client only; can start immediately).
1. `20261001100000_resources_core.sql`: taxonomy + needs seed, organizations, members, resources, locations, service areas, hours, eligibility, contacts, documents, verification events, RLS, grants, fixture-guard trigger, admin/org helpers.
2. `20261001110000_resources_search.sql`: `resolve_resource_needs`, `search_resources`, `get_resource_detail`, freshness. Then `seed-dev-resources.mjs` + harness section.
3. `20261001120000_resources_member_state.sql`: saved, interactions, reports and RPCs.
4. `20261001130000_opportunity_profile.sql`: `member_*` tables, upsert RPCs, `submit_job_application` snapshot extension.
5. `20261001140000_member_home_summary.sql`.
6. `20261001150000_privacy_controls.sql` (+ deletion request if approved).
7. `20261001160000_achievements.sql`.
UI order: theme -> Resources -> Profile hub -> opportunity-profile editors -> Privacy -> achievements. Audits added: `audit-resources`, `audit-profile`, `audit-theme`; DEV harness extended; signed-in UI QA at the end.

## Addendum: documents and export
Document generation, export and sharing are a core platform capability. See `FAIRPATH_DOCUMENT_EXPORT_ARCHITECTURE.md`. It adds migration 3b (`generated_documents`) after migration 3.

## Decisions I need before migration #1
1. Default appearance: `dark` until most screens are migrated, then flip to `system`? (Recommended, because most legacy screens are forced-dark.)
2. Resume status: leave out until Resume Studio exists (recommended), or add a metadata-only `member_resumes` table now?
3. In-app account deletion: include `account_deletion_requests` + Privacy entry now (App Store requirement), processing later? (Recommended.)
4. Resources search open to signed-out visitors later? Proposed: authenticated only for now.
