# Sterling action queue

One item at a time. Everything not listed here has already been done, verified, or doesn't need you.

## 1. Record Relief TEST fixtures are partially missing (state rules), federal TEST is present
- **What I found, precisely:** `record_relief_federal_pathways` has its TEST rows loaded (Presidential pardon (TEST),
  Youth offender set-aside (TEST) both showed up correctly on a federal case). But `record_relief_jurisdictions` has
  **no** `TEST-A`/`TEST-B`/`TEST-C`/`TEST-D` rows at all — they don't even appear in the jurisdiction picker — so the
  state-rules engine (waiting periods, exclusions, countdowns) cannot be exercised end to end right now. Everything
  that CAN be tested without them passed cleanly: honest "rule not verified" outcomes, case create/edit, the 4-document
  filing packet, status tracking, AI deep links.
- **Command:**
  ```bash
  npm run seed:dev:relief
  ```
- **Risk:** low. DEV only, fictional TEST data, idempotent (deletes-by-fixture_set then re-inserts).
- **Expected result:** the 4 TEST jurisdictions appear in the "Where was the case heard?" picker on `/record-relief/add`.
- **Unblocks:** testing the actual rules engine (waiting periods, countdowns, exclusions) signed-in.

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
