# FairPath Notifications — DEV-only deployment gates

Status: BLOCKED. This is a deployment checklist, not authorization to deploy.

## Before any deployment
1. Reconcile DEV remote-only migration history with local migrations. Inspect `npx supabase migration list --linked` and `npx supabase db push --linked --dry-run`; do not use broad db push to apply unrelated migrations.
2. Verify sender and receipt worker integration, five-attempt behavior, concurrent claims, and mixed accepted/rejected Expo tickets. Accepted ticket receipts must not be re-sent after a retry; transient rejected tokens must receive a separately tracked retry. An HTTP timeout after Expo accepts a request is an ambiguous outcome; no exactly-once delivery guarantee exists without a durable provider idempotency mechanism.
3. Configure an authenticated scheduler for BOTH workers in DEV only. Scheduler calls must carry `Authorization: Bearer <NOTIFICATION_WORKER_SECRET>`; keep the secret in a secret store, never SQL migrations, source files, or logs. Do not use unauthenticated public cron URLs.
4. Verify worker endpoints reject requests without the correct secret. Use a distinct DEV-only secret.
5. Deploy ONLY notification migrations and functions after dry-run approval; record function versions and rollback commands.
6. Run Android and iOS physical-device tests, including sign-out, account switching, permission denial, and notification tap navigation.

## Current engineering mitigations
- Member sign-out calls `disablePushRegistration()` before signing out; it refuses to sign out when token cleanup fails. Audit other auth sign-out paths.
- Marketing categories (`marketing`, `promotion`, `promotional`) are gated by `marketing_enabled` in addition to `push_enabled`. Audit category taxonomy for any other promotional types.
- Worker claims at most 10 deliveries per run; lease increased to 15 minutes. This lowers, but does not eliminate, duplicate-send risk during network uncertainty or process failure.

## Rollback
Unschedule both workers first; remove or revert DEV functions, leave additive data intact, and preserve delivery records for diagnosis. Never apply destructive rollback SQL to production.
