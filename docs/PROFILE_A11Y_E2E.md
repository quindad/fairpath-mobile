# Profile & accessibility (Tasks 119–125)

**Automated:** `npm run test:profile`, `npm run test:member`, `npm run test:profile-a11y`, `npm run test:theme`, `npm run test:keyboard`.

## 119 — Member hub (`/me`)

Server-driven counts via `get_member_home_summary`; links to Opportunity Profile, Privacy, Appearance, notifications, Resume Studio (when built).

## 120 — Opportunity Profile

Sections under `/opportunity-profile/*`; validation in `opportunity-forms.ts`; no justice-history fields; feeds Easy Apply autofill (`test:jobs`).

## 121 — Location & search radius

`/location-setup` persists ZIP/radius used by jobs/housing find screens.

## 122 — Privacy & deletion

`/privacy` — honest copy; `request_account_deletion` / cancel; never claims account already deleted.

## 123 — Appearance

`/appearance` — dark / light / system; partial light rollout disclosed.

## 124 — Keyboard & forms

All input screens use `FormScrollView` / `KEYBOARD_LIST_PROPS` (`test:keyboard`).

## 125 — Theme contrast

Semantic tokens + WCAG AA pairs in dark and light (`test:theme`).

## Manual (device)

Large text / Reduce Motion / VoiceOver spot-check on sign-in, onboarding, Easy Apply — `PHYSICAL_DEVICE_QA_PLAN.md` keyboard rows.
