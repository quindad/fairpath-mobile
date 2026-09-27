# Sterling action queue

One item at a time, in order. Each blocks something specific; everything else continues without it.

## 1. Rerun the render harness (second bug fixed — resources were already seeded correctly)
- **Command:**
  ```bash
  npm run qa:dev-render
  ```
- **Why:** two harness bugs, now both fixed, neither was a Resources problem.
  1. (`ca9e980`) It queried `.eq('status', 'verified')` / `select('id,name')`, columns that don't exist (real ones: `publish_status`, `verification_state`, `title`). The query errored, the error was discarded, and an empty result misread as "not seeded."
  2. (`a587568`) After fixing #1, it picked ANY row with `publish_status = 'published'` and `verification_state = 'verified'`, but that's not the full contract `save_resource()` enforces — it also requires the organization to be active and the row to be fresh/stale, not expired (`resource_is_visible()`). It picked a published+verified-but-expired-or-org-suspended row and failed with `RESOURCE_UNAVAILABLE`. The harness now filters candidates through `resource_is_visible()` itself — the same function `save_resource()` calls — so it can't drift from the real contract again. Regression suite: `npm run test:resource-availability` (now in `test:all`).
- **Risk:** low. DEV only, no writes to Resources.
- **Expected result:** `qa:dev-render` runs its real checks against the deployed function (PDF/DOCX/CSV, versioning, private storage, isolation, malformed/unauthorized requests) and reports N/N.
- **Unblocks:** confirming the deployed `render-document` function end to end, then signed-in Browser QA (queue item 2).

## 2. Create a disposable signed-in DEV UI member for Browser QA
- **Command:**
  ```bash
  npm run qa:dev-ui
  ```
- **Why:** signed-in screens (Opportunity Profile, Credit, Record Relief, My Documents, Me) cannot be driven in the Browser pane as a guest.
- **Risk:** low. DEV only, disposable account; `npm run qa:dev-ui-cleanup` removes it after.
- **Expected result:** prints a DEV email/password to sign in with in the Browser pane.
- **Unblocks:** the full signed-in Browser QA pass.

## 3. Decide on credit-report extraction (product/privacy decision, not a command)
- **Why:** `extract-credit-report` is built and disabled by default. Enabling it means member-consented credit reports are sent to an external model provider (Anthropic).
- **Risk:** medium — privacy/vendor decision, not a technical risk.
- **What it unblocks:** deploying the function and building the consent screen described in the handoff doc.
- **Action when ready:** set `CREDIT_EXTRACTION_ENABLED=true` and `ANTHROPIC_API_KEY` as function secrets, then `npx supabase functions deploy extract-credit-report --project-ref znvhmuhojvwvjzmaqwff`.

## 4. Apple Sign-In (external, unchanged from earlier handoff)
- Apple Developer capability, Supabase Apple provider, dev-client rebuild, physical-device test. See `EXTERNAL_SETUP_CHECKLIST.md` section 2.

## 5. Physical-device QA (unchanged)
- Share/print/Save to Files, native document generation fallback, Apple sign-in — none of this can be proven in the Browser pane.
