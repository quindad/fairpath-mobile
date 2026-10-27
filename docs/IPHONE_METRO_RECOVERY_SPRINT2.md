# iPhone + Metro recovery — Sprint 2

**Verified on dev PC (2026-10-26 evening):**

| Check | Result |
|-------|--------|
| Metro `/status` on `127.0.0.1:8083` | **HTTP 200** |
| Metro `/status` on `192.168.40.7:8083` | **HTTP 200** |
| PC LAN IPv4 | **192.168.40.7** (unchanged) |
| iOS JS bundle | **HTTP 200**, ~5.9 MB — `node_modules/expo-router/entry.bundle?platform=ios&dev=true` |

**Conclusion:** Metro is running and the bundle **compiles**. If the iPhone dev client shows a blank screen, spinner, or “Could not connect”, the failure is almost certainly **client connection**, **stale URL**, or **on-device runtime** — not “Metro is down.”

## One precise user action (do this first)

1. On the iPhone, **force-quit** the FairPath development client.
2. On the PC, in the terminal where Metro is running, press **`c`** to open the dev menu QR/URL (or note the printed `exp://` URL).
3. Ensure the URL uses **`192.168.40.7:8083`** (not an old IP).
4. iPhone and PC must be on the **same Wi‑Fi** (no guest network isolation).
5. Open Safari on the iPhone and visit: `http://192.168.40.7:8083/status` — you should see a JSON status payload.  
   - If Safari **fails**: fix Wi‑Fi/firewall before reopening the app.  
   - If Safari **works**: reopen the dev client and **Scan QR** or **Enter URL manually**: `exp://192.168.40.7:8083`

**Report back:** (A) Safari status OK or not, (B) what the dev client shows after reconnect (screenshot or exact error text).

## Do not restart Metro unless

- `/status` fails on the PC, or  
- bundle URL above returns non-200, or  
- Metro logs show a redbox compile error.

## After app loads — Sprint 1/2 Signal acceptance

1. All five tabs.
2. Signal → keyboard + send.
3. Prompt: `I need a job and transportation near me.` (no ZIP, then with Columbus ZIP in location settings).
4. Credit Studio → Signal text has no raw `**` markdown.

Record results in [FAIRPATH_MOBILE_MASTER_COMPLETION_BOARD.md](./FAIRPATH_MOBILE_MASTER_COMPLETION_BOARD.md) device section.
