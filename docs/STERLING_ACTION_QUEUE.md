# Sterling action queue

One item at a time, in order. Each blocks something specific; everything else continues without it.

## 1. Rerun the render harness (bug fixed — resources were already seeded correctly)
- **Command:**
  ```bash
  npm run qa:dev-render
  ```
- **Why:** the earlier "no verified resources in DEV" was a bug in the harness itself, not a Resources problem. It queried `.eq('status', 'verified')` and `select('id,name')` on `public.resources`, but that table has no `status` or `name` columns (it has `publish_status`, `verification_state`, `title`) — the query errored, the error was silently discarded, and an empty result read as "not seeded." Your 54-row seed was correct the whole time. Fixed in commit `ca9e980`, and a regression suite (`npm run test:qa-harness-columns`, now in `test:all`) checks every DEV-harness column against the real schema and flags any unchecked query error so this exact false negative can't recur.
- **Risk:** low. DEV only, no writes to Resources.
- **Expected result:** `qa:dev-render` runs its real checks against the deployed function (PDF/DOCX/CSV, versioning, private storage, isolation, malformed/unauthorized requests) and reports N/N.
- **Unblocks:** confirming the deployed `render-document` function end to end.

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
