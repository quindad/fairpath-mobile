# Auth authorization boundaries (Task 020)

**Automated:** `npm run test:auth-boundaries` (with `npm run test:auth` and `npm run test:security` for deeper SQL checks).

## Client routing

| Zone | Examples | Signed out |
| --- | --- | --- |
| Guest browse | `/find-jobs`, `/job/[id]`, `/find-housing`, `/resources` | Allowed |
| Auth entry | `/sign-in`, `/sign-up`, `/auth/callback`, `/check-email` | Allowed |
| Member workspace | `/home`, `/me`, `/onboarding`, `/accept-terms`, applications, credit, marketplace create | Redirect → `/sign-in?returnTo=…` |

Implementation: `src/core/auth/public-routes.ts` + guards in `src/app/_layout.tsx`.

## Identity

- New accounts are **`member`** only (`handle_new_user` + sign-up metadata).
- `profiles.account_type` is **locked** in Postgres (`protect_profile_account_type`); the mobile client never updates it.
- No employer/partner/landlord console routes ship in this app binary.

## DEV-only

- `/dev-integration-health` requires sign-in but renders content only when `__DEV__` is true.

## Related

- `docs/FAIRPATH_ROUTE_INVENTORY.md` — full route list  
- `docs/AUTH_E2E_BROWSER_CHECKLIST.md` — sign-out / returnTo smoke tests  
