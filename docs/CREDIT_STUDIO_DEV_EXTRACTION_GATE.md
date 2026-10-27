# Credit Studio — DEV extraction release gate (2026-10-26)

## Safety status
- DEV project only: `znvhmuhojvwvjzmaqwff`. Production is out of scope.
- `extract-credit-report` is deployed with JWT verification. Do not enable paid inference or process an actual member's report without separate explicit founder approval.
- Existing Experian PDF is sensitive member data: do not inspect, download, process, log, or share it during synthetic QA.
- No service role or model key belongs in the app, repo, commit, screenshots, or logs.

## Current code contract
- `supabase/functions/extract-credit-report/index.ts`: `CREDIT_EXTRACTION_ENABLED=true` AND `ANTHROPIC_API_KEY` are both required for provider calls. Leave the flag unset/false for now. Optional `CREDIT_EXTRACTION_MODEL` must be a confirmed supported provider model before activation.
- `handler.ts`: signed-in JWT, owned upload, exact per-request `consent: true`, file-size checks, strict extraction validator, count-only response.
- `ingest_credit_extraction` RPC writes candidate accounts for member review. Never automatically assert errors, accuracy, or credit scores.
- The current iPhone UI discloses external AI transfer before `readUploadedReport`. Cancel must not invoke the endpoint.

## Safe synthetic QA (no paid provider)
1. `npm run test:extraction` — exercises the handler with synthetic account payloads, mock engine/download/ingest, auth and consent denial, last-four-only normalization, errors and no-leak responses.
2. `npx tsc --noEmit` and `git diff --check`.
3. Check DEV function deployment/JWT and credit schema metadata without querying member data.
4. To test actual DEV database persistence later, create a dedicated disposable synthetic QA user and synthetic upload; use the existing ingestion RPC with synthetic structured data, verify owner-only RLS and candidate review states, then delete only the specifically created fixture. Do not call the paid extraction provider for this test. This step is NOT yet completed.
5. On the physical iPhone with Metro running, verify the saved report appears at top, consent prompt explains provider transfer, Cancel does not send, and disabled extraction produces an understandable error. Do not approve processing of the real report.

## Before enabling real extraction (separate approval)
- Confirm provider model supports PDF/image input and structured tool responses; verify cost ceilings, timeouts, document limits, and vendor privacy/data-retention terms.
- Provision provider secret only through DEV Edge Function secrets, never in client env; set explicit budget alerts.
- Test synthetic PDF end-to-end with provider only after approval for paid processing, then verify DB persistence, member confirmation, audit logs and error states.
- Only after another explicit authorization, test an actual user's report with informed consent.

## Known gaps
- Synthetic handler tests do not prove provider extraction accuracy, actual DEV persistence, or iPhone acceptance.
- The existing extractor accepts a maximum 10 MB payload, while the uploader accepts up to 15 MB; UI should communicate the extraction limit.
- User-reported Signal keyboard defects are tracked separately.
