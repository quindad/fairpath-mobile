# Production data readiness — what must happen before fixtures become real data

For each system: current state, target launch state, and every operational requirement in between. No legal
right to republish third-party data is assumed anywhere below — where rights are unknown, it says so.

## JOBS

- **Current state:** 100% DEV fixture/seed. Backend ownership foundation is real and working (`jobs.employer_id`
  FK + owner-scoped RLS, confirmed this pass — see `COMMAND_CENTER_MOBILE_CONTRACTS.md`), just has no UI.
- **Target launch state:** a credible number of real, second-chance-relevant job postings in at least one launch
  market — volume matters less than relevance; 50 real, verified second-chance-friendly postings beat 5,000
  scraped generic ones.
- **Source types:** direct employer self-service posting (backend ready); ATS integrations (Greenhouse, Lever,
  etc.) as phase 2; third-party job-board feeds only if licensing explicitly permits redistribution.
- **Rights/license requirements:** direct employer postings need no third-party license (the employer is the
  source). Any feed/API source needs its terms of service checked for redistribution rights BEFORE ingestion —
  **UNKNOWN / MUST VERIFY** for any specific vendor, since none has been evaluated.
- **Import method:** for direct postings, a new employer-facing screen writing directly to `jobs` (RLS already
  supports this). For a feed, the dormant `opportunity_sources`/`external_opportunities` pipeline (real schema,
  zero code using it today).
- **Verification:** who confirms a posting is genuinely second-chance-friendly, not just self-reported? Needs a
  decision — automatic trust of employer self-report vs. a manual admin review step before a posting goes live.
- **Deduplication:** `external_opportunities` already has `(source_id, external_id)` uniqueness for feed-sourced
  listings; direct postings have no dedup concern (one employer, one posting).
- **Freshness:** `external_opportunities.last_seen_at`/`expires_at` exist for feed sources; direct postings need
  an explicit expiration/renewal flow (e.g. auto-expire after 60 days, employer must renew).
- **Retirement:** `jobs.status` already supports `closed`/`expired`/`filled` — the state machine exists, nothing
  currently transitions a listing into those states automatically.
- **Provenance:** `jobs.source_id`/`external_opportunity_id` exist; direct postings need `source_label` set
  consistently (already used for DEV: `FairPath DEV Seed`).
- **QA sampling:** before any real launch-market activation, a manual sample review of a percentage of live
  postings for accuracy/appropriateness — process not yet defined.
- **Failure mode / rollback:** a bad posting should be pausable (`status = 'paused'`) instantly, not deleted —
  preserves the audit trail. No rollback tooling exists yet.
- **Monitoring:** `opportunity_ingestion_runs` models per-run fetch/create/update/error counts for feed sources;
  nothing monitors direct-posting volume/quality yet.
- **Admin owner:** undecided — this is a product/staffing decision, not a technical one.

## HOUSING

Same shape as Jobs, with `housing_listings.owner_id` as the equivalent working RLS foundation.
- **Target launch state:** real, second-chance-friendly landlord listings in the launch market(s).
- **Source types:** direct landlord/property-manager self-service (backend ready); MLS/IDX feeds explicitly
  AVOIDED per the existing integration register (licensing complexity, and doesn't match the second-chance-
  friendly value proposition — a generic MLS feed says nothing about a landlord's actual policy).
- **Rights/license requirements:** direct landlord postings need no third-party license. **CRITICAL, already
  flagged in the launch board:** a listing existing must never be conflated with "this landlord accepts
  justice-impacted applicants" — that requires an explicit landlord assertion or FairPath verification, never an
  inference from the listing data alone.
- **Import/verification/dedup/freshness/retirement/provenance:** same pattern as Jobs — schema-ready via the
  dormant ingestion pipeline for any future feed, but direct listings are the recommended first source.
- **QA sampling / failure mode / monitoring / admin owner:** same open questions as Jobs.

## RESOURCES

- **Current state:** 100% DEV fixture, but the ONLY module of the three with a real, actively-used provenance/
  verification model already in production code (published/verified/fresh/stale/expired, verification history) —
  this is the most production-ready module architecturally, purely a content problem.
- **Target launch state:** a genuinely useful density of verified local resources (food, shelter, ID, transportation)
  in the launch market(s) — this is the fallback value Early Access explicitly routes low-coverage members to, so
  it matters even more than Jobs/Housing volume at launch.
- **Source types:** FairPath direct verification (highest trust, most labor); 211/government open-data feeds
  (**UNKNOWN / MUST VERIFY** redistribution rights per-jurisdiction — 211 data licensing varies by region and is
  not uniformly open); approved partner/organization submissions with FairPath verification before publish.
- **Rights/license requirements:** government open-data is often explicitly public-domain/permissively licensed,
  but this must be checked per source, never assumed — **UNKNOWN / MUST VERIFY** for any specific 211 provider or
  state open-data portal until someone actually reads that source's terms.
- **Import method, verification, freshness, retirement:** the existing lifecycle (published/verified/fresh/stale/
  expired) already models this; a structured import path for bulk-loading verified entries doesn't exist yet
  (each resource today is presumably entered one at a time).
- **Provenance:** already tracked per the existing architecture.
- **QA sampling:** member reports already exist as a real signal (`resource_reports`) and should feed a
  reverification queue — Command Center contract for this is documented, UI not built.
- **Admin owner:** undecided.

## RECORD RELIEF

- **Current state:** engine 🟢 PROVEN (8 distinct fact patterns exhaustively verified this session), real legal
  content 🔴 0 of 50 states + DC. TEST-A..D fixtures only, unmistakably labeled.
- **Target launch state:** verified rules for at least one launch state, published through an explicit
  draft→verified→published lifecycle (see `RECORD_RELIEF_DATA_OPERATIONS.md`) — quality and correctness matter
  far more than state count for a legal-content product; one state done rigorously beats ten states done
  carelessly.
- **Source types:** state statutes and court rules (official .gov sources only), official court forms.
- **Rights/license requirements:** government statute text and official court forms are generally public
  domain/freely citable — this is the one domain where "the source is a government body" is itself close to a
  license answer, but form REPRODUCTION (hosting a copy vs. linking to the official source) still needs a
  per-jurisdiction check — **UNKNOWN / MUST VERIFY** whether FairPath hosts copies of official forms or only
  links to them (current TEST fixtures only link, never host — that's the safer default to keep).
- **Import method:** see the structured import format in `RECORD_RELIEF_DATA_OPERATIONS.md`.
- **Verification:** explicit multi-stage review (research → review → publish), never a single person's
  unreviewed entry going live — this is the single most important control in this entire document, since a wrong
  legal rule could cause real harm to a real person's case.
- **Deduplication:** `(rule_key, rule_version)` uniqueness already exists in schema.
- **Freshness:** `last_verified_at`/`effective_from`/`effective_to` already exist; a "next review due" concept
  does not yet exist as a queryable field (see the data-operations doc's schema audit).
- **Retirement:** `status` transitions to `superseded`/`retired` — needs to exist as an enum value (see the
  data-operations doc).
- **QA sampling:** every published rule should be spot-checked by a second reviewer before publish — this is a
  process requirement, not a schema one.
- **Failure mode / rollback:** superseding a rule (not deleting it) preserves history — already the right pattern
  given `rule_version` exists; a bad publish should supersede back to draft, never silently disappear.
- **Monitoring:** a "stale rule" warning already fires in the live UI (verified this session on TEST-C) when
  `last_verified_at` is over a year old — this pattern should extend to real rules automatically once they exist.
- **Admin owner:** must be someone with actual legal research competence, not a generalist — this is the one
  system in this document where getting the wrong answer has the highest real-world cost.
