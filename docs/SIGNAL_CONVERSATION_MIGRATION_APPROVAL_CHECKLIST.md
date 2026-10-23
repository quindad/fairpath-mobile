# Signal conversation persistence — migration approval checklist

**Status:** DRAFT ONLY (`docs/proposed-migrations/20261023163000_signal_conversations_DRAFT.sql`)  
**Mobile v1 ships:** device-local threads via `src/core/signal/signal-conversation-store.ts` (AsyncStorage).

## Before apply (DEV)

- [ ] Legal/privacy review: message retention, truncation (4k), no document blobs in chat rows
- [ ] RLS verified: `user_id` on threads and messages; no cross-member reads
- [ ] RPC contracts reviewed: list / append / soft-delete; no service-role member reads without audit
- [ ] Provenance JSON schema aligned with `ai_interactions` (no duplicate sensitive fields)
- [ ] Backfill plan: none required (new feature)
- [ ] Rollback: drop policies + tables; mobile falls back to local-only store

## After apply (DEV)

- [ ] `scripts/test-local-ai-reminders.mjs` extended or new SQL harness for thread RPCs
- [ ] Mobile feature flag before syncing local → server
- [ ] Owner sign-off on production timing (out of scope for six-day sprint)
