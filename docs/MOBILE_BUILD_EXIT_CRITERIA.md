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
