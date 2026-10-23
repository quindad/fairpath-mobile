# DEV Edge Function deployment manifest

**Inventory command (read-only):** `node scripts/qa-dev-edge-inventory.mjs` → `qa-dev-edge-inventory-results.json`

**Deploy command (NOT authorized in this mission):** `supabase functions deploy <name> --project-ref znvhmuhojvwvjzmaqwff` (founder/backend only).

---

## Mobile-critical functions

| Function | Mobile usage | Auth | Secrets / config | Smoke test |
|----------|--------------|------|------------------|------------|
| `evaluate-record-relief` | `relief-service.evaluateSharedCaseServer` | Member JWT + anon key | Shared engine env in function | Save case → eval on DEV |
| `extract-record-relief-case` | Scan intake after upload | Member JWT | Storage + OCR provider (if enabled) | Scan flow DEV |
| `member-focus-guidance` | Signal Edge routing (`signal.ts`) | Member JWT | AI gateway policy (no spend in smoke) | `qa-dev-signal-smoke.mjs --confirm-dev` |
| `render-document` | Document generation | Member JWT | — | Local `test-render-handler.mjs` |
| `extract-credit-report` | Credit studio upload | Member JWT | — | Manual DEV upload |

---

## Payments / entitlements (often 404 on DEV until deployed)

| Function | Expected anon behavior | Secrets |
|----------|------------------------|---------|
| `create-fasttrack-payment` | 401 unauthenticated or **404 not deployed** | Stripe keys in function env |
| `stripe-webhook` | 400/501 invalid signature | `STRIPE_WEBHOOK_SECRET` |
| `store-subscription-webhook` | 501 or **404** until store verification | App Store shared secret (future) |
| `claim-correctional-transition` | 401 without integration secret or **404** | Integration HMAC / service secret |

**Anon probe note:** Five historical “failures” were triaged as: (1) RPC `SIGNED_OUT` **400** — correct for anon on member RPCs; (2) Edge **404** — function not deployed on DEV, not an app defect.

---

## Record Relief / ops (backend)

| Function | Purpose |
|----------|---------|
| `record-relief-retention` | Retention jobs |
| `record-relief-law-monitor` | Rule monitoring |
| `public-record-relief-dev` | Public dev endpoint (rate limited) |

---

## AI gateway family (paid — deploy only with billing approval)

`resume-bullet-draft`, `cover-letter-draft`, `dispute-letter-draft`, `job-fit-explanation`, `housing-fit-explanation`, `resource-guidance`, `academy-lesson-question`, etc.

**Mobile:** Routes write-tools to in-app workflows; does not auto-invoke paid drafts without member action + credits.

---

## Workers (service role)

`notification-delivery-worker`, `notification-receipt-worker`, `resource-scout-worker`, `program-scout-worker` — not invoked from mobile client.

---

## Post-deploy verification

1. `node scripts/qa-dev-edge-inventory.mjs` — critical names non-404.
2. Targeted smoke from `docs/DEV_E2E_EXECUTION_RUNBOOK.md`.
3. Re-run `node scripts/qa-dev-anon-probe.mjs` — expect 404 checks to become 401/501 when functions exist.
