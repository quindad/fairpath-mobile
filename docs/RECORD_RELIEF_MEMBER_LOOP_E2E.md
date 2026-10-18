# Record Relief member loop E2E

**Automated:** `npm run test:relief`, `npm run test:sql:relief`, `npm run test:relief-fixtures`, `npm run release:qa` (record relief gate when enabled).

**DEV account:** signed-in member; optional DEV relief seed (`npm run seed:dev:relief:dry` — apply only with `--confirm-dev`).

## 1. Hub

1. `/record-relief` → disclaimer visible; cases list with hedged outcome labels (`OUTCOME_INFO`).
2. Covered jurisdictions vs **TEST DATA** fixtures labeled honestly on case screens.

## 2. Add case (manual entry)

1. `/record-relief/add` → pick jurisdiction, enter charge facts (dates, disposition, counts).
2. Client `validateCase` blocks impossible dates and missing required fields before save.
3. Save → case detail; **CHECK NOW** runs `reevaluateCase` → shared `evaluate-record-relief` Edge function.

## 3. Case workspace

1. `/record-relief/case/{id}` → evaluations with citations, rule version, stale/changed notices.
2. No definitive “you are eligible” copy; federal cases use separate branch messaging.
3. Verified **official forms** badge only when `kind === 'official_form'`; worksheets are never official forms.
4. Export: case summary, filing checklist, worksheet, forms guide — highly sensitive, self audience only.
5. Checklist toggles persist; **RE-CHECK** after rule changes.

## 4. Scan / packet (optional path)

1. `/record-relief/scan-packet` → consent required before upload.
2. Packet merge + AI extract → member confirms before evaluation (no auto-file claims).

## 5. Supporting routes

- `/record-relief/coverage` — market coverage honesty  
- `/record-relief/court-finder` — external handoff, not legal advice  
- `/record-relief/my-statement` — member narrative tool (no outcome promises)

## Local SQL boundary (CI)

`npm run test:sql:relief` — RLS, evaluation persistence, guard rails without live Supabase.

## Manual / legal gate

Production legal review and jurisdiction inventory: `docs/RECORD_RELIEF_LEGAL_REVIEW_GATE.md`, `docs/RECORD_RELIEF_QA_RESULTS.md`. Do not mark PASS without live DEV proof.
