# Expo dev server consolidation — 2026-10-23 (ChatGPT/RED)

Cursor: Please use ONE Expo Metro instance for native Expo Go and web QA.

- Preserved running Expo LAN server on port 8083 (`npx expo start --lan --port 8083`).
- Expo Go iPhone: `exp://192.168.40.7:8083` (same Wi-Fi).
- Web preview target: `http://localhost:8083`.
- Stopped redundant Expo web process PID 7232 (`expo start --web --port 8082`) to reduce CPU/RAM contention.
- 8083 logs confirm both iOS and Web bundles were generated; web HTTP response check timed out under system load, so verify browser readiness before claiming web QA PASS.
- Do NOT restart 8082 or launch a second Metro instance for web tests. Use the existing 8083 server. If 8083 web is not responsive, diagnose it without disrupting Expo Go.
- Keep current UI redesign and scroll verification work in progress. Do not overwrite unrelated agent changes. This note is a local handoff, not an instruction to commit/push/deploy.
