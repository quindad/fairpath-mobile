# Phone dev quickstart (Expo dev client)

FairPath Mobile uses **`expo-dev-client`** (SDK 57). Stock **Expo Go** does not cover every native module (Apple Sign-In, Stripe, full maps). Use a **development build** on your phone and load JS from your PC.

**DEV Supabase:** `znvhmuhojvwvjzmaqwff` — see `.env.example` → `.env.local`.

---

## 1. One-time: env on your PC

```powershell
cd fairpath-mobile
copy .env.example .env.local
```

Fill `EXPO_PUBLIC_SUPABASE_ANON_KEY` from Dashboard → **fairpath-mobile-dev** → Settings → API.

---

## 2. One-time: install a dev build on the phone

**FairPath iOS bundle ID (separate from Friend A Felon):** `com.fairpathfwd.fairpathmobile` · Apple team **H2BNT8CR6Q**.

**Reuse existing build first** (SDK 57, profile `development`): open on the iPhone →  
https://expo.dev/accounts/fairpathfwd/projects/fairpath-mobile/builds/8c03f2b0-53ee-4924-b3a0-1af24b93940b  
Internal installs **expire** (~14 days). If the link fails, owner approves a fresh build:

```powershell
npx eas-cli@">=24.8.0" build --profile development --platform ios
```

Set EAS **development** env vars in the Expo dashboard before rebuilding: `EXPO_PUBLIC_SUPABASE_URL` = DEV (`znvhmuhojvwvjzmaqwff`), `EXPO_PUBLIC_SUPABASE_ANON_KEY` = DEV publishable key (never commit). With a dev client, Metro on your PC still rebundles JS from `.env.local` for day-to-day work.

Register a new iPhone if install says device not registered:

```powershell
npx eas-cli@">=24.8.0" device:create --apple-team-id H2BNT8CR6Q
```

Docs: [Development builds](https://docs.expo.dev/develop/development-builds/introduction/).

---

## 3. Every session: PC serves JS, phone runs the app

On the **PC** (same folder, `.env.local` present):

```powershell
npm run start:dev-client
```

(Reuses Metro port **8083** when you already run Expo there.)

**Same Wi‑Fi as the phone:** scan the QR code with the **FairPath dev client** (not Expo Go).

**Different network (cellular, guest Wi‑Fi):**

```powershell
npx expo start --tunnel
```

Tunnel is slower but works from anywhere. Shake the device → enter the `exp://…` URL if the QR fails.

---

## 4. Sign in and run manual QA

- Accounts: `docs/DEV_TEST_ACCOUNTS.md` (local vault).
- Checklists: `docs/DEV_MANUAL_MEMBER_QA.md`, `docs/AUTH_E2E_BROWSER_CHECKLIST.md`.
- Deep links: scheme **`fairpathmobile://`** (auth callback, password reset).

---

## 5. Quick web fallback (no dev build yet)

```powershell
npm run web
```

On the phone browser, open `http://<your-PC-LAN-IP>:8081` (port from the Expo terminal). Good for auth and browsing; not a substitute for native QA (maps, Apple Sign-In, push).

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| App shows “Supabase config missing” | `.env.local` on PC; restart `npm start` |
| “Unable to connect” to Metro | Try `--tunnel`; disable VPN; allow Node through firewall |
| Android map is gray | Set `GOOGLE_MAPS_ANDROID_API_KEY` and rebuild dev client (`app.config.js`) |
| Signal returns fallback only | Edge secrets on DEV — `docs/SIGNAL_DEV_DEPLOY.md` |

**This is not Cursor remote control** — you edit on PC in Cursor; the phone only runs the Expo dev client talking to Metro.
