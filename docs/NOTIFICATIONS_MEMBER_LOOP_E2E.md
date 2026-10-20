# Notifications member loop (Tasks 114–118)

**Automated:** `npm run test:notifications`, `npm run test:notification-events`, `npm run test:sql:notifications`, delivery worker mocks.

## 114 — In-app inbox

1. `/notifications` (signed in) → `loadUserNotifications`.
2. Tap row → optional `route` navigation + `markNotificationRead`.
3. **Mark all read** when unread exist.

## 115 — Home badge

1. `/home` uses `loadUnreadNotificationCount` for unread strip/badge.

## 116 — Settings & push registration

1. `/notification-settings` toggles categories + **Push notifications**.
2. Enabling push → `syncPushRegistration` → `register_push_token` RPC (physical device + EAS `projectId` required).
3. Denied permission → honest message; push toggle reverts.

## 117 — Tap handling

1. `_layout.tsx` listens for notification response → opens `route` from payload.
2. App must not call FCM/APNs directly from client code (server worker only).

## 118 — Device proof (manual)

| Step | Expected |
| --- | --- |
| Dev build on phone, push enabled | Token registered in DEV `push_tokens` |
| Trigger server notification (QA harness / worker) | Push received |
| Tap push | Lands on correct in-app route |
| Sign out / switch user | No cross-account leakage |

Blocked until operator runs on hardware — see `P0-005` in `P0_P1_DEFECT_REGISTER.md`, `PHYSICAL_DEVICE_QA_PLAN.md`.
