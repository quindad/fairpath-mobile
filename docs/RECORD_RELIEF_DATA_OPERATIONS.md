# Record Relief data operations — how a legal-data researcher populates real rules

For a future FairPath legal-data researcher (or Sterling, until one exists). Nothing here makes a legal judgment —
this describes process and tooling only.

## Schema audit result

Checked `record_relief_rules`/`record_relief_federal_pathways`/`record_relief_forms` against the full field list a
real production legal-rule needs. Found and closed (`20261003160000_record_relief_review_metadata.sql`) three
real gaps: no `next_review_at` (staleness was only a derived 1-year UI warning, never a queryable target date), no
reviewer identity anywhere (`researched_by`/`reviewed_by`, both opaque identifiers, never raw names), and no
staff-only `staff_notes` field distinct from the member-facing `summary`. Everything else on the requested list —
jurisdiction, jurisdiction level, official authority, source URL, citation, effective/expiration dates, version,
last-reviewed, verification state, offense classification, disposition, waiting-period basis, fines/restitution/
pending-charge/conviction-count rules, exclusions, filing venue/fee, required documents, official forms with their
own URL/revision/verification, and manual-review triggers — was already real and present.

**`staff_notes` is privacy-sensitive and must never be selected into a member-facing response.** No current client
code does this. If a future screen ever needs case data, select columns explicitly — never `select('*')` — on
`record_relief_rules`.

## The verification lifecycle — current state, honestly

The schema's actual `status` enum today is `draft` → `verified` → `superseded` → `retired` (4 states). Sterling's
request described a richer 8-stage lifecycle (draft/researched/review_required/verified/published/stale/
superseded/retired). **That richer lifecycle was NOT implemented this pass** — changing a CHECK constraint enum
that the live evaluation engine gates on (`rr_rules_read_verified` RLS policy: `status = 'verified'`) is a
higher-risk change than I was willing to make under time pressure without being able to exhaustively re-test
every downstream consumer. What exists today is a real 2-gate boundary that already satisfies the core safety
requirement — **a rule existing does not make it visible: only `status = 'verified'` rows are ever read by a
member, enforced by RLS, not application code, verified this session across TEST-C's stale-rule case and TEST-D's
no-rule case.**

**Recommended future work, not done tonight:** split `draft` into `draft`/`researched`/`review_required` for a
real multi-person review workflow (right now `draft` covers all pre-verification work with no way to distinguish
"nobody has looked at this yet" from "a second reviewer is checking it"), and add a `published` state distinct
from `verified` if FairPath ever wants a verified-but-not-yet-live staging step. Use `next_review_at` (added this
pass) to drive an explicit staleness view, separate from the derived 1-year warning that already exists.

## What a researcher actually does today, step by step

1. **Research.** Find the jurisdiction's actual statute/court rule for a given remedy (expungement, sealing, set-
   aside, etc.) from an official `.gov` or official court source. Never a third-party blog, never an AI-generated
   summary treated as authority.
2. **Draft.** Insert a `record_relief_rules` row with `status = 'draft'`, filling every field the statute actually
   specifies. Leave `last_verified_at` null — the schema itself refuses `status = 'verified'` with a null
   `last_verified_at` (existing CHECK constraint). Set `researched_by` to your own opaque identifier. Use
   `staff_notes` for anything that needs a second reviewer's attention (ambiguous wording, a provision you're
   unsure how to encode, a conflicting secondary source).
3. **Second review.** A second person reads the draft against the same official source independently, not just
   proofreading the first person's summary. Sets `reviewed_by`.
4. **Verify.** Only after independent second review, update `status = 'verified'` and set `last_verified_at` to
   today and `next_review_at` to a reasonable future check-in date (the schema doesn't prescribe an interval —
   fast-changing jurisdictions need shorter intervals than stable ones).
5. **Publish.** Today, `verified` IS published (RLS gates directly on it) — there is no separate publish step.
   Members can see it the moment it's verified.
6. **Monitor.** When `next_review_at` passes, or a known law change happens, re-research and create a NEW row
   with an incremented `rule_version` (never edit a verified row in place — `rule_key`+`rule_version` is unique,
   and the evaluation engine's history log already depends on rule versions being immutable once evaluated
   against).
7. **Supersede.** When the new version is verified, set the OLD version's `status = 'superseded'`. The evaluation
   engine already correctly picks only the newest verified version whose effective window covers today
   (`record_relief_active_rules()`), and already flags `rule_changed` in a case's history when the rule backing
   an old evaluation gets superseded (verified in this project's engine tests).
8. **Retire.** If a remedy is repealed entirely (no replacement rule), set `status = 'retired'`. A retired rule is
   never evaluated (same RLS gate as draft/superseded — only `verified` rows are read).

## TEST vs. real data — how they stay separate

Already enforced at the database level, not just convention: `data_origin` (`production`/`dev_fixture`) and
`fixture_set` are linked by a CHECK constraint (`(data_origin = 'dev_fixture') = (fixture_set is not null)`) — a
row cannot claim to be a dev fixture without a fixture_set, and cannot have a fixture_set without claiming to be
one. `record_relief_jurisdictions.kind` has an explicit `'test'` value distinct from `'state'`/`'district'`/
`'territory'`/`'federal'`. The seed script's own dev-target guard additionally refuses to run at all outside a
confirmed DEV target. A researcher entering real data should never set `data_origin = 'dev_fixture'`, and the
existing constraint makes that combination structurally impossible to get backwards by accident.

## Structured import format — NOT built this pass

Sterling asked for a canonical JSON/CSV import format with a dry-run validator (VALID/WARNING/REJECTED) rejecting
missing jurisdiction, missing source, malformed URLs, invalid dates, TEST/real mixing, etc. **This was not built
tonight** — it's real, valuable, bounded work, but building a validator thorough enough to actually catch the
listed failure modes (impossible waiting periods, invalid conviction bounds, duplicate active versions, TEST/real
mixing) needs real test coverage against real edge cases to be trustworthy, and that was a larger scope than
remaining time allowed for tonight without producing something half-tested. Recommended shape for later: a Node
CLI (`scripts/import-record-relief-rule.mjs`) that reads one rule as JSON matching the `record_relief_rules`
column shape, validates every constraint the database itself already enforces (offense classes, dispositions,
waiting-period bounds, required-field presence) PLUS the process-level rules the database can't check alone
(second-reviewer distinct from researcher, `next_review_at` after `last_verified_at`, no duplicate active
`rule_key` for a jurisdiction+remedy), and only inserts as `status = 'draft'` — verification/publish stays a
separate, deliberate step never done by the importer itself.
