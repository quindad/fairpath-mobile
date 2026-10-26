# On-device journey results (fill after physical test)

**Tester:** (pending on-device pass)  
**Date:** 2026-10-26  
**Dev client build ID:** `1280d58b-0bbb-4b1f-8725-7e7848a94d4c` (profile `development-signal`, includes `expo-location`)  
**Install page (QR on iPhone Safari):** https://expo.dev/accounts/fairpathfwd/projects/fairpath-mobile/builds/1280d58b-0bbb-4b1f-8725-7e7848a94d4c  
**Git HEAD:** `0aa7f67`  
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
