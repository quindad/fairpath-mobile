# Community Exchange — fulfillment vs. match

## Status model (draft migration `20261021180000_community_help_exchange_DRAFT.sql`)

| Transition | Meaning |
|------------|---------|
| `open` → offer accepted | Request moves to **`matched`** — a helper is connected, **not** fulfilled. |
| `matched` → `member_fulfill_community_help_request` | Owner confirms **actual assistance received** → **`fulfilled`**. |
| Marketplace claim | Separate flow with pickup/quota states; **not automatic** when a community offer is accepted. |

## Product rule

- **Do not** mark community assistance complete when an offer is accepted.
- **Do not** equate community requests with Marketplace claim completion.
- Reuse Marketplace pickup UX patterns in copy only where the same member action applies (e.g. listing a free item).

## Post-approval DEV smoke

After explicit migration approval and apply on shared DEV, run:

```bash
node scripts/qa-dev-community-exchange-post-apply.mjs
```

Requires member session env vars documented in `docs/DEV_TEST_ACCOUNTS.md`.
