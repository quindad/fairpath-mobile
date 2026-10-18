# DEV test member accounts (fairpath-mobile-dev)

Use **only** the DEV project (`znvhmuhojvwvjzmaqwff`). Never create test users on production.

## Two personas

| Persona | Suggested email | Password (your vault) | Credits (after create) |
|--------|-----------------|-------------------------|-------------------------|
| Free member | `dev-free@fairpath.test` | you choose | 10 |
| Plus-style tester | `dev-plus@fairpath.test` | you choose | 50 |

Use real inboxes you control if you prefer (password reset). Do **not** commit passwords.

## A — Browser (you watch)

1. Sign in: [Supabase Auth users (DEV)](https://supabase.com/dashboard/project/znvhmuhojvwvjzmaqwff/auth/users)
2. **Add user** → email + password → **Auto confirm** ON (DEV only).
3. Repeat for the second persona.
4. Open [SQL Editor](https://supabase.com/dashboard/project/znvhmuhojvwvjzmaqwff/sql/new) and run:

```sql
-- Replace UUIDs from Authentication → Users → copy user id
select public.grant_ai_credits(u.id, 10, 'admin_adjustment') from auth.users u where u.email = 'dev-free@fairpath.test';
select public.grant_ai_credits(u.id, 50, 'admin_adjustment') from auth.users u where u.email = 'dev-plus@fairpath.test';
```

5. In the app (Expo Go or web): sign in as each user and note Home / Signal balance.

## B — CLI script (optional, service role on your machine)

If `SUPABASE_SERVICE_ROLE_KEY` and `EXPO_PUBLIC_SUPABASE_URL` are in `.env.local`:

```bash
node scripts/seed-dev-test-users.mjs
```

(Script creates both users if missing and grants credits.)

## QA script (after accounts exist)

1. **dev-free** — Find Jobs → open a job → Ask Signal → Draft cover letter (expect credit spend or honest fallback if functions not deployed).
2. **dev-free** — Credit → Explain a letter (photo).
3. **dev-plus** — Same flows; confirm balance decrements in Assistant if wired.

Track PASS/FAIL in a sheet; we fix one failure per session.
