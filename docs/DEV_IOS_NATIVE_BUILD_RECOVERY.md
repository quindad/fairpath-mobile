# iOS native module crash recovery (P0)

## Root cause (verified)

The installed Ad Hoc dev client (**build `e52815e1`**, EAS profile **`development-signal`**) was compiled with **`FAIRPATH_IOS_QA_MINIMAL=1`**.

That profile intentionally:

- Removes **`expo-notifications`** and **`expo-apple-authentication`** from the native prebuild (`app.config.js`).
- Strips **push** and **Sign in with Apple** entitlements (`plugins/withFairpathIosQaEntitlements.js`).

The JavaScript bundle still **statically imported** optional native packages at startup (`expo-notifications` in `_layout.tsx`, `@stripe/stripe-react-native` in `PaymentsProvider.native.tsx`, `expo-print` / `expo-sharing` in `deliver.ts`). Those packages call `requireNativeModule` / `TurboModuleRegistry.getEnforcing` at import time, which throws **`ExpoPushTokenManager`**, **`StripeSdk`**, **`ExpoPrint`**, etc., when the binary never linked them.

This is a **native/JS mismatch**, not a Metro or bundling failure.

## Code fix (JS — works on current minimal build)

- `src/core/native/native-module-capability.ts` — probe with `requireOptionalNativeModule` before any package import (push, Stripe, print, share, Apple Sign In, maps).
- `src/app/_layout.tsx` — lazy notification handler + tap listeners.
- `src/components/PaymentsProvider.native.tsx` — lazy Stripe provider when `StripeSdk` exists.
- `src/core/payments/payment-sheet.native.ts` — lazy Stripe PaymentSheet; honest error when SDK missing.
- `src/core/notifications/push-registration.ts` — returns `unavailable` when push native code is missing.
- `src/core/documents/deliver.ts` — lazy print/share; honest UI messages when capability absent.

Full plan: [DEV_IOS_NATIVE_STARTUP_RECOVERY_PLAN.md](./DEV_IOS_NATIVE_STARTUP_RECOVERY_PLAN.md).

After Metro reload, the app **should launch** on build `e52815e1`. Push registration and in-app print stay **disabled** until a full-capability binary is installed.

Regression: `tests/native-capability-contract.test.ts` (wired in `scripts/run-all-tests.mjs`).

## Full-capability dev client (push + print + Apple Sign In)

Use EAS profile **`development`** (not `development-signal`). It does **not** set `FAIRPATH_IOS_QA_MINIMAL` and keeps all plugins from `app.json`.

### Prerequisites

- Apple Developer: **Push Notifications** capability on `com.fairpathfwd.fairpathmobile` (required for `expo-notifications`).
- **Sign in with Apple** capability if you test Apple auth.
- EAS credentials logged in on the build machine.

### Build (operator — approval required)

```bash
eas build --profile development --platform ios
```

When the build finishes, open the install URL from the EAS dashboard (QR / `expo.dev/accounts/fairpathfwd/projects/fairpath-mobile/builds/...`).

### Install without losing data (recommended)

1. **Do not uninstall** the current app until the new `.ipa` is downloaded and ready.
2. Install the new dev client over the existing app (same bundle id). iOS typically preserves app data; treat this as *usually* safe, not guaranteed for dev clients.
3. If install fails due to signature/provisioning mismatch, note that removing the old app clears local dev-client data — export anything you need first.

### Metro (unchanged)

- Port **8083**, LAN mode.
- Dev client URL: **`exp://192.168.40.7:8083`** (replace with your PC’s current LAN IP).
- Phone Safari check: `http://<LAN-IP>:8083/status` → **200**.

See also [IPHONE_METRO_RECOVERY_SPRINT2.md](./IPHONE_METRO_RECOVERY_SPRINT2.md).

## Profile comparison

| Profile | Native push | Apple Sign In | Location (Signal) | Use when |
|---------|-------------|---------------|-------------------|----------|
| **`development`** | Yes (if Apple capability provisioned) | Yes | Yes | Default FairPath dev client |
| **`development-signal`** | **No** (stripped) | **No** | Yes | Legacy Ad Hoc QA without push entitlements |

**Do not** treat `development-signal` as the long-term dev client if you need notifications or document print from FairPath’s export UI.

## Verify after fix

1. Cold start — no red screen / native module errors.
2. All five tabs load.
3. Credit Studio / document export — Share works if `ExpoSharing` is in the binary; Print only if `ExpoPrint` is linked (full `development` build).
4. Notification settings — push registration returns unavailable on minimal build; succeeds on full build after permission grant.
