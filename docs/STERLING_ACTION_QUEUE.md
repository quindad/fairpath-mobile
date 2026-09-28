# Sterling action queue

One item at a time, in order. Each blocks something specific; everything else continues without it.

## 1. Rerun the render harness (a third bug fixed — 10/12 was the harness, not the app)
- **Command:**
  ```bash
  npm run qa:dev-render
  ```
- **Why:** three harness bugs found and fixed across this pass, none of them a real defect in `render-document`, `register_generated_document`, or `keep_document_copy`.
  1. (`ca9e980`) Queried columns that don't exist on `resources` (`status`/`name` vs. real `publish_status`/`verification_state`/`title`); the error was silently discarded and read as "not seeded."
  2. (`a587568`) Picked a resource by raw `published`+`verified` columns instead of the full `resource_is_visible()` contract (also requires an active organization and fresh/stale, not expired) — picked an unsaveable row.
  3. (`1c78a47`) The 10/12 run: versioning failed because the harness hardcoded "the PDF regenerate is v2," but the CSV test in between shares the same `document_type` and legitimately used version 2 first (a document's version is one sequence across every export format — correct, intentional behavior). The storage test then failed with `FILE_NOT_UPLOADED` for the same reason: it uploaded to a hardcoded `v2.pdf` path while the real document was already v3, so `keep_document_copy()` correctly couldn't find the file at the path it computed. Both are fixed by reading the actual returned version instead of assuming it, and covered by a new local regression test (`test-local-documents.mjs`, 12/12).
- **Risk:** low. DEV only, no writes to Resources or generated_documents schema.
- **Expected result:** `qa:dev-render` reports 12/12 against the deployed function (PDF/DOCX/CSV, versioning, private storage, isolation, malformed/unauthorized requests).
- **Unblocks:** signed-in Browser QA (queue item 2).

## 1b. Push the Resume Studio migration
- **Command:**
  ```bash
  npx supabase db push
  ```
- **Why:** two migrations are written and tested locally but not yet applied to DEV: `20261002100000_resume_studio.sql` (member_resumes, owner-only RLS, duplicate_resume(); 6/6 `npm run test:sql:resume`) and `20261002110000_meetings.sql` (member_meetings, owner-only RLS, set_meeting_status(); 5/5 `npm run test:sql:meetings`).
- **Risk:** low. New table only, no changes to existing schema.
- **Expected result:** the push includes this migration with no errors.
- **Unblocks:** signed-in Resume Studio testing.

## 1c. Restart the stalled dev server on port 8090
- **What happened:** you signed in on `localhost:8090` (the magic-link callback landed and returned 200), but the app bundle never finished compiling — `/home` stayed blank for 2+ minutes and the bundle request never resolved. No session ever got saved to the browser (localStorage is empty), so from my side it's as if sign-in never happened.
- **Command:** in the terminal running `npm run` on 8090, stop it (Ctrl+C) and restart:
  ```bash
  npm run web
  ```
  (or whatever script starts your local dev server — check `.claude/launch.json`'s `expo-web` entry, port 8090)
- **Why:** tonight's diff is large (Resume Studio, Meetings, AI routing, /me rewrite); a stale Metro cache from before those changes can cause exactly this kind of stall on first bundle.
- **Expected result:** `/home` renders within ~30-60s of the restart, signed in as you.
- **Alternative:** if you'd rather I drive a fresh session myself, run `npm run qa:dev-ui` and paste me the sign-in URL/credentials it prints — I'll sign in on my own QA server (port 8091) instead of touching 8090.

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
