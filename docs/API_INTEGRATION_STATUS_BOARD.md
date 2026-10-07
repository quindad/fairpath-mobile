# API Integration Status Board

Updated: 2026-10-06 · DEV only · Method: name-only audit. No secret value was read, printed, copied or committed.
No live provider call was made. No charge, subscription, donation, payment, migration or deploy was created.

Status key: **pass / fail / not tested**. "Credential configured" means the variable name is referenced by code. It does not prove the value is set in the platform secret store.

## Why no live tests ran in this pass

- Provider keys for server-side use are Edge Function secrets in Supabase. The Supabase CLI is not installed in this environment, so the secret names could not be listed.
- Testing a provider would require reading the secret value into this session. That is outside the security boundary, so I did not do it.
- Next action for you: confirm the secret names exist in the DEV project's secret store (names only), and approve a single-purpose, DEV-only test runner that reads secrets server-side and prints only pass/fail.

## Board

| Provider | Credential names referenced | Configured | Auth | Endpoint functionality | Sandbox / DEV | Rate limits | Cost considerations | Licensing / restrictions | Blockers | Next action |
|---|---|---|---|---|---|---|---|---|---|---|
| Supabase | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (client); `SUPABASE_SERVICE_ROLE_KEY` (server) | Client: yes (`.env.local` names present). Server: referenced, store not verified | not tested | not tested | DEV project only (`znvhmuhojvwvjzmaqwff`) | Plan-dependent; not checked | Plan-dependent | Service-role key must never reach the client | Supabase CLI not installed; local Postgres lacks `pg_net` / `pg_cron` (20 SQL checks blocked) | Install CLI or confirm dashboard secret names; fix local Postgres image |
| AI provider (Anthropic) | `ANTHROPIC_API_KEY` (server, Edge Functions) | Referenced; store not verified. You report the key is in Supabase. | not tested | not tested | No separate sandbox; use a low-cost smoke call | Not checked | Each call costs money. Smoke test must be minimal and approved. | Usage must be tracked against frozen credit debits | Live test needs approval; server-side only | Approve one minimal DEV smoke call run server-side that prints only status code |
| AI provider (OpenAI, Google) | None referenced in code | No | not tested | not tested | — | — | — | Document-vision fallbacks not built | Not integrated in mobile code | Decide whether to add; no keys referenced |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (server); `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client) | Referenced; store not verified | not tested | not tested | Test mode only | Stripe test-mode limits | Test mode is free; live is not | Live Stripe products must not change | Confirm the key is a test-mode key. Do not create products or charges without approval. | Verify key mode by prefix only; test webhook signature with a local fixture |
| Apple Pay / Google Pay | `EXPO_PUBLIC_APPLE_MERCHANT_ID`, `EXPO_PUBLIC_GOOGLE_PAY_ENABLED` | Referenced in `.env.example`; not in `.env.local` | not tested | not tested | Device-only | — | Apple developer account cost | Requires merchant setup | No merchant ID configured locally; needs physical device | Document requirement; defer |
| Housing screening | None referenced | No | not tested | not tested | — | — | Screening vendors typically charge per report | Legal and operational validation required before any promise | No vendor selected or integrated | Choose vendor; no tests possible yet |
| Jobs feeds | None referenced | No | not tested | not tested | — | — | — | Employer and feed terms required | No feed selected | Identify authorized feed providers |
| Maps / geolocation | None referenced | No | not tested | not tested | — | — | Map SDK usage costs | — | No map key configured | Choose provider; key needed |
| Notifications (push / email) | None referenced by name. In-app inbox exists. | No external provider | not tested | not tested | — | — | — | — | No push or email provider configured | Choose provider; no SMS without approval |
| Giving (test-mode donations) | None referenced | No | not tested | not tested | — | — | — | Charitable collection not permitted until FairPath Corp is recognized | Not built; contract-only in V2 | Keep disabled |
| Academy: course providers | None referenced | No | not tested | not tested | — | — | — | Each provider's API terms required (see below) | No authorized credentials exist in the repo | Research terms; do not scrape |

## Academy source research (no access granted yet)

Each source needs its terms recorded before any request is made. Status for every source: **not tested, no credentials**.

| Source | Known access path (to verify) | Blocker |
|---|---|---|
| Coursera | Partner API; terms restrict scraping | Partnership agreement required |
| edX, MIT OpenCourseWare, OpenLearn, Khan Academy, Saylor, freeCodeCamp | Open or public content; verify each license | Verify commercial-use and attribution terms |
| IBM SkillsBuild, Microsoft Learn, Google, Cisco, AWS | Vendor programs; verify catalog or feed terms | Verify whether listings may be republished |
| Apprenticeship.gov, U.S. Department of Labor, state workforce agencies | Public resources; verify reuse terms | Verify data reuse and refresh limits |

Target of hourly refresh applies only where a provider's terms permit it.

## Security boundaries observed

- No secret value printed, committed or written to any file.
- No production write, charge, subscription, donation or migration.
- No deployment or remote push.
