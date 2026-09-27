# Sterling action queue

One item at a time, in order. Each blocks something specific; everything else continues without it.

## 1. Seed DEV resources, then run the render harness
- **Command:**
  ```bash
  npm run seed:dev:resources
  npm run qa:dev-render
  ```
- **Why:** `qa:dev-render` needs at least 2 verified resources to render a saved-resources document; DEV currently has none (the run failed with "no verified resources in DEV").
- **Risk:** low. DEV only, fictional data, idempotent.
- **Expected result:** `qa:dev-render` prints N/N passed and removes its 2 disposable members.
- **Unblocks:** confirming the deployed `render-document` function against real PDF/DOCX/CSV, storage and versioning.

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
