# New-user journey E2E (Task 030)

Automated: `npm run test:onboarding`, `npm run test:auth`, `npm run test:auth-post-auth`, `npm run test:sql:consent`.

## Onboarding steps (021–029)

| Step | Eyebrow | Captures |
| --- | --- | --- |
| 1 | START WITH YOU | Goals (work, housing, reentry, veteran, etc.) |
| 2 | YOUR LOCATION | `location_text` + optional `experience_summary` |
| 3 | YOUR TOOLS | Reentry / veteran tools → `justice_impacted` (private) |
| 4 | WORK & HOME | Work + housing preference chips |
| 5 | YOUR FOCUS | Opportunity + AI focus preferences |

Automated invariants: `npm run test:onboarding`.

## Happy path (email, DEV)

1. **Sign up** → check-email or instant session (`docs/AUTH_E2E_BROWSER_CHECKLIST.md`).
2. **Accept terms** (if prompted) → `/onboarding`.
3. **Five steps** → **Finish setup** → `/home` with `onboarding_completed` true.
4. **Home** shows personalized greeting and counts (applications/saved when data exists).

## Finish later (step 1)

1. On step 1, tap **Finish later — browse jobs and housing first**.
2. Lands on **`/find-jobs`** (guest browse while signed in); partial profile saved; `onboarding_completed` stays false.
3. Open **`/home`** or any private route → redirected back to **`/onboarding`** to resume.

## Resume after verify-email

1. Sign up with confirmation required → verify link → `/accept-terms` if needed → `/onboarding`.
2. Close app mid-step → reopen → private routes resume at `/onboarding`.

## Preconditions on DEV

Apply migrations in `docs/DEV_SUPABASE_MOBILE_V1_MIGRATIONS.md` before cloud QA.
