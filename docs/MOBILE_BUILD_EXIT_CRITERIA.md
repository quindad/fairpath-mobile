# Mobile build exit criteria — when does primary focus move to Command Center?

An engineering judgment call, tested against the codebase, not agreement-by-default with either "Mobile isn't
done" or "let's start Command Center." See the recommendation at the bottom for the actual answer.

## MUST COMPLETE BEFORE FOCUS SHIFT

Things that, if left undone, would force Command Center to be redesigned or would mean building it against a
foundation that's still moving:
- **Nothing schema-shaped is currently unstable.** Every recent security fix (Record Relief grants, Early Access
  activation) changed a function body or a grant, never a table shape or a foreign key relationship. Command
  Center's admin actions (activate a market, issue a grant, verify a rule) already call the exact functions Mobile
  uses — those contracts held steady across two full hardening passes.
- **Corrected during the Resources data-operations deep pass:** a real, reusable Organization model
  (`resource_organizations`/`organization_members`, `org_type` already anticipating `'employer'`) already exists
  — it was wrongly reported as entirely absent in an earlier version of this document. The remaining gap is
  smaller: extending that model and linking `jobs`/`housing_listings` ownership to an organization instead of
  only an individual `auth.users` row. Still worth settling deliberately before the Partner workspace starts
  (Admin workspace doesn't depend on it at all), but it's an extension task, not a from-scratch design project.

## CAN CONTINUE DURING COMMAND CENTER BUILD

Everything else on the launch board — real Jobs/Housing/Resources inventory, real Record Relief legal content,
push/email/SMS, walkability, Stripe deployment, physical-device QA. None of these change what Command Center's
Admin workspace needs to call. An admin activating a coverage market, verifying a Record Relief rule, or granting
FairPath+ works identically whether the underlying inventory is 100 DEV fixtures or 100,000 real listings.

## EXTERNAL SETUP

Unchanged list from the launch board (Apple/Google auth confirmation, Android Maps key, Stripe account + deploy,
Sentry, email/SMS provider, walkability provider). None of these block Command Center architecture.

## REAL DATA OPERATIONS

Jobs/Housing/Resources real inventory, Record Relief real legal content. These are the actual remaining Mobile
launch blockers — and notably, Command Center's Admin workspace (job-import health, resource verification,
Record Relief publishing) is exactly the tooling that makes these operations sustainable at scale. There's a real
argument that starting Command Center's Admin surfaces SOONER, not later, is what unblocks real data operations —
today, populating real Record Relief content means hand-writing SQL, which doesn't scale.

## PHYSICAL DEVICE QA

Entirely independent of Command Center. Can run in parallel on any timeline Sterling's hardware access allows.

## POST-BETA

Notification delivery (push/email/SMS actually sending), analytics/error-monitoring vendor connection,
Organization/Partner-seat model, caseworker consent-boundary design. All real, all genuinely can wait.

## Testing the hypothesis: "we don't need every API connected, we need contracts stable"

Checked against two full hardening passes this session, each of which found and fixed a real bug:
1. The Early Access late-binding entitlement bug — fixed inside a function body, zero schema/contract change.
2. The Record Relief RPC + column grant over-exposure — fixed at the grant layer, zero schema/contract change.

Both fixes are exactly the kind of change that would NOT force a Command Center rebuild if Command Center had
already been built against the pre-fix contracts, because the contracts (function names, argument shapes, return
row shapes members are allowed to see) didn't change — only the internal correctness/security of the
implementation did. This is real evidence FOR the stability hypothesis, not just an assumption.

Counter-evidence to weigh: this session found two real, non-trivial issues in systems that had already been
built and "verified" in a PRIOR session. That's a real base rate — it means undiscovered issues of the same
class plausibly still exist elsewhere in the schema. Command Center consuming a contract that later needs a
similar security tightening is a manageable, normal maintenance cost (as demonstrated twice tonight); Command
Center consuming a contract that needs a SHAPE change (new required argument, different return columns) would be
more disruptive. Nothing found this session was a shape change.

## Objective PASS gates per capability

"Looks done" is not evidence. Each gate names the exact evidence that makes it PASS — anything short of that
stays its current launch-board status, no matter how complete the code looks.

| Capability | PASS requires |
|---|---|
| Authentication (email/password) | Registration + login + password reset driven live in the Browser pane on real DEV, session restore proven after a hard reload |
| Authentication (Google) | A real Google account completing OAuth end-to-end on a physical device or the Browser pane, not just the button existing |
| Authentication (Apple) | A real Sign in with Apple completing on a physical iPhone — cannot PASS in the Browser pane, full stop |
| Jobs (search/apply) | A real signed-in Browser session searching, saving, and completing Easy Apply, with the resulting application visible in `/job-applications` |
| Jobs (real inventory) | At least one real, non-fixture employer posting has been searched and viewed by a real search query, not a manually-inserted test row |
| Housing (search/apply) | Same bar as Jobs, plus FastTrack's required-document gate confirmed still blocking submission without one |
| Housing (real inventory) | At least one real, non-fixture landlord listing found via search |
| Resources | A real search returning a `verified`/`published` resource, plus a `resource_reports` submission confirmed NOT auto-hiding the resource |
| Early Access | The full lifecycle (join → activate → grant fires → Home/AI reflect it → idempotent re-run) proven on real DEV — **already PASSED**, evidence: this session's lifecycle test + bug fix |
| Opportunity Profile | All 8 sections saved and re-loaded correctly in a live signed-in session — **already PASSED** in a prior session |
| Easy Apply | Autofill populates from `member_skills`/`member_credentials`/`member_education`/`member_job_preferences` in a live test — **already PASSED**, evidence: the autofill bug fix + live re-test |
| FastTrack | A FastTrack application submitted end-to-end with the discount correctly applied and required documents enforced |
| Credit Builder | Upload → candidate review → member confirmation → dispute letter generated, driven live — **already PASSED** in a prior session |
| Record Relief | 8 distinct fact patterns exhaustively proven this session — **already PASSED** for the TEST engine; real-jurisdiction coverage requires at minimum 1 real, sourced, second-reviewed, published rule evaluated live against a real fact pattern. Ohio candidate research received and read (`OHIO_RECORD_RELIEF_INGESTION_HANDOFF.md`): 0 rules imported, by design — 2 representative pathways both surfaced genuine schema gaps (a non-generic manual-review-trigger mechanism, and unsupported requested/statutory/court-ordered relief tracking) that must be scoped deliberately before any Ohio content is safe to ingest. One real, narrower gap (`court_discretion`) found and closed this session. Still 0% real-jurisdiction PASS. |
| Marketplace | Core adversarial claim lifecycle (own-item block, duplicate-claim idempotency, quota enforcement free/FairPath+, already-claimed rejection, forged-verify rejection, cross-claimant isolation, decline, mark-ready, deadline expiry, anonymous claim-candidate view, cancel-before-approval) — **PASSED at the RLS/RPC boundary**, 17/17 adversarial tests this session; not independently re-driven in the Browser pane with a live signed-in session this pass |
| Resume Studio | Create, edit, export PDF+DOCX, delete, driven live — **already PASSED** in a prior session |
| Meetings | Create, cancel-with-reason, status transitions enforced, driven live — **already PASSED** in a prior session |
| FairPath AI | Zero overclaim/promise-pattern matches across an adversarial prompt set — **already PASSED** this session (13 prompts, 0 violations) |
| Documents | PDF/DOCX/CSV generated and downloaded in the Browser pane — **PASSED (web only)**; native Files/Share/Print requires a physical device, cannot PASS otherwise |
| Notifications | In-app inbox read/unread — **already PASSED**; push requires a real device receiving a real notification, not just the queue architecture existing |
| Privacy | Deletion request/cancel proven idempotent live — **already PASSED** in a prior session |
| FairPath+ | At minimum one live-verified benefit (Marketplace quota bump OR FastTrack discount) actually applying to a real entitled member — **already PASSED**, evidence: this session's lifecycle test showed the correctional-transition grant correctly unlocking FairPath+ status |
| Maps | Native map rendering pins on a physical Android device with a real Maps key configured — cannot PASS without the key + device; iOS/web already PASS (Apple Maps needs no key, web fallback already proven) |
| Walkability | A real provider (Walk Score or equivalent) returning a real score for a real address, rendered in the existing UI — cannot PASS without a provider connected; currently 0% |
| Light/dark mode | Both modes screenshotted in the Browser pane at phone width with no contrast/clipping issues — **already PASSED** in a prior session |
| Accessibility | Not formally audited this session — cannot claim PASS or FAIL, genuinely untested |
| Error states | A failure-injection test showing the correct human-readable message with no raw Postgres/Supabase error, no stale data — **PARTIAL PASS**: Jobs/Housing/Resources search LIVE Browser-verified (real fetch-injection) this/a prior session. A real bug class (stale successful data left rendered under a fresh error banner) was found and fixed across 10 more screens this session (Meetings, Credit, Resume Studio, Documents, Record Relief, Home, Me, Saved Resources, Opportunity Profile, Privacy) with static regression coverage (`audit-failure-states.mjs`, 10 checks). A systematic sweep of every `useFocusEffect`-based screen in the app (31 total) is now complete — the remaining 21 not fixed were individually confirmed safe by reading their render logic, not assumed. A separate, different bug was also found and fixed in `marketplace-edit/[id].tsx`: it refetched on every refocus and silently overwrote unsaved in-progress form edits. Code-level proof only for all of this — not independently Browser-verified live (no DEV member credentials available this session). |
| Offline/network failure | Same bar as error states, plus a reconnect-and-retry proven to recover cleanly — confirmed for Jobs this session (reload after injected failure recovered correctly), not yet tested elsewhere |
| Physical device (any) | A real PASS/FAIL entry in `PHYSICAL_DEVICE_QA_PLAN.md`'s table — currently every row is NOT TESTED, zero PASS |
| Security/RLS | A specific adversarial attempt (cross-member read, forged owner field, direct column select of a staff-only field) that fails as expected — **PASSED and substantially broadened this session**: Record Relief staff-only columns (prior session), Jobs/Housing organization ownership (cross-org isolation, forged organization_id, role-gated write access — 6/6), Marketplace claim lifecycle (forged claim id, non-seller actions, anonymous claimant identity — 11/11), and Meetings/Resume Studio/Opportunity Profile cross-member isolation (forged user_id inserts, direct reads/writes of another member's row, a SECURITY DEFINER RPC failing closed on a forged id — 8/8). Saved Jobs and saved Housing added this session too (2/2, forged-insert and cross-member read/delete all correctly denied); saved Resources already had prior coverage. Re-audited Credit's RPC surface this session (18 SECURITY DEFINER functions read in full): its existing test coverage is actually excellent, not a gap - forged cross-member calls to set_credit_item_stage, run_credit_review, confirm_credit_account, flag_credit_account_not_mine, delete_credit_report, create_credit_dispute, register_credit_upload (including a forged storage-path insert attempt) are all already adversarially tested and correctly denied. Every sampled function scopes correctly (owner check, or service_role-only grant for the internal ingestion path with no member-facing uid check needed). No further gaps found. |
| Performance | A measured before/after number, not a vibe — **PASSED for two fixes** (Home 20→2 job rows, Documents 3→1 duplicate query), both Browser-verified in a prior pass. A third fix this session (Marketplace's 3 sequential queries → parallel) is mechanically equivalent but not independently timed or Browser-verified (no DEV credentials this session). The known `auth.getUser()` duplication (13 call sites, no caching layer) remains flagged, not fixed — too broad a change to make safely without full regression testing in one pass. |
| Observability | A real captured exception/event reaching an actual configured vendor — cannot PASS without a vendor connected; the provider-neutral interface existing is necessary but not sufficient |
| Production data | Real Jobs/Housing/Resources/Record Relief content as defined in `PRODUCTION_DATA_READINESS.md`'s per-system minimum viable volume — currently 0% for all four |

## Recommendation

**B — Mobile backend contracts are stable enough to begin Command Center's Admin workspace in parallel,** with
one explicit carve-out: **do not start the Partner workspace's Organization/identity model until that design
question is deliberately settled**, since it's the one gap that would actually force rework if built against
wrong assumptions. Admin workspace (Coverage Markets, Entitlements, Record Relief publishing, Resources
verification, integration health) can start now against contracts that have held through two independent
hardening passes without a single shape change. Mobile itself should shift into QA/data-operations/integration
mode, not stop entirely — the remaining Mobile blockers (real inventory, real legal content, physical-device QA,
external provider setup) are largely non-engineering work (business decisions, content research, hardware access)
that doesn't compete for the same engineering attention Command Center needs.
