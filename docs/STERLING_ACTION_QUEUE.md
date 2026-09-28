# Sterling action queue

One item at a time. Everything not listed here has already been done, verified, or doesn't need you.

## 1. Record Relief TEST fixtures — DONE, confirmed live
TEST-A..D now appear in the jurisdiction picker, clearly labeled "(TEST DATA)". Verified two deliberately different
fact patterns against the real engine live: an eligible misdemeanor (sentence completed 2022-06-15, 3-year rule) →
`POTENTIALLY ELIGIBLE NOW`, and an identical rule with a 2025-06-18 completion date → `WAITING PERIOD`, with an
exact, correctly computed countdown (`2028-06-18 · 1 year, 8 months, 21 days remaining`). The engine is proven
correct on these two paths; more fact patterns (restitution, exclusions, manual-review flags, stale rule C, no-rule
jurisdiction D) are queued as ongoing QA, not blocked on you.

## 1a. Stripe test-mode key (unblocks FairPath+ checkout testing)
- **What:** create a free Stripe account, stay in test mode, get the publishable key (`pk_test_...`).
- **Where it goes:** a local `.env` file (never committed) as `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`.
- **Full walkthrough:** `docs/STERLING_INTEGRATION_SETUP.md`, priority 1.
- **Risk:** none — test mode never touches real money.
- **Unblocks:** actually testing FairPath+ checkout, which is currently uninitialized (no `.env` exists at all).

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
