# Sterling action queue

One item at a time. Everything not listed here has already been done, verified, or doesn't need you.

## 1. Get me back into a signed-in session (only remaining blocker)
- **Command:**
  ```bash
  npm run qa:dev-ui
  ```
- **Why:** I completed a full signed-in integration pass tonight (Opportunity Profile, Easy Apply, Housing FastTrack, Resources, Documents, Credit, FairPath AI, Privacy — all verified live, 4 real bugs found and fixed). The session ended when the Browser pane's storage was cleared by an environment reset, not by anything in the app. I don't have credentials to sign back in myself.
- **Expected result:** prints a `http://localhost:8091/auth/callback#...` URL. Open it in the Claude Browser pane (not your own browser — the token is single-use and I need to see it land). Then tell me you're signed in.
- **Unblocks:** Record Relief signed-in testing (untested this pass), Meetings retest, sign-out/session-restore, and continuing the marathon into Resume Studio polish / Record Relief / FairPath AI expansion.

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
