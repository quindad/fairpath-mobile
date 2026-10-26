# On-device journey results (fill after physical test)

**Tester:** (pending on-device pass)  
**Date:** 2026-10-26  
**Dev client build ID:** `e52815e1-884a-4f3b-be7e-7b376a4f28f6` (profile `development-signal`, `expo-location` + Signal/My Path JS at `bf177c7`)  
**Install page (QR on iPhone Safari):** https://expo.dev/accounts/fairpathfwd/projects/fairpath-mobile/builds/e52815e1-884a-4f3b-be7e-7b376a4f28f6  
**Direct IPA:** https://expo.dev/artifacts/eas/qCkRpotB0LgItlrvcna2-eEqEvImI4-XJ7msAewsTFU.ipa  
**Git HEAD:** `bf177c7`  
**Metro (same Wi‑Fi):** `exp://192.168.40.7:8083`  
**Metro URL:** `npx expo start --dev-client --lan --port 8083` (scan QR from terminal after install)  
**Authenticated DEV QA (2026-10-26 ~20:45 UTC):** gateway **PASSED** (200, 3 resultCards); My Path sync **PASSED**; legacy `member-focus-guidance` smoke adjusted (Signal 2.0 uses `fairpath-ai-gateway`).  

| Step | Pass/Fail | Notes |
| --- | --- | --- |
| GPS permission granted → location hint in Signal | | |
| GPS denied → manual ZIP fallback works | | |
| Signal: job + transportation query | | |
| Real result cards (not empty/error-only) | | |
| Card tap → correct screen | | |
| Save to My Path | | |
| Force-close → reopen → plan on device | | |
| Sign-in → cloud plan persists | | |

**Blockers / screenshots:**
