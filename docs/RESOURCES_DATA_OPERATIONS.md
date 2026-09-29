# Resources data operations — the production operating model

Read directly from `20261001100000_resources_core.sql` and related migrations. Resources is confirmed the most
mature schema in the app — this doc describes how to operate it at scale, not how to build it (it's built).

## The full chain: source → organization → resource → location → service area → verification → freshness

1. **`resource_organizations`** — the source. Real `org_type` enum (`government`/`nonprofit`/`faith`/`employer`/
   `provider`/`other`), `is_national`, `status` (`active`/`suspended` — an org can be shut off without deleting
   its resources), full `data_origin`/`fixture_set` TEST-separation (same pattern as every other module).
2. **`organization_members`** — who can edit an org's resources, with real roles (`owner`/`manager`/`editor`) and
   status (`invited`/`active`/`removed`) — a real invite/access lifecycle already modeled, not just a flat list.
3. **`resources`** — the record itself. `revision_of` (self-referential FK) gives version history without a
   separate version-number scheme — a correction creates a NEW row pointing back at the old one, rather than
   editing in place, matching the same "never mutate published content" discipline as Record Relief's
   `rule_version` and generated documents' `supersedes_id`.
4. **`resource_locations`** — one-to-many (a resource can have multiple physical locations), each with its own
   address, coordinates, phone, timezone, virtual flag, and its own accessibility tags.
5. **`resource_service_areas`** — separately indexed by ZIP and state, meaning "this resource serves this area"
   is its own queryable relationship, not inferred from a location's address.
6. **Verification lifecycle** — `publish_status` (`draft`/`pending_review`/`published`/`retired`) crossed with
   `verification_state` (`unverified`/`verified`/`rejected`), with a DB-level CHECK enforcing
   `publish_status <> 'published' or verification_state = 'verified'` — **a resource cannot become member-visible
   without being verified, enforced by the database itself, not application code.** This is the strongest version
   of the "existing doesn't mean visible" gate found anywhere in the schema.
7. **Freshness** — `resource_freshness()` computes `fresh`/`stale`/`expired`/`unknown` dynamically from
   `last_verified_at` and `verify_by` (default 180 days + a grace period), so staleness is always a live
   calculation against the current date, never a value that itself goes stale.

## Verification cadence

`verify_by` is a real per-resource field (not a fixed global interval) — a fast-changing resource (e.g. a
seasonal program) can get a shorter re-verification window than a stable one (e.g. a permanent government
office), set explicitly per row rather than assumed.

## Stale vs. expired — already distinguished

`resource_freshness()`'s three real states (beyond `unknown`) are `fresh` (before `verify_by`), `stale` (in the
grace period after), and presumably `expired` beyond the grace window (the function was read up to the `stale`
branch this pass; the `expired` branch logic wasn't traced line-by-line but the three-state design is confirmed
from the comment header: "fresh / stale / expired"). This already gives the UI what it needs to show a graduated
warning instead of a binary "still good" / "broken."

## Organization suspension — verified, works correctly

`resource_organizations.status = 'suspended'` is a real, effective kill-switch: `search_resources()` and
`get_resource_detail()` both `join ... on o.id = r.organization_id and o.status = 'active'` (confirmed by reading
both functions directly) — a suspended org's resources are excluded from every member-facing read path
immediately, without needing to touch a single `resources` row. Suspending one org instantly hides everything it
owns.

## Deduplication

No explicit dedup constraint found (no unique constraint across title+organization or similar) — for
FairPath-entered and org-submitted resources this is low-risk (a human is creating each row deliberately), but
for a future bulk/open-data import, the same "no dedup key" gap that Jobs/Housing have for direct postings
applies here too: a real feed importer would need its own external-ID-based dedup, following the same
`external_opportunities`-style pattern used elsewhere, not yet built for Resources specifically.

## Source provenance

`source_authority` (`government`/`nonprofit`/`partner_submitted`/`community`/`test_fixture`) already distinguishes
WHERE a resource's information came from, separate from WHO owns/edits it (`organization_id`). This is a real,
useful distinction: a community-submitted tip about a government program is `source_authority = 'community'` even
if it's eventually linked to the government org that actually runs the program.

## Bulk import — not built, but the schema doesn't fight it

No CSV/bulk-import path exists yet (same as Jobs/Housing). Given every `resources` row must satisfy the
verified-before-published CHECK constraint regardless of HOW it was inserted, a future bulk importer is
automatically safe against "silently published, unverified" — the database itself refuses that state no matter
what inserts the row.

## Human review

`publish_status = 'pending_review'` is the real, already-modeled review queue state — a future Admin resource
verification screen has an exact status value to query for its work queue, no new schema needed.

## Correction requests — member reports, already real

Confirmed `resource_reports` exists (from the Command Center contracts work). **A report must not automatically
hide or delete a resource** — nothing in the schema does this automatically today (no trigger found flipping
`publish_status` on a report insert), which is the correct, safe default. The Admin review-queue workflow
(REPORT RECEIVED → REVIEW NEEDED → CONFIRMED ACCURATE/UPDATED/TEMPORARILY UNAVAILABLE/RETIRED) is a UI/process
layer to build on top of the existing `publish_status` enum, likely by adding a `temporarily_unavailable` value
to it or tracking that state on the report itself rather than the resource — a real design choice to make when
that UI gets built, not decided here.

## Partner self-management

`organization_members` already gives a partner (an org's own staff) edit access scoped to their organization via
the membership-check function confirmed in the schema (`organization_id`/`user_id` pair check). No UI consumes
this today, but the access-control foundation for partner self-service is real, not hypothetical.

## What Admin needs to expose (mapped to what already exists)

- Organization approval/suspension — `resource_organizations.status`, already a real column.
- Resource review queue — `publish_status = 'pending_review'`, already a real, queryable state.
- Freshness monitoring — `resource_freshness()`, already computable per-resource.
- Report triage — `resource_reports`, exists; state-machine UI not built.
- Bulk import health — would need the same `opportunity_ingestion_runs`-style tracking Jobs/Housing's dormant
  pipeline has, not yet built for Resources specifically (Resources has never needed bulk import since it's been
  hand-curated so far).

## Managing tens of thousands of resources without the database becoming junk

The three real levers already in the schema: (1) the verification gate (nothing reaches members without a human
verifying it, no matter the entry volume), (2) `verify_by`-driven freshness (a resource doesn't get read as
trustworthy forever just because it was verified once), (3) `revision_of` versioning (corrections don't destroy
history). Organization suspension is confirmed already cascading correctly to hide a suspended org's resources from search.
What's still needed at real scale: a dedup strategy for any future bulk/feed source (not needed yet, since
everything today is hand-entered).
