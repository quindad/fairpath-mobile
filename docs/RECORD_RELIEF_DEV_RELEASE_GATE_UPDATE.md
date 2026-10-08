# Record Relief — live DEV release-gate update (2026-10-07)

Environment: DEV project znvhmuhojvwvjzmaqwff only. Production unchanged.

1. **DEPLOYED:** `extract-record-relief-case` v3, JWT verification enabled. Deployed complete source bundle including shared dependencies and stored-consent guard.
2. **BLOCKED (live end to end):** No authenticated synthetic DEV account was available to complete document upload, recorded consent, AI extraction, review and eligibility UI. Do not interpret code tests as live proof.
3. **PARTIAL PASS:** A real DEV SQL transaction inserted two temporary synthetic auth.users rows and upload rows, set the `authenticated` role and Member A JWT subject, and observed 1 own upload, 0 cross-member uploads. Transaction rolled back. This is DB RLS proof for upload SELECT only, not an app-level two-account proof for all tables.
4. **DEPLOYED BUT LIVE TEST PENDING:** `record-relief-retention` v2, 10 offline deletion-order tests reported passing by Juice. No real synthetic Storage object was created/deleted in this pass; physical deletion remains unverified.
5. **PARTIAL PASS:** Juice's browser QA report confirms signed-out routing at desktop and 375px viewport, but authenticated interior screens were not browser-tested.
6. **NOT APPROVED:** `docs/RECORD_RELIEF_LEGAL_REVIEW_GATE.md` tracks all 57 registered jurisdictions as requiring independent legal sign-off. DEV has verified rule records for 3 distinct jurisdictions, not nationwide production-grade legal approval.

Additional DEV fix: minimum authenticated table grants restored for upload, packet and verified reference-data reads. Migration `20261009010000_record_relief_authenticated_minimum_grants.sql` applied to DEV, and `has_table_privilege` confirmed upload and packet grants.

**Release recommendation: NOT READY for nationwide public launch.** Remaining blockers: authenticated E2E, actual Storage deletion, broader two-user isolation, full browser walkthrough, 57-jurisdiction independent legal review.


## DEV technical release-gate refresh — 2026-10-08

- **PASS, live authenticated:** Member A upload, persisted consent, Anthropic extraction, human review, Ohio evaluation and persistence. Member B could not read Member A upload via authenticated PostgREST (RLS); authenticated responsive routes tested. Evidence: QA Pass 6 commit `e7b56c0`.
- **PASS, DEV fixes:** Extraction feature enabled; service_role SELECT/UPDATE on upload restored (`c204e1f`); evaluation missing_inputs JSON-to-text[] conversion fixed (`47468ea`). Member UPDATE on uploads remains denied.
- **PASS, retention invocation only:** `public.invoke_record_relief_retention()` issued HTTP request 173; `net._http_response` returned HTTP 200, `{"deleted":0,"failed":0}`. The scheduled `record-relief-retention-daily` job is active at `45 4 * * *`. This does NOT prove physical deletion.
- **BLOCKED, physical Storage deletion:** No new disposable Storage object was uploaded and physically removed during this pass. The three existing Member A synthetic uploads are not expired and were deliberately preserved. An authorized service-role or authenticated fixture-upload execution path is still required for a live end-to-end deletion proof. Do not count an SQL-only `storage.objects` row as a real object.
- **BLOCKED, local SQL fixture suite:** `npm run test:relief-fixtures` reports unavailable local `pg_net` / `cron.job` and an unrelated strict change-event verification failure. `npm run test:relief` passed.
- **NOT APPROVED, legal:** All 57 jurisdictions require independent qualified reviewer sign-off; `docs/RECORD_RELIEF_LEGAL_REVIEW_GATE.md` is the review queue. Registry coverage is not legal approval.

Release decision remains **NOT READY for nationwide public release**. Do not conflate verified Ohio synthetic behavior with nationwide legal correctness.
