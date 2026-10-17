# Record Relief DEV gateway — release review (2026-10-15)

**Decision: NO DEPLOY / NOT YET READY FOR APPROVAL.** Local code and mock tests are not proof of an authenticated deployed function or a working Redis REST integration. This is a proposal, not permission to push, configure secrets, deploy, apply SQL or touch production.

## Current implementation

- `src/core/record-relief/public-evaluation.ts`: stateless adapter invoking existing nationwide `evaluateApiRequest`; rejects unsupported jurisdiction, malformed charge, duplicate charge ID, invalid dates, member identity fields, >100 charges, and oversized requests.
- `supabase/functions/public-record-relief-dev/handler.ts`: server-to-server integration secret check (constant-time helper), exact Origin check, JSON and body-size checks, injected shared limiter, privacy-safe errors, no database client. Origin is defense-in-depth, **not authentication**; callers can spoof Origin.
- `supabase/functions/public-record-relief-dev/index.ts`: Deno entry point; atomic Redis REST EVAL with `INCR` and first-use `EXPIRE`, 120 requests per hour **globally**. Fails closed on unavailable limiter. Does not log raw records. Redis REST provider compatibility and atomicity remain untested live.
- `supabase/config.toml`: `verify_jwt=false` for this DEV function only; safe ONLY with working integration secret and network controls. The function name is not a deployment environment guard. An explicit DEV project ref check and production deployment guard should be added before any deployment.
- Public website `src/lib/record-relief-dev-gateway.ts`: server-only helper; hard-blocked in `NODE_ENV=production`; no client component imports and no live checker wiring.

## Tests and checks

- 57/57 jurisdiction smoke (prior turn); legal-rule audit passed.
- 12/12 focused adapter/handler tests passed; secret/origin rejection, JSON/body limits, injected limiter 429 and failure 503, 57 jurisdictions, multi-charge, federal routing, source provenance.
- Mobile `npx tsc --noEmit`: exit 0; public website `npx tsc --noEmit`: exit 0.
- Still required: mock `fetch` tests for actual Redis EVAL payload/response/error semantics; Deno edge function bundling and live DEV-only synthetic smoke; deployment environment lock; security review for untrusted facts and response text; body-byte (not character) size enforcement; verify secret not logged or present in public bundle; validate error behavior under concurrent load.

## Required DEV configuration (names only — NEVER paste secret values into chat)

Edge Function: `PUBLIC_RELIEF_DEV_ALLOWED_ORIGIN`, `PUBLIC_RELIEF_DEV_SHARED_SECRET`, `PUBLIC_RELIEF_DEV_REDIS_URL`, `PUBLIC_RELIEF_DEV_REDIS_TOKEN`.

Website server: `RECORD_RELIEF_DEV_GATEWAY_URL`, `RECORD_RELIEF_DEV_GATEWAY_SECRET` (same value as function secret), `RECORD_RELIEF_DEV_GATEWAY_ORIGIN` (same as function allowed origin). These must be server-only variables, not `NEXT_PUBLIC_*`.

Use the exact DEV Supabase project reference `znvhmuhojvwvjzmaqwff`. Production project `rqpczemdagoddhuwefxt` is strictly prohibited. Do not use a shared Redis namespace with production. Before any deploy, verify the CLI target ref from `supabase/.temp/project-ref` and get separate explicit approval for function deployment and secret configuration.

## Rollback (requires separate approval to execute)

1. Disable the website DEV integration flag or remove its server-side URL; existing public checker continues using current fallback.
2. Disable/delete the DEV Edge Function through approved DEV-only process; do not affect authenticated `evaluate-record-relief` function.
3. Revoke/rotate DEV integration secret and Redis token through their owners; do not disclose values.
4. Inspect DEV request counts and error rates using metadata-only logs; do not retain uploaded court content.

## Go/no-go

NO-GO until Redis integration tests, byte-limit/security hardening, explicit DEV target guard, and isolated DEV deployment plan pass. No production feature activation, no AI provider enablement, no migrations, no pushes.

## 2026-10-15 security hardening follow-up

- Added `redis-limiter.ts` as an injectable, fail-closed atomic REST EVAL adapter. Tests inspect the exact script/expiry/key, 121st-request behavior, malformed JSON/results, HTTP errors, network outage, and simulated concurrency. **These are mock tests, not a live Redis integration proof.**
- Added `SUPABASE_URL` runtime identity guard requiring exactly `https://znvhmuhojvwvjzmaqwff.supabase.co`; do not assume the function name or local config prevents accidental production deployment. A deployment-script/CLI target preflight is still required.
- Handler and website server-only helper now enforce UTF-8 byte limits (64 KiB); synthetic multibyte test added.
- Scanned public site's `src/app`, `src/components`, and `src/lib` for imports of the DEV gateway and secret names: no client-side import references found. This is static inspection, not a bundle artifact audit.
- Focused tests now **17/17 passed**. TypeScript recheck is in progress until its process reports an exit code.
- No DEV URL, Redis instance, secrets, SQL, migration, push, deployment, or production change.

**Release decision remains NO-DEPLOY pending live DEV Redis REST compatibility test, Deno function bundling verification, production-target preflight script and independent security review of public facts/schema and logs.** Request explicit DEV deployment approval only after these gates; do not configure secrets or deploy from this checklist alone.

## Final deployment preflight follow-up

- Verified linked local Supabase project ref is DEV `znvhmuhojvwvjzmaqwff` (read only).
- Added `scripts/check-public-relief-dev-target.mjs` and tests; both preflight tests pass. Preflight **fails closed** when invoked without `FAIRPATH_DEPLOY_TARGET_REF=znvhmuhojvwvjzmaqwff` and `FAIRPATH_DEV_DEPLOY_CONFIRMATION=CONFIRM_FAIRPATH_DEV_ONLY`; confirmed exit 1. **No deploy attempted.** The preflight must be made mandatory in the eventual deployment script; a standalone optional check does not protect arbitrary CLI invocations.
- Neither Deno nor Supabase CLI found on current PATH; no Deno bundle or Supabase Edge Function packaging verification could be performed. Runtime `SUPABASE_URL` DEV check exists but is not a packaging/deployment guard.
- Redis REST `/eval` request shape, Lua INCR/EXPIRE and simulated concurrent counter responses tested against injected mocks. No Redis provider instance or token configured; live provider compatibility, TTL, atomicity and race behavior unverified.
- Input/output schema review: allowlist of top-level, case bundle, venue and charge keys now rejects unexpected identity fields; engine result maps an explicit set of output fields. **Remaining risks:** arbitrary nested `facts` values not strictly typed, optional charge/venue field types and lengths not comprehensively validated, engine `reasons` and `issues` need PII leak review; production-grade request body streaming and service-role absence must be verified in bundled artifact. The gateway's shared secret and Origin must not be treated as public browser authentication.
- Combined focused tests **20/20 pass** (including two DEV preflight tests and an unexpected-personal-field test). No live synthetic HTTP/Redis E2E run was possible.
- TypeScript and git diff checks initiated; record exact exit results when available.

**Final decision: NO-GO.** Required before explicit DEV deployment approval: install/locate approved Deno/Supabase tooling; verify Edge Function bundling; implement a mandatory deployment wrapper; finish nested input/schema hardening; test Redis provider with credentials stored directly in DEV secrets (never pasted in chat), plus synthetic DEV E2E after separate approval. No SQL, push, deploy, migration or production changes performed.

## Local preflight continuation

- Previous pending Mobile TypeScript rerun confirmed exit **0**.
- Public evaluation adapter now validates optional venue strings, charge `statute`, degreeLevel, payment flags, and scalar `facts` values; rejects nested fact objects and unknown case/charge fields. Focused tests **21/21 pass**. Limitation: scalar fact keys remain generic; exhaustive per-jurisdiction semantic fact schemas are not yet proven.
- Added `scripts/public-relief-dev-release-preflight.mjs` as a **read-only release preflight**. Without confirmation it exits **1**. With explicit DEV ref and confirmation in an isolated local shell it exits **0**. It never deploys. This check is NOT a mandatory hook on every possible Supabase CLI deployment command, so it cannot claim to block someone bypassing the script.
- Deno and Supabase CLI were not on PATH or found in checked standard local locations; bundling remains unverified. Installing or using remote CLI packages was not performed. A toolchain install requires review of an approved source/version.
- Live Redis REST compatibility remains unverified without DEV-only Redis endpoint/token configured securely outside chat. Mocked Redis EVAL tests pass; no network provider calls made.
- A live synthetic HTTP request and real Edge bundling are still outstanding. Server-only website helper is not wired to the public checker and has no configured DEV URL.
- **NO-GO** for deployment until bundling and provider verification; no push, deployment, SQL, migration, secret configuration or production change.

## 2026-10-15 official local toolchain installation

- Installed Deno **2.9.7** through verified WinGet package `DenoLand.Deno` from official Deno GitHub release; installer hash verified; exit 0. Local executable in WinGet user package path.
- Installed official Supabase CLI **2.121.0** via `npm install --prefix %LOCALAPPDATA%/FairPathDevTools/supabase-cli --no-save supabase@2.121.0`; exit 0. Installed **outside** FairPath repos. Verified CLI version and `functions --help`. CLI has no local build/bundle subcommand; `serve` requires a runtime/Docker workflow not invoked here.
- `deno check --no-config` **failed** due to existing extensionless imports in `rule-contract.ts` and `alabama.ts`. `deno check --no-config --sloppy-imports` **passed (exit 0)**. This is Deno type/dependency graph validation, **not bundling**.
- `deno bundle --no-config --sloppy-imports .../index.ts %TEMP%/fairpath-public-relief-dev-bundle.js` **failed (exit 1)** twice with Windows `os error 2` during Deno's experimental esbuild bundling. No valid bundle was produced. Do not claim release-ready.
- Focused tests **21/21 passed**. Unconfirmed DEV preflight failed closed (exit 1) as designed. Mobile and public website `git diff --check` exit 0, with non-blocking CRLF warnings. Latest TypeScript checks from previous GO passed both repositories; no fresh TypeScript run was made in this toolchain-only pass.
- No deploy, push, SQL, migrations, remote configuration, secrets, Redis calls, or production changes. No repository package install or lockfile changes.

**Decision: NO-GO.** Next work: resolve local Windows Deno bundle tooling issue or validate official Supabase packaging in an isolated local runtime, review extensionless import resolution, and test a configured DEV Redis REST provider (credentials only in approved DEV secret store). Explicit DEV deployment approval must remain separate.

## Windows bundling diagnosis and local packaging workaround

- Deno 2.9.7 `deno bundle` continues to fail with `os error 2` (exit 1), including `--no-npm --node-modules-dir=none`. It is an experimental bundler; the exact underlying missing file was not identified. Do not claim a confirmed root cause.
- Installed esbuild 0.25.5 **outside repos** at `%LOCALAPPDATA%/FairPathDevTools/edge-bundler` (npm package and platform binary). Invoked native esbuild with `--bundle --platform=neutral --format=esm --resolve-extensions=.ts,.tsx,.js` on `supabase/functions/public-record-relief-dev/index.ts`; **exit 0**, generated `%TEMP%/fairpath-relief-esbuild.js` **239,643 bytes**. Static inspection confirms `Deno.serve`, `/eval`, DEV project ref and legal-engine executor present. `PUBLIC_RELIEF_DEV_SHARED_SECRET` appears as an **environment variable name**, not an embedded secret value; this is not a full secret audit.
- `deno check --no-config --sloppy-imports` passed exit 0 previously; strict extension resolution still fails on pre-existing extensionless imports. esbuild resolves those with configured extensions.
- Focused tests **21/21 passed**; unconfirmed read-only DEV preflight **exit 1** as expected; mobile scoped `git diff --check` exit 0. No source modifications in this bundling pass.
- This local esbuild artifact is **NOT** a validated Supabase Edge Runtime package. Official Supabase CLI has no standalone `functions bundle` command; a local `functions serve` or equivalent sandboxed runtime execution would be needed to confirm compatibility, and may require Docker. No remote deploy was attempted.
- Redis provider live integration, complete runtime smoke and mandatory CLI deploy-wrapper enforcement remain pending. **NO-GO for DEV deployment approval** until verified.

## Isolated local Deno HTTP runtime smoke

- Docker executable not found; Supabase Edge Runtime container not available. Deno **2.9.7** and Supabase CLI **2.121.0** installed.
- Created a temporary, untracked test harness in `supabase/functions/public-record-relief-dev/local-smoke.tmp.ts`, using actual gateway `handlePublicDevEvaluation`, synthetic Ohio charge only, localhost `127.0.0.1:18765`, fake local-only integration secret, and a **simulated** in-memory allow callback that permits exactly two requests. Launched with Deno `--no-config --sloppy-imports --allow-net=127.0.0.1:18765`.
- Real local HTTP responses: authorized evaluation #1 **200**; authorized evaluation #2 **200**; third synthetic request **429**; incorrect secret **401**; wrong origin **403**; malformed JSON **400**. Engine response included API version, authority code `US-OH`, engine version and evaluation result. This verifies Deno execution of the handler and legal engine, not Supabase Edge Runtime deployment or Redis.
- Stopped local server PID 28268; verified port 18765 no longer listening; deleted temporary test harness. No persistent local server left running.
- Remaining: Supabase Edge Runtime/Docker packaging execution unverified; real DEV Redis REST `/eval` atomic increment, expiry, failure and concurrency unverified; real DEV URL not provisioned; server-side website connection intentionally disabled. Existing Deno experimental bundle issue persists, with local esbuild bundle success documented above.
- **NO-GO for DEV deployment** until runtime/provider gates are approved and completed. No pushes, deployments, SQL, migrations, remote secrets or production changes.

## DEV Redis and Edge Runtime verification preparation

- Inspected authorized Windows machine without system modifications: `docker` and `podman` not on PATH; `wsl.exe` exists but reports WSL is not installed. No Supabase Edge Runtime container available. Deno local HTTP handler test from previous pass remains valid but is not equivalent to Supabase Edge Runtime verification.
- Created `scripts/test-public-relief-dev-redis.mjs` as **opt-in**, fail-closed DEV-only live provider smoke test. Requires linked DEV project ref, `FAIRPATH_DEPLOY_TARGET_REF=znvhmuhojvwvjzmaqwff`, `FAIRPATH_DEV_DEPLOY_CONFIRMATION=CONFIRM_FAIRPATH_DEV_ONLY`, `FAIRPATH_REDIS_LIVE_TEST=I_APPROVE_DEV_REDIS_TEST`, `PUBLIC_RELIEF_DEV_REDIS_PROJECT_REF=znvhmuhojvwvjzmaqwff`, `PUBLIC_RELIEF_DEV_REDIS_URL`, and `PUBLIC_RELIEF_DEV_REDIS_TOKEN`. The last two are read from process environment only; never logged or persisted. A matching project-ref variable is an operator assertion, not independent proof of Redis tenancy. The provider must be separately confirmed DEV-only.
- Test creates one random key under `fairpath:record-relief-dev:integration-smoke:`, sends four concurrent `/eval` calls with atomic INCR/EXPIRE Lua, verifies counts 1-4, and calls `/ttl` to verify 1-90 seconds remaining. No DELETE or shared production key operations. Test key expires in 90 seconds. Running this test will write to the **approved DEV Redis provider**, so separate explicit approval is required before live execution.
- `node --check` exit 0; invocation without configuration correctly refused with exit 1 and no credential disclosure or network request. Existing focused tests **21/21 passed**, full repo `git diff --check` exit 0 (non-blocking CRLF warnings). No Docker/WSL install, service creation, remote secret changes, deployment, push, SQL, migration or production touch.
- **NO-GO** for DEV deployment: real Redis provider validation and Supabase Edge Runtime packaging remain unverified. Next single user action: choose/authorize an existing DEV-only Redis REST provider or approve creating a DEV-only free instance, with credentials entered directly into a secure local environment (never chat). This is preparation only, not approval to run the live test or deploy.

## Free DEV Redis provider setup authorization

- User approved a **free DEV-only Redis REST provider setup**, but expressly did not approve a live Redis test, paid service, remote secret configuration, deploy, push, SQL, migration, or production access.
- Inspected process variable **presence only** and names of Redis-related keys in the existing Mobile `.env.local` and public website `.env.development.local` files; none were found. No existing configured DEV Redis REST instance identified. Did not inspect other secret values.
- Recommended Upstash free-tier database, named `fairpath-record-relief-dev`, through the user's own Upstash Console at `https://console.upstash.com/`. Official Upstash docs confirm Redis REST URL and Standard token are shown after database creation; no token should be pasted into chat or committed. User must authenticate and select **Free** explicitly, declining paid upgrades.
- Upstash also offers an unclaimed 72-hour ephemeral Redis instance; intentionally did **not** create one because it is unsuitable as the lasting DEV dependency and returns live credentials to the caller.
- No account created, no provider provisioned yet. User action required: sign in at Upstash Console and create or confirm the free DEV-only database; then tell assistant `created` without sharing secrets. Secure configuration and live test require subsequent separate approval.
- Release remains **NO-GO** for deployment pending Redis live test and Supabase Edge Runtime verification.
