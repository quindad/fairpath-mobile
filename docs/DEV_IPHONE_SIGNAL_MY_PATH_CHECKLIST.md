# iPhone DEV checklist — Signal → My Path (2026-10-26)

**Branch:** `development/mobile-v1-completion` · **DEV ref:** `znvhmuhojvwvjzmaqwff`

Use the **development client** (not Expo Go). The last finished iOS development build on EAS predates the `expo-location` plugin (`292a0d5`); install a **new** `eas build --profile development --platform ios` before GPS tests.

## Before you open the app

- [ ] `.env.local` points at DEV Supabase (same as QA scripts).
- [ ] Metro: `npx expo start --dev-client --port 8083` (iPhone on same Wi‑Fi).
- [ ] Signed in as `dev-free@fairpath.test` or `dev-plus@fairpath.test` (password via `Start-DevQaSession.ps1` only).

## Location

- [ ] **Allow GPS:** Signal or Explore shows a location hint (ZIP/radius), not only generic copy.
- [ ] **Deny GPS:** Settings → FairPath → Location → Never; reopen app → manual ZIP fallback still returns job/resource results.
- [ ] Optional: Profile location ZIP matches or overrides device ZIP as designed.

## Signal journey

- [ ] Open **Signal** tab; composer stays above keyboard when typing.
- [ ] Send: *I need a job and transportation near me.*
- [ ] Wait for orchestrator phases (no crash); response includes **result cards** (job and/or resource kinds).
- [ ] Tap a card → correct route (`/find-jobs/…`, resource detail, etc.).
- [ ] Use **Save to My Path** (or equivalent action on a card) for at least one item.

## My Path persistence

- [ ] **My Path** shows saved next steps / plan preview after save.
- [ ] Confirm save (if preview step) — toast must **not** claim cloud sync unless signed in and table live.
- [ ] **Force-close** the app (swipe away), reopen → plan still visible on device.
- [ ] Sign out / sign in same account → cloud rows return (after authenticated QA script PASS).

## Regression spot-checks

- [ ] Five tabs load (Home, Explore, My Path, Signal, Me).
- [ ] Back navigation from job detail and Signal attachment → letter explainer.

## Automated parity (run on PC after session)

After dot-sourcing `scripts/Start-DevQaSession.ps1`:

```powershell
node scripts/Run-DevAuthenticatedQa.mjs --confirm-dev --use-documented-dev-accounts
```

Credential-free checks (agent or CI): `node scripts/qa-dev-public-search-endpoints.mjs`, `node scripts/probe-dev-integration-schema.mjs`.
