# FairPath backend integration and launch blockers

**Scope:** local, DEV-safe review on October 9, 2026. No database was written, no migration was applied, no function was deployed, and no payment was made.

## Verified locally

- Employer and organization application access is protected by ownership and active-membership checks.
- A new regression found an authorized manager could rewrite an application's applicant or submitted answers while changing status. `20261009053401_job_application_update_integrity.sql` blocks that update. Local organization ownership now passes 7/7; jobs end-to-end passes 5/5.
- Notification delivery evaluates preferences, claims work safely, records per-token attempts, handles Expo receipts, disables invalid tokens, and unregisters on sign-out. The receipt worker now processes pending receipts oldest first, preventing sustained new traffic from starving old receipts.
- Housing FastTrack pricing and entitlement evaluation are server-side. The signed Stripe webhook does not mark an application approved from a failed payment attempt.
- Password recovery validates redirect and reset state, invalidates existing sessions after reset, and does not disclose whether an account exists.
- The original `partner_record_placement` function accepted `jobs.employer_id` before checking organization membership. On an organization-owned job, that meant the job creator could record placement evidence without being an active organization manager. Proposed draft `20261009095000_partner_record_placement_hardening_DRAFT.sql` removes that shortcut for organization jobs while preserving legacy individual-employer behavior. Local coverage proves denial for a non-member creator, editor, removed manager, other-organization manager, revoked employment capability, and suspended organization; it also proves hired-state, duplicate, and immutable-evidence behavior.
- Notification local coverage additionally proves that queued push remains blocked after a member opts out, queued marketing remains blocked until marketing opt-in, and a token can move to a new account without two active token records.

## Migration evidence

The repository contains the migration history and newer notification, payment, and application-integrity migrations. The PGlite tests apply the inventory in filename order. That does **not** establish the state of DEV.

`supabase migration list --local` could not inspect a persistent local ledger because the local Supabase database at `127.0.0.1:54322` is not running. No verified linked-DEV migration ledger was available in this pass. DEV applied-versus-pending status is therefore **unverified**.

This pass did not apply these files:

- `supabase/migrations/20261009053401_job_application_update_integrity.sql`
- Uncommitted notification, payment, and retry migrations already in the shared tree
- `docs/proposed-migrations/20261009090000_member_document_uploads_DRAFT.sql` (explicit draft; do not apply)
- `docs/proposed-migrations/20261009093000_partner_job_application_status_RPC_DRAFT.sql` and `20261009094000_partner_org_context_RPC_DRAFT.sql` (Mardo-owned Partner drafts)
- `docs/proposed-migrations/20261009095000_partner_record_placement_hardening_DRAFT.sql` (placement-evidence hardening draft)

The release owner needs a linked migration list and reviewed linked dry-run in the approved DEV environment, followed by the normal reviewed release process and post-deploy RLS smoke tests.

## Read-only DEV ledger review — October 9

Read-only `supabase migration list --linked` succeeded against DEV. This is now an evidence-based **NO-GO** for any Partner deployment until history is reconciled.

Detailed version-by-version evidence and the local-only disposition matrix are in `DEV_MIGRATION_RECONCILIATION_2026-10-09.md`. Raw SQL was recovered for 1 of 41 DEV-only entries; the remaining 40 have ledger-name evidence only and must not be reconstructed from names.

| Ledger result | Finding |
| --- | --- |
| Matching versions | Canonical history matches DEV through `20261008220000`; later matching versions include `20261008230000` through `20261008450000` where present locally. |
| Local only: 19 versions | `20261008222300`, `20261008222400`; `20261008520000`–`20261008590000`; `20261009010000`–`20261009050000`; `20261009053401`; `20261009060000`–`20261009080000`. None are recorded as applied in DEV. |
| Remote only: 41 versions | `20261007233711`, `20261007233719`, `20261007233732`, `20261007233744`, `20261007234149`, `20261007234156`, `20261007234207`, `20261007234223`, `20261007234241`, `20261007234247`; `20261008000024`, `20261008000033`, `20261008000044`, `20261008000053`, `20261008000916`, `20261008002322`, `20261008002334`, `20261008003911`, `20261008003916`, `20261008003948`, `20261008003957`, `20261008004003`, `20261008004014`, `20261008004024`, `20261008004033`, `20261008004455`, `20261008004503`, `20261008004558`, `20261008004658`, `20261008025335`, `20261008031954`, `20261008035711`, `20261008041437`, `20261008175923`, `20261008192257`, `20261008460000`–`20261008510000`. Their SQL is absent from this checkout. |
| Ordering | The shared entries are ordered. The divergence is historical: DEV contains unknown remote-only migrations, while this checkout contains missing notification, record-relief, application-integrity, payment, and retry migrations. Do not repair ledger rows or force a push. |

### Three-draft Partner review and safe order

1. Reconcile the historic DEV/local ledger first. Capture and review the SQL for all 41 remote-only versions; decide which local-only versions are canonical and how their history will be represented. This is an approval gate, not a CLI repair.
2. Deploy canonical `20261009053401_job_application_update_integrity.sql` only after that reconciliation. The status RPC assumes its immutable-field trigger exists.
3. Promote the three drafts into new, canonical migration files with fresh versions that preserve the intended rollout order: context first, status second, placement third. The draft names (`090930` status before `090940` context) are review artifacts, not safe production ledger versions. Do not copy draft filenames into DEV after the existing local history.
4. Deploy `partner_org_context()` after its existing organization, membership, and capability tables are proven present. It is additive and has no dependency on the status RPC.
5. Deploy the employer-status RPC only after Freebuff has a feature gate and uses the RPC. It revokes authenticated table `UPDATE` on `job_applications` and removes the legacy update policies. Member withdrawal remains safe because the mobile client uses the separate `withdraw_job_application` security-definer RPC.
6. Deploy placement hardening after the same organization/capability proof. It should be released in the same reviewed window because it closes the organization-job creator shortcut.
6. After each approved migration, run isolated authenticated Org A/Org B checks, status/withdrawal checks, hired-to-placement checks, then a scoped DEV smoke test. Do not enable the Partner UI until those pass.

### Permission, RLS, and API findings

- Today `authenticated` has direct `UPDATE` on `job_applications` from `20261007120000`. The proposed status migration intentionally revokes it, so any undiscovered direct client update will fail after rollout. Repository member withdrawal uses its RPC; Freebuff must use the proposed status RPC.
- `partner_org_context()` is `SECURITY DEFINER` and safely derives organization context from `auth.uid()`. It must retain `search_path = public`, revoked `anon`/`public` execution, and its current active-membership and active-organization filters.
- `partner_record_placement()` is `SECURITY DEFINER`; its proposed version correctly limits organization writes to active owners/managers with active employment capability. Direct authenticated `job_placements` mutation remains unavailable.
- Existing placement and application **read** policies allow any active organization member to read organization-owned records without checking organization status or employment capability. The Partner write RPCs are stricter. Product/security must decide whether suspended organizations and non-employment members should retain read access before launch.
- The ledger cannot prove hosted Data API exposure, PostgREST grants, or schema-cache state. Verify API exposure and authenticated RPC discovery in DEV after migration approval; do not infer them from local SQL.

### Isolated dry-run and rollback plan

Use a disposable PostgreSQL/PGlite database loaded from the reconciled canonical migration set, then apply the four reviewed changes in the order above (integrity trigger plus three Partner drafts). Record function definitions, grants, policies, and API-visible schemas before and after. Run the combined Partner suite and the placement security suite against that database.

Mardo's isolated combined Partner suite has passed 5/5, and the separate Partner, placement, organization ownership, Jobs, and security regressions have passed. This is local integration evidence only; it does not resolve the DEV ledger divergence or prove hosted Data API/RLS behavior.

For approved DEV rollout, take a read-only schema/ledger snapshot first and run a linked dry-run only after the history review. Keep the Partner UI feature-gated. If the status RPC causes an unexpected consumer failure, disable that UI gate and restore the previous direct-update grants/policies from the reviewed rollback SQL; do not edit Supabase migration history. Placement and context additions are replaceable functions/triggers, but rollback must restore the prior function definition only after the security owner accepts the authorization risk.

## Prioritized launch blockers

| Priority | Blocker | Owner | Evidence needed |
| --- | --- | --- | --- |
| P0 | DEV migration ledger and RLS schema are not remotely reconciled or proven | Mardo / release owner | Linked migration list, reviewed dry-run, approved DEV deployment, post-deploy RLS smoke tests |
| P0 | No physical-device proof of push registration, delivery, receipts, tap navigation, sign-out, and account switching | Mardo / device tester | Sanitized iOS and Android device records |
| P0 | Stripe sandbox configuration and webhook behavior are unverified | Mardo / billing owner | Test-mode confirmation, sandbox failure/cancel/replay proof, no-live-charge evidence |
| P0 | Password-recovery email and native deep-link return are not proven against DEV mail and devices | Mardo / device tester | Sanitized DEV email receipt and iOS/Android reset evidence |
| P1 | Employer/partner UI is not implemented against the ATS contract | Freebuff | Job publishing, applicant review, status transition, and cross-organization denial QA |
| P1 | Employer verification rule is undefined for direct individual job creation | Product / operations | Approved eligibility/review policy and any required implementation |
| P1 | Placement hardening and Partner status/context RPCs are local drafts, not DEV behavior | Mardo / release owner | Security review, migration ordering review, approved DEV deployment, and post-deploy Partner RLS smoke tests |
| P1 | Supabase Data API exposure and grants need a DEV check before scheduled platform enforcement | Mardo / release owner | DEV API settings and table grants verified |
| P2 | External ATS import/webhook, interview scheduling, and partner messaging are undesigned | Product / Freebuff | Product decision and scoped work if included in launch |
| P2 | Independent legal review of record-relief content remains open | Legal reviewer | Written jurisdiction-by-jurisdiction review |

## Provider delivery limitation

Expo receipts can record ticket and receipt outcomes. They cannot prove exactly-once visible delivery if a provider accepts a notification and the worker fails before recording that response. FairPath avoids duplicate work through durable claims and attempts, but release materials must not promise exactly-once visible delivery.

## Ownership

- **Juice:** member-facing UI and member UX evidence.
- **Freebuff:** employer UI using `EMPLOYER_ATS_BACKEND_CONTRACT_2026-10-09.md` after its proposed status-update RPC has been approved and deployed.
- **Mardo/release owner:** schema reconciliation, backend rollout, provider configuration, device evidence, and final release gate.
