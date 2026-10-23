# Startup Academy — V1 implementation backlog
**Branch:** `development/mobile-v1-completion` | **Checklist:** START-101–106 | **Agent F ownership**
**Baseline (START-001):** `src/app/entrepreneurship.tsx` — 15 AsyncStorage checklist steps, Signal idea feedback, static program cards. No cloud progress, lessons, or durable work products.

## Current assets (reuse, do not duplicate)
| Area | Path | Notes |
|------|------|--------|
| Step catalog | `src/core/entrepreneurship/tracks.ts` | 15 steps; expand into lesson modules, not one-tap complete |
| Local progress | `src/core/entrepreneurship/progress-store.ts` | Device-only; migrate or supersede with profile-backed store |
| Plan/budget model | `src/core/entrepreneurship/business-plan.ts` | Blank sections + budget math; wire to UI |
| Screen shell | `src/app/entrepreneurship.tsx` | Replace checklist UX with academy home + deep links |
| Explore readiness | `src/core/explore/explore-readiness.ts` | Keep `in_development` until START-104 satisfied |
| Pathway route | `src/core/opportunity/v1-pathways.ts` | PATH-102 must land on academy work product, not generic resources |

## START-101 — Catalog and onboarding
- [ ] **START-101a** Add `src/core/academy/catalog.ts`: stages (`exploring`, `validating`, `launching`, `operating`), recommended module order, honest “no funding promise” copy.
- [ ] **START-101b** Academy onboarding sheet: pick stage + primary goal (side income, replace job, family business); persist to AsyncStorage first, then profile JSON when migration approved.
- [ ] **START-101c** Route map: `/entrepreneurship` (home), `/entrepreneurship/lesson/[stepId]`, `/entrepreneurship/plan`, `/entrepreneurship/budget`.
- **Acceptance:** Member sees tailored “start here” module; Explore badge stays non-live until START-102+104 partial pass.

## START-102 — Lessons and exercises
- [ ] **START-102a** `src/core/academy/lessons.ts`: per-step content blocks (read, reflect prompt, exercise checklist); minimum viable copy for all 15 steps (no lorem).
- [ ] **START-102b** Lesson screen: mark exercise items complete individually; cannot mark whole lesson done until required exercises checked.
- [ ] **START-102c** Export lesson completion evidence in dev QA script (counts per step).
- **Acceptance:** `tests/academy-lesson-progress.test.ts` — cannot skip exercises; progress percent reflects exercises not single button.

## START-103 — Work products
- [ ] **START-103a** Business plan editor using `blankBusinessPlan()` + section autosave (AsyncStorage key `academy.business_plan.v1`).
- [ ] **START-103b** Startup budget worksheet using `StartupBudget` + `summarizeBudget()` with member-entered lines only.
- [ ] **START-103c** First-customer checklist (5–7 items) linked from `acquire_customers` step.
- [ ] **START-103d** Share/export: copy-to-clipboard text bundle (no PDF dependency for V1).
- **Acceptance:** Plan and budget survive app restart; disclaimer visible on every export.

## START-104 — Persistence strategy
- [ ] **START-104a** Document choice: Phase 1 local-only with explicit banner; Phase 2 `profile_answers` or dedicated table (DRAFT migration only).
- [ ] **START-104b** Migration path: import AsyncStorage progress on first signed-in load (idempotent).
- **Acceptance:** Signed-in member on second device sees “sync coming soon” OR cloud data if backend ready — never silent data loss messaging.

## START-105 — Signal coaching
- [ ] **START-105a** Worksheet-scoped prompts (plan section id or budget line) via existing Signal gateway; no auto-write.
- [ ] **START-105b** Confirm-to-save flow: member approves before merging Signal output into plan section.
- **Acceptance:** `tests/academy-signal-consent.test.ts` — write requires explicit confirm flag.

## START-106 — Resources honesty
- [ ] **START-106a** Program cards pull from `PROGRAM_REFERENCES` with `officialPartnership: false` default; external links only when verified.
- [ ] **START-106b** Remove any copy implying guaranteed grants, SBA approval, or FairPath funding.
- **Acceptance:** Static audit script greps entrepreneurship screens for forbidden phrases.

## Engineering tasks (ordered)
1. **F-1** Scaffold routes + academy home (no backend) — **unblocks PATH-102**
2. **F-2** Lesson + exercise progress model + tests
3. **F-3** Plan + budget screens wired to `business-plan.ts`
4. **F-4** Signal worksheet integration with consent
5. **F-5** DEV QA: `scripts/qa-dev-academy-local-progress.mjs`
6. **F-6** DRAFT SQL (optional): `docs/proposed-migrations/*_academy_progress_DRAFT.sql`

## File ownership (no overlap with other agents)
- `src/app/entrepreneurship/**` (new nested routes)
- `src/core/academy/**` (new)
- `src/core/entrepreneurship/**` (extend only)
- `tests/academy-*.test.ts`
- Do **not** edit: `record-relief/**`, `community/can-help.tsx`, `food-rescue/**`, `member-capabilities*`, `v1-pathways.ts` (coordinate with Agent D for PATH-102 route constant only)

## Dependencies / blockers
- **Backend:** None required for F-1–F-3 (local-first).
- **Signal:** Uses existing `getBusinessIdeaFeedback` pattern; extend for section-scoped prompts (SIG gateway must stay DEV).
- **Explore:** Update readiness when START-102 + START-103 reach “beta” on DEV checklist only.

## Evidence required before checklist [x]
- Commit SHA(s) scoped to academy files
- `node --test tests/academy-*.test.ts` green
- `npx tsc --noEmit` green on integration branch (excluding unrelated WIP files)
- iPhone: lesson scroll, keyboard on plan inputs — mark NOT TESTED until device run
