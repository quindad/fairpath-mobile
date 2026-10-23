# iPhone native QA setup (P0-009)

**Status:** Physical iPhone testing **not executed** in automated batches. This doc is the shortest approved path when the founder is ready.

---

## Why Expo Go alone is insufficient

`package.json` includes **`expo-dev-client`** and **`@stripe/stripe-react-native`**. Stripe and some native modules require a **development build**, not the generic Expo Go app.

**Do not claim P0-009 complete from:** static audits, web preview only, or simulator-only without explicit note.

---

## Prerequisites (machine)

1. `.env.local` with DEV Supabase URL + anon key (same as mobile app).
2. Apple Developer team access for **internal** dev client install (no App Store submission required for internal/ad hoc).
3. iPhone on same LAN as dev machine (or tunnel — prefer LAN for Metro).

---

## Path A — Development client (recommended)

1. **One-time build** (requires EAS approval / Apple credentials — not run in CI batch):
   ```powershell
   npx eas build --profile development --platform ios
   ```
   Profile defined in `eas.json` (`developmentClient: true`, `distribution: internal`).

2. Install the `.ipa` on iPhone (TestFlight internal or ad hoc per org process).

3. **Start Metro** (reuse port **8083** if already running):
   ```powershell
   npx expo start --dev-client --port 8083
   ```

4. Open the **FairPath dev client** on iPhone → scan QR or enter URL from terminal.

5. **Sign in** with DEV test account (password from vault — never log).

---

## Path B — Expo Go (limited smoke only)

Use only for **non-Stripe** screens if dev client unavailable:

```powershell
npx expo start --port 8083
```

**Limitations:** Payment flows, some native modules may crash or no-op. Document any test run as **partial**.

---

## P0-009 manual checklist (iPhone)

- [ ] Cold launch → intro/guest browse → sign-in
- [ ] Five tabs: Home, Explore, My Path, Signal, Me — no crash
- [ ] Keyboard: sign-up, job search, Signal composer — fields visible above keyboard
- [ ] Safe area: notch/home indicator; no CTAs hidden under tab bar
- [ ] Back: hardware/back gesture from job detail, settings, legal docs
- [ ] Auth return: signed-out save job → sign-in → returns to job detail (`returnTo`)
- [ ] Record Relief: create case → save → eval result (requires DEV backend + migration per RR packet)

---

## Blockers if testing cannot start

| Blocker | Action |
|---------|--------|
| No dev client installed | Run EAS development build (owner approval) |
| No Apple signing | Owner configures team in EAS |
| Metro port conflict | Stop duplicate servers; use `--port 8083` |
| DEV auth failure | Verify `.env.local` points to DEV ref `znvhmuhojvwvjzmaqwff` |

---

## QA disposable session (web, not iPhone)

`node scripts/qa-dev-ui-session.mjs --confirm-dev` — creates `@dev-seed.fairpath.test` user for **web** preview; useful for layout, **not** P0-009 sign-off.
