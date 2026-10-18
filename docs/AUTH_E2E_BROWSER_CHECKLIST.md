# Auth E2E — browser checklist (DEV)

Use `dev-free@fairpath.test` (password in your vault). Expo web: often `http://localhost:8082`.

## Sign in (returning)

1. `/sign-in` → valid credentials → lands on `/home`, `/onboarding`, or `/accept-terms` (never loops).
2. Invalid password → friendly error, stay on sign-in.
3. Sign out from `/me` → `/find-jobs` → `/sign-in?returnTo=…` when opening a private route.

## Sign up (new email)

1. `/sign-up` → terms checkbox required → check-email or instant session path.
2. If instant session (DEV): consent saved → onboarding or home via post-auth router (not stuck on callback).

## Accept terms

1. Both checkboxes → **Agree and continue** → onboarding or home; reload → does **not** return to welcome terms.
2. **Not now — sign out** → `/` guest welcome.

## Onboarding

1. Complete 5 steps → `/home`.
2. **Finish later** on step 1 → `/find-jobs` with partial profile saved (`onboarding_completed` still false).
3. Back on step 1 → `/find-jobs` (guest browse).

## Email verification

1. `/auth/callback` with tokens (web) → terms if needed → onboarding/home.

## Recovery

1. `/forgot-password` → success message without account enumeration.
2. `/reset-password` with recovery link → password update → sessions cleared.

## Automated gates

- `npm run test:auth` — screen inventory, email/password funnels, recovery invariants, public routes.
- `npm run test:auth-boundaries` — guest vs member routes, account_type lock, no partner/employer screens.
- `npm run test:auth-post-auth` — `returnTo` only applies after terms + onboarding (`applyPostAuthReturnTo`).
- `npm run test:sql:consent` — `record_document_consent` syncs profile pointers (Task 018).

Before cloud QA, apply DEV migrations in `docs/DEV_SUPABASE_MOBILE_V1_MIGRATIONS.md`.

## DEV accounts (password in vault)

| Account | Use |
|---------|-----|
| `dev-free@fairpath.test` | Returning member — login **012** |
| `dev-plus@fairpath.test` | Plus entitlements smoke after login |

New registration **011**: use `+alias` on a mailbox you control (e.g. `you+fp011@domain.com`) so you can complete verify-email without polluting DEV fixtures.
