# Physical device QA plan

An executable checklist for when Sterling has real dev builds on real hardware. Nothing in this document has been
run — every row starts as NOT TESTED. Do not mark anything PASS without actually running it on the named device.

Columns: **TEST** | **iOS** | **Android** | **EXPECTED** | **ACTUAL** | **PASS/FAIL** | **BUG ID** | **NOTES**

| TEST | iOS | Android | EXPECTED | ACTUAL | PASS/FAIL | BUG ID | NOTES |
|---|---|---|---|---|---|---|---|
| Fresh install | — | — | App installs and opens without crash | | | | |
| Cold launch (first ever open) | — | — | Onboarding/sign-in screen appears, no blank screen | | | | |
| Registration (email/password) | — | — | Account created, redirected correctly | | | | |
| Email login | — | — | Signs in, lands on Home | | | | |
| Sign in with Apple | N/A on Android | — | Real Apple identity flow completes, profile name filled once | | | Needs Apple Developer capability + Supabase provider + dev-client rebuild first — currently blocked, not yet buildable |
| Sign in with Google (native) | — | — | Real Google OAuth completes | | | | Needs DEV Supabase dashboard config confirmed first (see Sterling queue) |
| Session restore (kill app, reopen) | — | — | Still signed in, no re-login required | | | | |
| Sign out | — | — | Returns to sign-in, no stale data visible on next sign-in as a different user | | | | Also verifies cross-session isolation on a shared device |
| Keyboard (all form screens) | — | — | Keyboard never covers the active field, "next" moves focus correctly | | | | |
| Date picker | — | — | Opens, scrolls, sets correctly on both platforms' native feel | | | | |
| Camera / photo upload | — | — | Permission prompt, photo captured, uploads successfully | | | | |
| File picker | — | — | Can select an existing file (not just camera) for upload | | | | |
| Credit report upload (PDF/image) | — | — | Uploads privately, appears in Credit Builder | | | | |
| Native maps rendering | — | — | Apple Maps (iOS) / Google Maps (Android) render with pins | | | | Android needs Maps API key configured first — currently blocked |
| Location permission prompt | — | — | Correct OS-native prompt, graceful denial handling | | | | |
| Directions (external maps handoff) | — | — | Opens the OS's own Maps app with the right destination | | | | |
| PDF generation + open | — | — | Generates, opens in-app or hands off correctly | | | | |
| DOCX generation + open | — | — | Generates, opens in Word/a compatible app | | | | |
| ZIP generation (multi-doc packet) | — | — | Generates, extracts correctly | | | | |
| Save to Files (iOS) / Save (Android) | — | — | File appears in the OS's file system, reopenable later | | | | |
| Share sheet | — | — | Native share sheet opens with the right file attached | | | | |
| Print | — | — | Native print dialog opens, renders correctly | | | | |
| Open in Word | — | — | DOCX opens correctly, formatting intact | | | | |
| Open in Pages (iOS) | — | — | DOCX opens correctly in Pages | | | | |
| Open in Google Docs | — | — | DOCX opens/converts correctly | | | | |
| External meeting link (Zoom/Meet/Teams) | — | — | Opens the correct external app or browser | | | | |
| Deep link (e.g. from a notification) | — | — | Opens directly to the right in-app screen | | | | |
| Push notification received | — | — | Notification appears, correct title/body | | | | Blocked entirely today — no client token registration exists yet (see launch board) |
| Push notification tap | — | — | Opens the correct deep-linked screen | | | | Same blocker |
| Background / resume | — | — | App state preserved correctly after backgrounding and returning | | | | |
| Offline (airplane mode mid-session) | — | — | Honest "no connection" messaging, no crash, no infinite spinner | | | | |
| Reconnect after offline | — | — | Recovers automatically or with a clear retry action | | | | |
| Dark mode | — | — | Renders correctly | | | | Extensively verified in the Browser pane already — device verification is about native chrome (status bar, etc.), not the app's own theming |
| Light mode | — | — | Renders correctly | | | | Same note |
| Small-screen overflow (smallest supported device) | — | — | No clipped text, no unreachable controls | | | | |

## How to use this

1. Sterling installs the current dev build on both an iPhone and an Android device.
2. Go row by row. For each, fill ACTUAL and PASS/FAIL honestly — a screen that "mostly works" is FAIL with notes,
   not PASS.
3. Anything that fails gets a real bug filed (BUG ID column references it), not silently reattempted until it
   happens to work.
4. Several rows are pre-marked as blocked on an external dependency (Apple/Google auth config, Android Maps key,
   push) — those stay NOT TESTED until that dependency is resolved, not skipped silently.
