# iOS native startup recovery — comprehensive plan (P0)

## Phase 1 — Inventory (JS bundle vs installed binary)

| Layer | Finding |
|-------|---------|
| **Installed binary** | EAS **`development-signal`** (e.g. build `e52815e1`). `FAIRPATH_IOS_QA_MINIMAL=1` strips **push** + **Apple Sign In** from prebuild (`app.config.js`). |
| **JS bundle** | Full app from Metro: includes Stripe, notifications, print, maps, document picker in `package.json`. |
| **Mismatch** | Any package that calls `requireNativeModule` / `TurboModuleRegistry.getEnforcing` at **import time** crashes if that native code was not linked into the dev client. |
| **Stripe on minimal build** | Plugin remains in config, but older or partial dev clients may still lack **`StripeSdk`** — treat as optional at startup. |

### Native probes (runtime, no fake modules)

Central module: `src/core/native/native-module-capability.ts`

| Capability | Native probe |
|------------|----------------|
| Push | `ExpoPushTokenManager` |
| Print | `ExpoPrint` |
| Share | `ExpoSharing` |
| Apple Sign In | `ExpoAppleAuthentication` |
| Stripe | `StripeSdk` |
| Maps | `RNMapsAirModule` / `AirMapModule` |

### Startup import graph from `_layout.tsx`

| Import | Risk | Mitigation |
|--------|------|------------|
| `PaymentsProvider` → `.native.tsx` | **StripeSdk** | Lazy `loadStripeReactNativeModule()` |
| `push-registration` (via effect) | **ExpoPushTokenManager** | Lazy notifications + `unavailable` |
| `ErrorBoundary`, `ThemeProvider`, `NotifyHost` | Low | No optional native at import |
| Expo Router / tabs | **Cascade** | See Phase 2 |

Route-level `.native` files (`JobMap`, `HousingMap`, `deliver`, `payment-sheet`) load only when those screens run; guarded the same way.

## Phase 2 — Startup resilience (implemented locally)

- **`_layout.tsx`**: no static `expo-notifications`.
- **`PaymentsProvider.native.tsx`**: no static `@stripe/stripe-react-native`.
- **`payment-sheet.native.ts`**: lazy Stripe; honest error if SDK missing.
- **`deliver.ts`**: lazy print/share.
- **`push-registration.ts`**: lazy notifications.
- **`social-auth.ts`**: probe before `expo-apple-authentication` import.

### Expo Router `ErrorBoundary of undefined`

Observed at `expo-router/build/useScreens.js` when destructuring a **failed route module** (`fromImport`). This is typically a **follow-on error** after an earlier native import throws during route evaluation — not a separate router bug. **Do not patch `node_modules`.** After startup imports are guarded, re-test; the router error should disappear.

## Phase 3 — Full `development` iOS dev client (operator)

**Profile:** `development` (not `development-signal`).

**Before build:**

```bash
npx expo-doctor
npx expo install --check   # review SDK 57 patch updates; apply when approved
```

**Build (approval required):**

```bash
eas build --profile development --platform ios
```

**Native modules expected in prebuild:** `expo-notifications`, `expo-apple-authentication`, `@stripe/stripe-react-native`, `expo-location`, `expo-print`, `expo-sharing`, `expo-dev-client`, plus autolinked deps from `package.json`.

**Apple Developer:** Push Notifications + Sign in with Apple (+ Apple Pay merchant only if `APPLE_MERCHANT_ID` set for EAS).

**Install:** Over-the-air from EAS install page; avoid uninstall until new `.ipa` is ready (see [DEV_IOS_NATIVE_BUILD_RECOVERY.md](./DEV_IOS_NATIVE_BUILD_RECOVERY.md)).

## Phase 4 — Regression gates

```bash
npx tsc --noEmit
node scripts/audit-native-startup.mjs
node scripts/audit-security.mjs
npm run test:all
```

Device acceptance (physical iPhone):

1. Cold start — no red screen.
2. Home + five tabs.
3. Signal — send a message.
4. Credit Studio opens.
5. Push / print / Stripe — work on **`development`** build; show unavailable or degraded on **`development-signal`** without crashing.

## Boundaries

DEV only. No commit/push/EAS without explicit approval. Minimal build is **not** a substitute for full **`development`** when testing payments, push, or print.
