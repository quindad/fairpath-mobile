# DEV test member accounts (fairpath-mobile-dev)

Use **only** the DEV project (`znvhmuhojvwvjzmaqwff`). Never create test users on production.

## Two personas

| Persona | Suggested email | Password (your vault) | Credits (after create) |
|--------|-----------------|-------------------------|-------------------------|
| Free member | `dev-free1@fairpath.test` | you choose | 10 |
| Plus-style tester | `dev-plus2@fairpath.test` | you choose | 50 |

Use real inboxes you control if you prefer (password reset). Do **not** commit passwords.

## A — Browser (you watch)

1. Sign in: [Supabase Auth users (DEV)](https://supabase.com/dashboard/project/znvhmuhojvwvjzmaqwff/auth/users)
2. **Add user** → email + password → **Auto confirm** ON (DEV only).
3. Repeat for the second persona.
4. Open [SQL Editor](https://supabase.com/dashboard/project/znvhmuhojvwvjzmaqwff/sql/new) and run:

```sql
-- Replace UUIDs from Authentication → Users → copy user id
-- Idempotent top-up (linked CLI): npx supabase db query --linked -f scripts/dev-grant-qa-ai-credits.sql
select public.grant_ai_credits(u.id, 10, 'admin_adjustment') from auth.users u where u.email = 'dev-free1@fairpath.test';
select public.grant_ai_credits(u.id, 50, 'admin_adjustment') from auth.users u where u.email = 'dev-plus2@fairpath.test';
```

5. In the app (Expo Go or web): sign in as each user and note Home / Signal balance.

## B — Secure session setup (recommended before QA harnesses)

In PowerShell (prompts for secrets; **does not write passwords to disk**):

```powershell
. .\scripts\Start-DevQaSession.ps1
node scripts/probe-dev-auth-personas.mjs
```

Probe is read-only: confirms whether `dev-free` / `dev-plus` exist in DEV Auth.

## C — CLI seed (mutating — owner approval)

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` **or** session env, plus `QA_DEV_*_PASSWORD` in session env:

```bash
node scripts/seed-dev-test-users.mjs
```

Creates both users if missing and grants credits. **Do not run** until probe shows missing users or owner approves reset.

## QA script (after accounts exist)

1. **dev-free** — Find Jobs → open a job → Ask Signal → Draft cover letter (expect credit spend or honest fallback if functions not deployed).
2. **dev-free** — Credit → Explain a letter (photo).
3. **dev-plus** — Same flows; confirm balance decrements in Assistant if wired.

Track PASS/FAIL in a sheet; we fix one failure per session.
