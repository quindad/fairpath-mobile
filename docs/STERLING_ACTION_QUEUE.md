# Sterling action queue

One item at a time. Everything not listed here has already been done, verified, or doesn't need you.

## 1. Record Relief TEST fixtures — DONE, confirmed live, engine proven correct
TEST-A..D appear in the jurisdiction picker, clearly labeled "(TEST DATA)". Four deliberately different fact
patterns verified live against the real engine, all four came back correct:
- Eligible misdemeanor (sentence completed 2022-06-15, 3-year rule) → `POTENTIALLY ELIGIBLE NOW`.
- Same rule, sentence completed 2025-06-18 (inside the wait) → `WAITING PERIOD`, exact countdown
  (`2028-06-18 · 1 year, 8 months, 21 days remaining`).
- Felony rule cleared on waiting period but restitution unpaid → `POTENTIALLY INELIGIBLE UNDER THIS RULE`,
  reason: "This rule requires restitution to be paid."
- DUI/DWI against the misdemeanor rule (which explicitly excludes it) → `POTENTIALLY INELIGIBLE UNDER THIS RULE`,
  reason: "This rule lists this kind of offense as excluded," plus an honest still-missing-information list even
  though the case is already ineligible.
Document packet generation (4 documents) also succeeded on the eligible case. More fact patterns (manual-review
flags, stale rule C, no-rule jurisdiction D, edit-and-recalculate, stale-document detection, isolation) are queued
as ongoing QA, not blocked on you.

**Minor open item, not urgent:** two `400` console errors fire on every cold page load/reload of a Record Relief
case page (not on in-app navigation, not tied to any specific button — isolated by intercepting fetch/XHR). No
user-facing effect was ever observed in any test. Likely an auth session-refresh race on cold boot. Flagging for a
later look, not chasing further right now.

## 1a. Stripe — deprioritized per your correction
Not the next external action. Payments come after the core-experience integrations below are understood. Setup
steps remain in `docs/STERLING_INTEGRATION_SETUP.md` priority 1 for whenever we get to it.

## 2. Decide on credit-report extraction (product/privacy decision, not a command)
- **Why:** `extract-credit-report` is built, tested offline, and disabled by default. Enabling it means member-consented credit reports get sent to an external model provider (currently wired for Anthropic).
- **Risk:** medium — privacy/vendor decision, not a technical risk.
- **Action when ready:** set `CREDIT_EXTRACTION_ENABLED=true` and `ANTHROPIC_API_KEY` as function secrets, then `npx supabase functions deploy extract-credit-report --project-ref znvhmuhojvwvjzmaqwff`.

## 3. Apple Sign-In (external, unchanged)
- Apple Developer capability, Supabase Apple provider, dev-client rebuild, physical-device test. See `EXTERNAL_SETUP_CHECKLIST.md` section 2.

## 4. Physical-device QA (unchanged)
- Share/print/Save to Files, native document generation fallback, Apple sign-in — none of this can be proven in the Browser pane.

---
### Resolved this pass (no action needed)
- `qa:dev-render` 12/12 — confirmed by you.
- Resume Studio + Meetings migrations — pushed and applied.
- Port 8090 stall — resolved by restart; the real fix underneath was the Metro `tslib`/docx bug (see handoff), now fixed for both 8090 and the QA server.
- `createResume`/`createMeeting` RLS bug, Easy Apply autofill bug, native-dialog testability bug — all found and fixed live tonight.
