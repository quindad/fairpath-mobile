# FairPath Mobile — member journey plan (piece by piece)

Ship order for **sign-up → daily use → trust**. Each phase has a PASS gate before the next phase owns engineering focus.

## Phase 0 — START (today)

- DEV project wired; `test:all` **52/55** (marketplace audit, keyboard, SQL RLS warning).
- Test accounts: `dev-free@fairpath.test`, `dev-plus@fairpath.test` (passwords in your vault).
- Signal code pushed; Edge Functions + secrets still required for live model replies.

## Phase 1 — Account front door (NOW)

| Step | Screen | PASS gate |
|------|--------|-----------|
| 1.1 | Browse guest (`/`, find-jobs, find-housing) | No auth wall on public routes |
| 1.2 | Sign up | Account created → consent → onboarding or callback navigates (no dead-end) |
| 1.3 | Sign in | Terms → onboarding → home; `returnTo` works when setup complete |
| 1.4 | Onboarding | Progress saves each step; “Finish later” exits cleanly; finish writes profile |
| 1.5 | Accept terms | Social + email paths land here when needed |

**Shipped in repo (Phase 1 code):** post-auth routing, callback auto-navigate, **5-step** onboarding with per-step save + “Finish later”, sign-in/sign-up error copy, check-email back links.

## Phase 2 — First value (week 1)

- Home reflects onboarding goals (jobs/housing/resources tiles). **Shipped:** personalized quick links + focus line on `/home`.
- Opportunity profile minimum (location + one-line experience for Signal). **Shipped:** onboarding optional line + Contact editor `experience_summary` + DB column migration.
- Signal on DEV deployed; one full path: job → Ask Signal → cover letter.
- Credit + letter explainer smoke test.
- **Consent loop fix:** ledger backfill + `record_document_consent` syncs profiles.

## Phase 3 — Core loops (week 2–3)

- Jobs: save, apply, applications list.
- Housing: search, apply (single path; FastTrack hidden from members).
- Resources + Early Access honest empty states.
- Credit studio upload → review → dispute draft.

## Phase 4 — Trust & money (week 4+)

- Google/Apple sign-in on device.
- FairPath+ / credits via billing webhook.
- Physical device QA (share, print, maps).
- Store listing + accessibility pass.

## Phase 5 — FINISH (v1 launch bar)

- `test:all` green or waived with sign-off.
- Exit criteria in `docs/MOBILE_BUILD_EXIT_CRITERIA.md` PASS for auth, jobs apply, housing apply, credit, AI (browser + Expo Go proof).
- Real inventory strategy documented (DEV seed vs production data).

---

**Rule:** one phase, one screen family at a time. You watch in browser/Expo; we don’t start the next phase until you sign off the current PASS gate.
