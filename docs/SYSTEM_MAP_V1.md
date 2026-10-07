# FairPath Mobile — System Map (duplication audit)

Updated 2026-10-07, on `development/mobile-v1-completion`. Read this before creating a new subsystem. If a domain below
already has a canonical route or module, extend it — do not start a second one.

| Domain | Canonical module(s) | Canonical route(s) | Notes |
|---|---|---|---|
| Credit | `src/core/credit/*` (service, extraction, format, education) | `/credit`, `/credit/add`, `/credit/new-dispute`, `/credit/account/[id]`, `/credit/item/[id]`, `/credit/dispute/[id]`, `/credit/correct-identity` | **Full server-backed workspace: accounts, items, disputes, upload, extraction, export.** `src/core/credit-studio/*` (utilization calculator, analysis, dispute draft text) and `/credit-studio` are a **supplement**, linked from `/credit`, not a second credit product. This was corrected mid-session after initially building `/credit-studio` without first auditing `/credit`. |
| Resume | `src/core/resume/*` | `/resume-studio/*` | No overlap found. |
| Documents (FairPath-authored output) | `src/core/documents/document-service.ts`, `document-types.ts`, `generate.ts`, `render-pdf.ts`, `render-docx.ts`, `deliver.ts` | `/documents` (index/wallet), `/documents/create`, `/documents/create-credit` | Generates, stores and exports FairPath-built documents (letters, summaries). |
| Documents (member-uploaded, inbound) | `src/core/documents/extraction-contract.ts`, `upload-pipeline.ts`, `review-fixtures.ts` | `/documents/upload`, `/documents/review` | **New this session.** Handles the opposite direction from document-service: a member uploads an outside document (court record, etc.) for extraction and review. Linked from `/documents`. Distinct from credit's own `extraction_state`/`confirm_credit_account` flow, which is credit-specific and server-backed; this generic contract is for non-credit document types. Do not build a third review state machine — extend one of these two. |
| Record Relief | `src/core/record-relief/*` | `/record-relief`, `/record-relief/add`, `/record-relief/case/[id]`, `/record-relief/coverage` | **Authenticated by design**, not a bug. The public, no-account checker lives on the public website (fairpathfwd.com). Mobile's richer workspace (saved cases, documents, waiting-period tracking) reasonably requires sign-in. See the Wave-1 note added to `/sign-in` for the guest hand-off. |
| Academy | `src/core/academy/*` | `/academy`, `/academy/[id]` | New this session. No prior Academy existed. |
| Entrepreneurship | `src/core/entrepreneurship/*` | `/entrepreneurship` | New this session. Cross-pathway system, not a seventh pathway (confirmed against the pathway registry, which lists six only). |
| Resources | `src/core/resources/*` | `/resources`, `/resource/[id]` | Pre-existing, public. No overlap. |
| Marketplace | `src/core/marketplace/marketplace-service.ts` | `/marketplace`, `/marketplace-*` (list, claim, manage, report) | Pre-existing, server-backed. `src/core/food/inventory.ts` (new) is a **separate ledger** per the frozen rule that food reservations never consume Marketplace claims — not a duplicate, a deliberately distinct system. |
| Food Rescue | `src/core/food/inventory.ts` | none yet | New this session, logic only. Merchant management belongs in the web Partner Hub, not here. |
| Giving | `src/core/giving/{needs,donations,privacy-and-impact}.ts` | none yet | New this session, logic only. No payment processing. |
| Case plans / referrals | — | — | **Intentionally not in this repo.** Case plans live in `fairpath-mobile-case-plans` / `fairpath-partner-case-plans`, a separate workstream this repo must not touch. |
| Notifications | `src/core/notifications/*` | `/notifications` | Pre-existing. No overlap. |
| AI | `src/core/ai/{gateway,orchestrator,capabilities,intents}.ts` | `/fairpath-ai` | Pre-existing orchestrator and intents. `src/core/ai/usage-accounting.ts` (new) is a tier/credit gate that **wraps** a billable action; it is not yet wired into the orchestrator's existing calls — that wiring is still open work, not a duplicate system. |
| Veterans | `src/core/veterans/*` | `/veterans`, `/veterans/profile` | New this session. No prior Veterans experience existed. |
| Privacy | `src/core/privacy/privacy-center.ts` | none yet | New this session, logic only (disclosure log, revocation, deletion state). No prior Privacy Center existed. |

## What this means going forward

- Before adding a new `src/core/<domain>` directory, grep this table and the actual directory listing first.
- `/credit-studio` must never grow its own report upload. Report upload belongs to `/credit`.
- Any future "review extracted fields" UI for a new document type should extend `extraction-contract.ts`, not invent a third state machine.
- Entrepreneurship and Academy stay cross-pathway. They are never added to `src/core/pathways/pathway-registry.ts`.

## Staffing (added 2026-10-07)

| Domain | Canonical module(s) | Canonical route(s) | Notes |
|---|---|---|---|
| Staffing (FairPath Recruit vs. FairPath Staffing) | `src/core/staffing/{economics,member-view,workflow,listing-kind,foxhire-adapter,checkr-adapter,experian-adapter}.ts` | none yet | Flagship business line. Economics and provider state are logic + a draft migration only; no screens yet. **`economics.ts` must never be imported from a member-facing screen** — `member-view.ts`'s `toMemberView()` is the only allowed path from an internal assignment record to anything a member sees. Extends `jobs` and `job_placements` (see `docs/proposed-migrations/20261021100000_staffing_architecture_DRAFT.sql`); does not duplicate either. |
