# Professional Network + Opportunity Profile — deliverable (V1)

**Scope:** Employment credibility inside existing Opportunity Profile — not a social network. **No shared DEV migrations applied** (justice or professional headline drafts remain proposed).

## 1. What already existed

- **Opportunity Profile** (`member_*` tables, 8-section completion, owner-only RLS, server-built application snapshots).
- **Easy Apply** autofill from `member_*` with legacy `profile_answers` fallback.
- **Resume Studio** one-time import from Opportunity Profile.
- **Job search**, applications, notifications, Partner ATS (applications + status).
- **Job justice compatibility panel** (interim JSONB policy + TS engine; canonical RPC **not** live on DEV).
- **FairPath Readiness** (`profile_answers`) — separate from Opportunity Profile.
- **Veterans service profile** — device-local only.

## 2. What was missing

- Member **professional preview** (LinkedIn-style card, private-first).
- Explicit **professional headline** field (distinct from Signal background).
- **My Path** entry points for profile, applications, and job search.
- **Deterministic profile–job fit hints** (non-AI, explainable) alongside Signal.
- Documented **headline snapshot** path for employers (draft SQL only).

## 3. What we reused

- All `member_*` data, `get_opportunity_completion`, `submit_job_application` / `build_opportunity_snapshot`.
- Existing job application tracking, Explore/Jobs routes, Partner application views.
- Justice separation rules and `JobJusticeCompatibilityPanel` (unchanged contract).

## 4. What we implemented (Mobile)

| Change | Path |
|--------|------|
| Professional preview model + privacy guard | `src/core/profile/professional-profile-model.ts` |
| Preview UI + route | `src/app/opportunity-profile/preview.tsx`, `src/components/opportunity/ProfessionalProfileCard.tsx` |
| Hub + My Path links | `src/app/opportunity-profile/index.tsx`, `src/app/my-path.tsx` |
| Professional headline in Contact editor | `src/components/opportunity/editors.tsx` |
| Graceful headline column fallback | `src/core/profile/opportunity-service.ts` |
| Job fit hints panel | `src/core/jobs/job-profile-fit.ts`, `src/components/jobs/JobProfileFitPanel.tsx`, `src/app/job/[id].tsx` |
| Tests | `tests/professional-profile-model.test.ts`, `tests/job-profile-fit.test.ts` |

## 5. Partner & Admin

- **No code changes required for V1** — employers already see application snapshots and ATS status.
- Optional follow-up: surface `summary` section in Partner application UI after headline migration is approved.

## 6. Proposed migration (not applied)

- `docs/proposed-migrations/20261021190000_profiles_professional_network_DRAFT.sql` — `profiles.professional_headline`, optional snapshot section `summary`.

## 7. Test results

Run: `npm run test:all` (includes new unit tests). Partner/Admin suites unchanged.

## 8. Blockers

| Blocker | Notes |
|---------|--------|
| `professional_headline` on shared DEV | Column absent until proposed migration approved; app degrades gracefully |
| Canonical justice RPC on DEV | Fit/justice copy must not claim DB RPC is live |
| Veteran profile on server | Still device-local; not in employer snapshot |
| Skill-based job ranking RPC | Still filter/search only; fit hints are client-side |

## 9. V1 integration finish (this pass)

- Readiness ↔ Opportunity audit: [`PROFILE_READINESS_OPPORTUNITY_AUDIT.md`](PROFILE_READINESS_OPPORTUNITY_AUDIT.md)
- Easy Apply: `summary` + `preferences` share toggles + **ApplicationSharePreviewPanel**
- Partner job detail: **OpportunitySnapshotSummary** under each candidate with authorized snapshot
- Local SQL: draft migration test for `summary` in snapshot (end of `test-local-profile.mjs`)
- Layout: static contract tests in `professional-profile-layout.test.ts` (not a substitute for physical iPhone QA)

## 10. Next DEV approval step

1. **Approve and apply** `docs/proposed-migrations/20261021190000_profiles_professional_network_DRAFT.sql` to shared DEV only (copy to `supabase/migrations/20261021190000_profiles_professional_network.sql`).
2. Deploy **Mobile + Partner** app builds that include this pass (no Admin change required).
3. Smoke: member applies with HEADLINE + preview → partner job page shows professional summary block.
4. Canonical justice migration remains a **separate** approval gate — do not batch.
