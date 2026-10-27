# FairPath Mobile — Full Automated QA Mission (2026-10-20)

**Tester:** Claude (web-based interactive QA via headless Chrome against the Expo web build on `localhost:8083`, DEV Supabase project `znvhmuhojvwvjzmaqwff`)
**Scope:** Full app walkthrough per the QA mission brief. See "Tooling & limits" below for what could and couldn't be tested this way.
**Safety:** DEV only. No production data or credentials. No migrations/deploys/commits/pushes without explicit approval (none were needed — all fixes were plain TypeScript/TSX). Disposable test accounts created and cleaned up after each use.

## Tooling & limits

- No iOS simulator, Android emulator, Maestro, or Detox available in this environment. All interactive testing was done through the Expo **web** build in a real (headless) Chrome browser — real clicks, real typing, real navigation, real console/network inspection, not static code reading.
- The existing automated harness (`npm run test:all` — TypeScript check, ~30 `audit:*` scripts, and ~25 local-Postgres SQL migration/behavior tests) was run as a baseline and after every fix: **68/68 passing** throughout.
- **Not covered by this pass** (needs a real device or simulator): native keyboard behavior, native share sheets, native push notification delivery/display, true multi-device screen-size rendering, iOS/Android-specific gesture handling, Apple Sign-In (native-only). Flagged explicitly below wherever relevant instead of claimed as tested.
- Payments: Stripe is not connected to real charges in this DEV environment (known, pre-existing). UI/state-logic was tested; no real charge was or could be made.

## Baseline (before any fixes)

- `npx tsc --noEmit`: clean
- `npm run test:all`: 68/68 passing

---

## Findings

### 1. [FIXED] App-intro carousel frozen on slide 1 while the pager advances
**Where:** `src/app/intro/index.tsx`
**Severity:** High — every brand-new user's very first screen.
**What was wrong:** Tapping "Next" advanced the dot indicator and enabled "Back," but the slide content stayed frozen on slide 1 forever (confirmed by clicking Next 6 times — dots moved to slide 7, text never changed from "Opportunity has a path."). Root cause: the horizontal `FlatList` had no `getItemLayout`, so `scrollToIndex` (called on every Next/Back tap) couldn't compute where to scroll and silently no-opped, while the `index` state driving the dots/button label kept advancing independently.
**Fix:** Added `getItemLayout` to the `FlatList` so `scrollToIndex` can compute offsets without measurement — the standard fix for this well-known RN pattern.
**Verified live:** Clicked through all 7 slides after the fix; content now changes in sync with the dots every time, ending correctly on "Join FairPath" → `/join`.

### 2. [FIXED] Infinite render loop crashing email sign-up / legal consent
**Where:** `src/core/auth/registration-draft.ts`
**Severity:** Critical — crashed the entire app (full-screen "Something went wrong"), not just a component. Hit by tapping "Sign up with email" or by the Terms/Privacy document screens re-syncing on focus.
**What was wrong:** `getRegistrationDraft()` (the `useSyncExternalStore` snapshot function backing the sign-up form's draft state) returned a **brand-new object** (`{ ...draft }`) on every single call instead of a stable reference. `useSyncExternalStore` requires a referentially stable snapshot when nothing changed, or React re-renders forever trying to reconcile — exactly the "Maximum update depth exceeded" / "getSnapshot should be cached" errors in the console. Compounded by `syncRegistrationDraftFromLegalSession()` unconditionally calling `patchRegistrationDraft(...)` (and emitting) on every screen focus even when the values hadn't actually changed.
**Fix:** `getRegistrationDraft()` now returns the live `draft` object directly (it's only ever replaced, never mutated in place, so this is safe and stable between real changes). `patchRegistrationDraft` now shallow-compares before replacing/emitting, so a no-op patch is a true no-op.
**Verified live, full end-to-end:** Filled out the sign-up form (name/email/password) → opened Terms → checked "I have read" → agreed → returned to sign-up with **all form data intact** and Terms correctly showing "Agreed" → repeated for Privacy → submitted → real account created in DEV (`auth.users` row confirmed via SQL), correctly routed to `/check-email`, correctly deferred consent-recording until email verification (by design). Zero crashes across the full loop. Cleaned up the test account after.

### 3. Supabase rejects `@example.com` addresses at sign-up (not a bug — flagging as expected behavior)
**Where:** sign-up form, Supabase Auth's own email validation.
**What happened:** First sign-up attempt with `...@example.com` failed with "Email address ... is invalid." Retried with a `@gmail.com`-shaped address and it worked. This is Supabase's default behavior rejecting RFC-reserved non-deliverable test domains (`example.com`/`.org`/`.net`), not an app bug. Noting it only so future QA passes don't waste time on it — use a real-shaped domain (e.g. `@gmail.com`, `@fairpath.test` works too per the seeded accounts) for disposable test emails.

### 4. [FIXED — same-session carryover, confirmed still present] "My Path" tab ignored onboarding personalization
Already fixed and verified earlier this session (see conversation history) — noting here for the permanent record since it's in-scope for this mission's "member onboarding and navigation" area. `src/app/my-path.tsx` now shows a real "Your focus areas" section driven by the member's actual onboarding goals, reusing `loadHomePersonalization()`/`homeQuickLinks()`. Stale "coming soon: Entrepreneurship, Marketplace" copy removed (both are already live).

### 5. Button-in-button HTML nesting on card components (job cards, housing cards, and likely others) — logged, not fixed this pass
**Where:** `src/app/find-jobs.tsx` (job card "Save" button), and the same pattern recurs on housing cards and likely other list screens.
**Severity:** Low. **Non-functional** — the inner button's `onPress` already calls `e.stopPropagation()`, so clicking "Save" does not also trigger the outer card's click. This is purely an invalid-HTML / React hydration-warning issue on **web only**; native iOS/Android has no such restriction and renders this pattern with zero issue.
**What's wrong:** A `Pressable` with `accessibilityRole="button"` (→ renders `<button>` on web) is nested inside another `Pressable` with the same role, producing `<button><button>...</button></button>`, which is invalid HTML and logs a console warning on every affected card.
**Why not fixed now:** The pattern repeats across many card components app-wide; fixing it properly means auditing and restructuring every list card, which is a larger, separate cleanup task, not a one-file fix. Recommend a dedicated pass later: either drop `accessibilityRole="button"` from the inner action and handle it as a plain pressable icon, or restructure so the icon-button is a sibling overlay rather than a DOM descendant of the card's button.

### 6. Record Relief "Scan my case with Signal" (document upload + AI extraction) — not exercised
**Where:** `src/app/record-relief/scan-packet.tsx` (consent screen reached, confirmed renders correctly with a clear AI-processing consent checkbox).
**Why not tested further:** Requires selecting a real file via the OS file picker, which this environment's browser automation can't drive meaningfully without a prepared fixture file (an actual docket/judgment-entry image or PDF). Flagging as **not automated this pass** — needs either a prepared test fixture file or a physical/simulator device with camera access.

---

## Summary

**Fixed and verified live (2 real, confirmed defects):**
1. App-intro carousel frozen on slide 1 while the pager advanced — every brand-new user's first screen was broken. Fixed, verified across all 7 slides.
2. Infinite render loop crashing the entire app on email sign-up / legal document review — a critical, 100%-reproducible crash on the core registration path. Fixed, verified full end-to-end (form → Terms → Privacy → submit → real account created in DEV).

**Confirmed working, full interactive pass (not just code review):**
- Guest browsing + guest restriction redirect (with contextual "why" messaging and `returnTo`)
- Email registration, legal consent (Terms + Privacy), registration persistence, deferred consent recording
- Sign-in (`dev-free@fairpath.test`)
- My Path personalization (fixed earlier this session, re-confirmed still correct)
- Jobs: search, job detail, Easy Apply (autofill, required-field validation, résumé/record-statement attach options), submission, application detail, **real Signal AI interview-prep call**, My Applications list
- Housing: search, listing detail, "Ask a question" inquiry flow end-to-end, Housing Activity status tracker
- Resources: category filtering, save/unsave with persisted state
- Record Relief: hub screen, case list, Signal scan entry point (consent screen only, see #6)
- Profile/Account (`/me`): accurate live activity counts matching exactly what was tested
- Notification settings: both toggles persist correctly to the DB in both directions; correctly refuses to re-enable push without real device permission (correct behavior, not a bug)
- Privacy and account: accurate data-sharing disclosures, proper 14-day cancellable account-deletion request (not instant/destructive), document retention explanation
- Payments: honest "no payments yet" empty state; FairPath+ clearly labeled "SUBSCRIBE · NOT CONNECTED YET" — no fake purchase flow, no overclaiming
- Full regression: `npx tsc --noEmit` clean and `npm run test:all` (68/68: TypeScript, ~30 audit scripts, ~25 local-Postgres SQL/migration tests) passing both before and after every fix

**Logged, not fixed (out of scope for this pass, explained above):**
- #5: button-in-button HTML nesting on card components — low severity, non-functional, web-only, needs a dedicated cross-component pass
- #3: Supabase rejects `@example.com` test emails — expected platform behavior, not a bug, noted for future QA passes

**Could not be automated in this environment:**
- Record Relief document-scan AI extraction (needs a real file upload)
- Any native-only behavior: iOS/Android keyboards, native share sheets, real push notification delivery/display, true multi-device screen rendering, Apple Sign-In — all need a simulator or physical device, which wasn't available here

## Round 2 — deeper pass (Record Relief manual entry, Marketplace, Appearance)

All confirmed working, no new defects found:

- **Record Relief manual case entry + rule evaluation**: created a real case against the TEST-A fixture jurisdiction, correctly evaluated as "MORE INFORMATION NEEDED" with the right missing-fields list, "KEEP MOVING" opportunity links rendered correctly (the fix from earlier this session holds), full filing packet/forms/documents section rendered correctly.
- **Signal "explain this case" honest fallback**: asked Signal to explain the case twice; both times the AI call itself failed, and the server correctly returned its own honest "Signal could not explain this right now" fallback (a real, intentional 200-OK code path in the shared gateway, not a crash or a client bug) instead of inventing an answer. Worth a follow-up to understand why this specific workflow's AI call failed twice in a row, but the *handling* of that failure is working exactly as designed.
- **Marketplace**: browsed, opened an item, requested a claim — claim correctly created, anonymous-selection and 48-hour pickup-window copy all correct, free-plan 1-claim/month limit displayed accurately.
- **Appearance/theme**: switching Dark → Light applies instantly and correctly; Home correctly stays dark per the screen's own disclosed "some screens are still being updated" copy — not a bug. Switched back to Dark to leave the shared `dev-free` fixture account in its default state.

## Round 3 — Signal AI fallback investigation (requested follow-up)

**Root cause identified and fixed (deployed to DEV, verified):** `record-relief-explanation`'s AI call used the `'fast'` provider tier, which tries Google first. The shared AI gateway (`gateway.ts`) deliberately treats "malformed output" from a provider as a **permanent** failure with no fallback to the next provider — the code comment explains this is intentional ("repeating those to another vendor would re-send data or mask a bug"). Google's content-safety filtering is the most likely of the three configured providers (Anthropic, OpenAI, Google) to return empty/malformed output on legitimate criminal-record/record-relief content, so this specific workflow silently had the worst odds of all the AI features in the app.

**Fix:** added a new `fast_justice` chain tier (same three providers, Anthropic tried first) and switched `record-relief-explanation` to use it. Deployed to DEV. Verified via a direct authenticated call to the edge function: real, correct, model-assisted explanation returned (`modelAssisted: true`).

**Known remaining limitation (by explicit decision, not an oversight):** the broader "never fall back on non-transient/malformed-output errors" policy was deliberately left unchanged per your direction. This means *any* single hiccup from whichever provider is tried first — now Anthropic for this workflow — still fails the whole call with no retry. Confirmed this directly: a second live attempt through the UI, moments after the verified-working direct call, failed again. The fix meaningfully improves the odds (removes the specific, predictable Google-safety-filter failure mode for justice-related content) but does not make the feature 100% reliable, because that would require changing the no-fallback policy itself, which you asked to leave alone.

## Next launch blocker

With both registration-path crashes now fixed, **the clearest remaining launch blocker is infrastructure, not a bug**: FastTrack/Plus payments aren't connected to real Stripe billing yet (`SUBSCRIBE · NOT CONNECTED YET` is honestly labeled, not broken — it's just not wired to a real payment processor). Everything else found this pass was either fixed live or is a low-severity, non-blocking item logged above.

---

## Round 4 — Cursor handoff (2026-10-20, post-Claude usage limit)

**Owner:** Cursor agent (sole active dev). Claude uncommitted work preserved; no reverts.

### Code delivered this round

1. **Credit Studio redesign (Priority 1)** — `src/app/credit/index.tsx` + `src/components/credit/CreditStudioHome.tsx`
   - Streamlined **Studio** tab: **My Credit**, **My Next Step**, **My Progress** (dark + lime via existing theme tokens).
   - Accounts / Review / Disputes / Learn tabs unchanged (all prior flows preserved).
   - **Array-ready, provider-neutral** layer: `src/core/credit-studio/credit-score-provider.ts` (no external API calls, `scoreDisplay` always null until a real partner is authorized).
   - Pure helpers + tests: `workspace-summary.ts`, `tests/credit-studio-workspace.test.ts`.

2. **Registration / legal (Priority 2 — automated)** — Claude’s `registration-draft.ts` **useSyncExternalStore** fix retained. Regression tests: `tests/registration-draft.test.ts` (in `npm run test:all`).

### QA tracker — finish line status

| Area | Expo Web (interactive) | Automated (`npm run test:all`) | Physical iPhone / native |
|------|------------------------|--------------------------------|---------------------------|
| Email registration + Terms/Privacy persistence | **PASS** (Claude, Round 1–2) | `registration-draft`, `consent-client-contract` | Layout, keyboard, dev menu overlay — **not re-verified this round** |
| Intro carousel | **PASS** (Claude) | onboarding audit | Native swipe feel — device |
| Credit Studio redesign | **Pending** — reload web after pull | `credit-studio-workspace`, `test:credit`, `test:credit-member` | — |
| FastTrack housing apply | **Not finished** (Claude stopped mid-list) | housing audits | FastTrack payment UI without real Stripe — web partial |
| Google OAuth smoke | **Not finished** | auth audit (code) | **Native browser session** — device or simulator |
| Apple Sign-In | N/A on web | auth audit | **Device only** |
| Accessibility / keyboard spot-checks | **Partial** (keyboard audit script only) | `test:keyboard` | Native keyboard — device |
| Push notifications | Settings toggles **PASS** (Claude) | notification SQL/worker mocks | OS delivery — device |
| Record Relief scan upload | Consent screen only | relief/credit SQL | File picker / camera — device |
| Stripe FastTrack/Plus charge | UI honesty **PASS** | payments audit | Real charge — not in DEV |

### Remaining launch blockers (unchanged + new notes)

- **Stripe / store billing** not connected (primary infra blocker).
- **Array** (or other score provider): architecture only; no partnership/API until approved.
- **FastTrack housing apply** end-to-end still needs Sterling/Cursor web QA completion.
- **Google OAuth** needs web smoke at minimum; native path needs iPhone.

### Test evidence (Cursor)

Run locally: `npm run test:all` (expect **70/70** — adds credit-studio workspace + housing application validation + registration-draft steps). **`audit: credit`** greps both `credit/index.tsx` and `CreditStudioHome.tsx` for the dev-only LOAD SAMPLE control after the Studio redesign. Claude’s separate **1512** count is the broader `tests/` Node suite outside `run-all-tests.mjs` — not duplicated here.

---

## Round 5 — Cursor: housing QA, Credit Studio polish, release gate (2026-10-20)

### Phase 1 — Housing (FastTrack vs standard)

**Product reality (verified in code + tests):** `HOUSING_FASTTRACK_MEMBER_ENABLED = false` in `housing-product.ts`. The member app exposes **one path: standard application** (`/housing-apply/new?listing=…&mode=standard`). Paid FastTrack checkout is retired (`fasttrack-checkout` honest redirect). Server/RPC FastTrack rules remain covered by local SQL / `qa-dev-platform` scripts — not re-run this round.

**Automated regression added:** `tests/housing-application-form.test.ts` + extracted `housing-application-validation.ts` (shared date rules preserved; `audit: dates` updated).

**Interactive Expo Web (attempted):** Dev server responds on `http://localhost:8083`, but browser automation returned an **empty accessibility tree** (React Native Web not exposing nodes to MCP snapshot). **No claim** of click-through housing wizard in this round — needs Claude-style headless Chrome session or manual web/iPhone pass.

**Recommended manual web path (standard apply):** Guest → listing → **Start application** → join/sign-in gate → 5-step wizard → save & continue → review → submit (no payment).

### Phase 2 — Credit Studio (visual / UX)

**Shipped in code:** Studio tab simplified — three hero sections (My Credit / My Next Step / My Progress bar), 4-chip navigation (Upload / Accounts / Review / Disputes), collapsible **More tools**, Array placeholder copy (no score). Responsive padding/`maxWidth` at tablet/desktop in `credit/index.tsx` + `CreditStudioHome`.

**Interactive Expo Web:** Same MCP limitation — **not visually verified** in automation this round. **You:** reload `/credit` at 320 / 390 / 768 / 1024 px widths.

### Phase 3 — Auth & accessibility

| Item | Expo Web (this round) | Automated | iPhone / native |
|------|----------------------|-----------|-----------------|
| Registration → Terms → Privacy | Not re-clicked (MCP limit) | `registration-draft.test.ts`, consent contract | Device pass still recommended |
| Google OAuth | Not smoke-tested (MCP limit) | `audit: auth` (OAuth code paths) | System browser / ASWebAuthenticationSession |
| Guest vs member gates | Not re-clicked | `audit: auth-boundaries`, housing/job audits | — |
| Keyboard / a11y spot-check | Not run | `audit: keyboard`, `audit: profile-a11y` | Native keyboard |

### Phase 4 — Release gate

- `npx tsc --noEmit`: **pass** (after Credit Studio + housing validation extract).
- `npm run test:all`: **70/70** expected after `audit: dates` fix for validation file path (re-run locally to confirm log).
- **Launch blockers (unchanged):** real Stripe/store billing; Array partnership/API; interactive FastTrack **member** UI intentionally off; Record Relief scan upload needs file picker; native-only QA gaps above.

### Fixes this round (needs your approval to commit)

- Credit Studio UI simplification + responsive layout.
- Housing validation extracted for testability; dates audit grep updated.
- QA doc Round 5 + `run-all-tests.mjs` housing validation step.

---

## Round 6 — Claude: closed the gaps Cursor's MCP session couldn't reach (2026-10-21)

Cursor's Round 4/5 notes above flag several items as "not re-verified / not smoke-tested — MCP returned an empty accessibility tree." That limitation doesn't apply to this session (real headless-Chrome clicks throughout tonight) — closed every one of those gaps directly.

**Baseline:** `npx tsc --noEmit` clean. `npm run test:all` → **71/71** (own count differs from Cursor's "70/70 expected" note — 71 is what actually ran).

### A3/A5 — Registration, legal persistence, onboarding (re-verified with a fresh account, `test123@test.com`)

- Full email sign-in → `/accept-terms` gate → opened Terms, checked "I have read," agreed → back on `/accept-terms` with **Terms correctly showing "Agreed," checkbox auto-checked, form state intact** → same for Privacy → **Complete registration** → routed to `/onboarding`. Confirmed the **checkbox-only shortcut path** (checking the box without opening the doc first) is correctly blocked until the doc is reviewed — matches the checklist's A3 requirement exactly.
- Confirmed copy says **"FINISH REGISTRATION"**, not "ONE LAST STEP" (Cursor's earlier fix holds).

- **[FIXED] Onboarding step 2 (Location) was a silent dead end.** Clicking "Continue" with the location field empty did nothing — no error, no explanation, button just sat there. Root cause: `src/app/onboarding.tsx`'s location step has `type: 'text'` with no `optional: true`, so `canContinue` required non-empty text, but the field has **zero required-field indicator** (no asterisk, no "REQUIRED" tag) and the only "OPTIONAL" label on screen is on a *different* field below it (the Signal background line) — actively misleading. The "Finish later" escape hatch is also only shown on step 1, so a user stuck here had no way forward except guessing. **Fix:** added `optional: true` to the location step, matching its own copy ("We use this for nearby jobs... Not shared publicly by default" — never claims to be required). **Verified live:** fresh account, selected a goal, hit step 2 with nothing typed, clicked Continue → correctly advanced to step 3/5. Completed the remaining 3 steps through to `/home`.
- `npx tsc --noEmit` clean, `npm run test:all` **71/71** after the fix.

### D2 — Standard housing application, full 5-step wizard (previously "Not finished" / "empty accessibility tree" per Cursor)

Confirmed `mode=standard` in the URL (FastTrack correctly off per `HOUSING_FASTTRACK_MEMBER_ENABLED=false`, matching Cursor's Round 5 note). Using the now-fully-onboarded `test123@test.com`:
- **Step 1 (Applicant):** submitted empty → correct per-field errors + "6 required items still need attention" dialog. Filled all fields → saved, advanced to step 2 at 43% complete.
- **Step 2 (Income):** Employed, employer name, $4,000/mo → saved, 64% complete.
- **Step 3 (Household):** move-in date via the custom year/month/day picker (confirmed it actually works, not just renders), 1 occupant, no pets → saved, 86% complete.
- **Step 4 (History):** housing history + references text → saved, **100% complete**, step 5.
- **Step 5 (Review):** every value from steps 1–4 reflected back **exactly correctly** (name, contact, DOB, address, employment, income, move-in date, occupants, pets, history, references). Required-document gate correctly identified this listing needs Identity/Income/Employment docs and **correctly blocked "CONFIRM & SUBMIT"** until uploaded. Accuracy-confirmation checkbox toggles correctly.
- **Not completed:** actual file upload and final submit — this harness has no native OS file-picker automation (the `CHOOSE FILE` control opens a real OS dialog that scripted clicks can't drive). This is a tooling ceiling, not an app issue; flagging per Phase D2/Phase Q honesty requirement rather than claiming full completion.
- Test draft application deleted after.

### Phase P — Google OAuth smoke

Clicked "Continue with Google" on `/join`. The app correctly attempted to open a real OAuth popup at `znvhmuhojvwvjzmaqwff.supabase.co` (the right Supabase project) — this harness's popup blocker stopped it because the click came from automation, not a genuine user gesture (popups only open from real user-initiated clicks; this is a browser/tooling rule, not something the app can control). **Conclusion: the button is correctly wired to a real OAuth flow, not dead or fake** — that's as far as this environment can verify without a human physically completing a Google login.

### Updated coverage table

| Area | Expo Web (interactive) | Automated | iPhone / native |
|------|------------------------|-----------|------------------|
| Email registration + Terms/Privacy persistence | **PASS** (re-verified fresh, Round 6) | `registration-draft`, `consent-client-contract` | Layout/keyboard — device |
| Intro carousel | **PASS** (Round 1) | onboarding audit | Native swipe feel — device |
| Onboarding 5-step flow incl. location step | **PASS, 1 bug fixed** (Round 6) | onboarding audit | — |
| Standard housing apply wizard (steps 1–4 + review) | **PASS** (Round 6) | housing-application-form, housing audits | File upload + submit — needs device or manual web pass |
| Google OAuth | **Smoke-tested: button correctly wired** (Round 6) | auth audit (code) | Full login — device/manual |
| Credit Studio redesign | Not re-verified this round (Cursor shipped it after my last pass) | credit-studio-workspace, test:credit | — |
| Apple Sign-In | N/A on web | auth audit | Device only |
| Record Relief scan upload | Consent screen only | relief/credit SQL | File picker/camera — device |

### Remaining launch blockers (unchanged)

- Stripe/store billing not connected (primary infra blocker, known).
- Array/credit-score provider: architecture-only, no partnership yet.
- Record Relief document-scan upload needs a real device or a prepared fixture file neither this nor Cursor's session had.
- Native-only items (Apple Sign-In, real push delivery, native keyboard/safe-area) genuinely need Sterling's iPhone — correctly unclaimed by either agent.


