# DEV Release Gate — Community Exchange + Member Referral

**Date:** 2026-10-23 (updated)  
**Verdict:** Community **APPLIED** on DEV (`20261021205913`); referral draft **READY FOR APPROVAL** (not applied). See §10.

---

## 1. Migration dependency order

| Order | File | Depends on |
|------:|------|------------|
| 1 | `20261021180000_community_help_exchange_DRAFT.sql` | **Applied on DEV as `20261021205913`** — do not re-apply |
| 2 | `20261021185000_member_resource_referral_DRAFT.sql` | `resources`, `resource_organizations`, `organization_capabilities`, `partner_is_org_manager` — **not** community tables |
| — | Profile / Justice drafts | **Do not apply** in this release |

Community and referral migrations are **independent**; referral may ship after community.

---

## 2. Read-only DEV schema compatibility evidence

**Project ref (from `.env.local`):** `znvhmuhojvwvjzmaqwff` (matches `DEV_PROJECT_REF` guard)

| Check | DEV result | Implication |
|-------|------------|-------------|
| `public.community_help_requests` | **Present post-apply** (2026-10-23) | Live on DEV |
| `public.community_help_offers` | **Present post-apply** | Live on DEV |
| `public.member_resource_referral_requests` | **404 PGRST205** | Safe greenfield apply |
| RPC `list_my_community_help_requests` | **Deployed** | Mobile `communityHelpBackendReady()` true on DEV |
| RPC `list_my_resource_referral_requests` | **404 PGRST202** | Not yet deployed |
| RPC `search_resources` | **200** | Resources engine live |
| RPC `marketplace_claim_quota` (anon) | **401** | Auth-gated as expected |
| `resources` table (anon select) | **401** | Closed to anon |
| `user_notifications` (anon) | **401** | Closed to anon |

**Local parity:** Full migration chain applied in PGlite (`local-sql-check`, community **6/6**, referral **8/8** after partner inbox/respond/complete tests).

**Caveat:** Live DEV was probed via PostgREST only (no direct `information_schema` SQL). Column-level drift is unlikely because objects are absent; re-run probe after apply.

---

## 3. Security & RLS test results

### Community (local SQL)

- Direct INSERT to `community_help_requests` → **denied**
- Cross-member offer SELECT → **0 rows** (RLS)
- Offer accept → **request owner only** (`member_respond_community_help_offer`)
- Rate limits: **TOO_MANY_OPEN**, **DUPLICATE_REQUEST**, **INVALID_CATEGORY**
- `touch_community_help_expiry` → **not granted to authenticated** (gate fix)

### Member referral (local SQL)

- Duplicate **DUPLICATE_REFERRAL**
- Non-participating resource → **RESOURCE_UNAVAILABLE**
- Member read own rows via RPC; no direct org read policy on table (partner uses RPC)

### Marketplace (unchanged, regression)

- Quota / declined / cancelled → `counts_toward_quota` tests still pass in `test-local-marketplace.mjs`

---

## 4. Community Exchange SQL review (summary)

| Area | Assessment |
|------|------------|
| Tables / FKs | New tables only; FK to `auth.users`, `marketplace_items` (optional offer link) |
| Writes | **RPC-only**; REVOKE ALL on tables; SELECT limited by RLS |
| SECURITY DEFINER | All RPCs `set search_path to public` |
| Notifications | Direct INSERT into `user_notifications` (same pattern as marketplace RPCs); categories `community` (text, no enum constraint on category) |
| Privacy | Board RPC omits member_id; `postal_code` hidden from non-owners in `member_get_community_help_request` |
| Marketplace | Offers validate seller owns `available` item; **no** quota impact from community offers alone |
| Expiry / cancel | `touch_community_help_expiry` on list/create/get; cancel expires pending offers |
| Gaps (accepted for V1) | No block/report RPC; matched request still visible on board until fulfilled/cancelled (status not open) — OK |
| Rollback | Documented DROP order in migration header |

**Gate fix applied:** `touch_community_help_expiry` execute **service_role only**; category validated in create RPC.

---

## 5. Member Referral SQL review (summary)

| Area | Assessment |
|------|------------|
| Community dependency | **None** |
| Eligibility | Published + verified + (`partner_submitted` **or** active `case_management` capability) — gate fix |
| Consent | `consent_at` default now(); mobile copy states limited sharing |
| Member visibility | RLS + `list_my_resource_referral_requests` |
| Org visibility | **`partner_list_resource_referral_inbox`**, **`partner_respond_resource_referral_request`** (gate addition) |
| CRM `referrals` | **Separate** — no auto-bridge to `participant_needs` (intentional) |
| Justice / profile | No columns reference justice or opportunity snapshot |
| Gaps | No org-wide push notification to all staff; Partner UI built locally (`/referrals/resource-requests`) — pending shared DEV apply + E2E |
| Partner complete RPC | `partner_complete_resource_referral_request` (gate addition after initial draft) |
| Rollback | Documented in file header |

---

## 6. Rollback & recovery

**Community rollback (DEV):** Run DROP block from `20261021180000_community_help_exchange_DRAFT.sql` header (functions first, then tables). Mobile gracefully degrades via `communityHelpBackendReady()`.

**Referral rollback:** DROP functions + `member_resource_referral_requests`. Mobile shows pending copy on resource detail.

**Recovery:** Re-apply draft SQL from repo; no data backfill required for other modules.

---

## 7. Test evidence

| Suite | Result |
|-------|--------|
| Mobile `npm run test:all` | **92/92** (2026-10-23) |
| Community local SQL | **6/6** (after gate fixes) |
| Member referral local SQL | **8/8** (member submit/list + partner inbox/respond/complete) |
| Partner | **20/20** (resource referral contract tests + prior baseline) |
| Admin | **Not re-run** (39/39 prior baseline) |

---

## 8. Post-apply smoke (DEV)

Run manually after approved apply (requires member JWT + optional Partner manager):

```text
# 1) Confirm objects exist (PostgREST)
#    RPC list_my_community_help_requests → 401/403 signed out, 200 [] when signed in

# 2) Member journey
#    member_create_community_help_request → open board → member_offer_community_help → member_respond accept

# 3) Help Now UI: post request, search resources + marketplace still load

# 4) Referral (if migration 2 applied)
#    member_submit_resource_referral_request on partner_submitted resource
#    partner_list_resource_referral_inbox(org_id) → partner_respond_resource_referral_request
```

Scripts: `scripts/qa-dev-community-exchange-post-apply.mjs` (fixed RPC args), `scripts/qa-dev-community-exchange-e2e.mjs` (two-member flow). Report: `docs/FAIRPATH_COMMUNITY_DEV_E2E_REPORT.md`. Fulfillment: `docs/COMMUNITY_EXCHANGE_FULFILLMENT.md`.

---

## 9. Known risks

- **Board description exposure** — open requests show full description to any signed-in member (by design; no street address).
- **No photo upload RPC** for community requests in V1 migration.
- **Referral ≠ CRM referral** — reporting/outcomes may double-count if both systems used later without reconciliation.
- **Partner UI** — member resource inbox at `/referrals/resource-requests` (separate from CRM `/referrals`); requires referral migration on DEV to function.
- **Notification categories** `community` / `referral` — not dedupe-keyed; duplicate notifications possible on retries.

---

## 10. Approval request & verdict

### APPLIED — Community Exchange (DEV)

**Migration version on DEV:** `20261021205913`  
**Do not re-apply** the draft file. Verified: two tables, nine RPCs, RLS on, reported smoke PASS (create/list/board/offer/authz/accept/fulfill).

**Follow-up:** Automated RPC E2E **14/14 PASS** (2026-10-23, member JWT auth). Manual mobile UI pass still recommended — see `docs/FAIRPATH_COMMUNITY_DEV_E2E_REPORT.md`.

### READY FOR APPROVAL (scoped, second migration)

**Apply to shared DEV (after explicit approval, separate from community):** `20261021185000_member_resource_referral_DRAFT.sql`  
**Evidence:** Partner inbox UI + local SQL **8/8** + Partner vitest **20/20**.  
**Still required after apply:** Shared DEV E2E (member submit → partner accept → partner complete → member My Path status).

**Do not apply** Profile or Justice migrations in this release.

---

## Partner integration handoff

**Repository:** `quindad-fairpath-partner` — `/referrals/resource-requests`, `resource-referral-actions.ts`.

**Existing:** CRM referrals workspace (`participant_needs` / `referrals` RPCs) — org-to-org case management.

**Required new work:**

1. Route: e.g. `/resource-referrals` under capability `case_management`
2. List: `partner_list_resource_referral_inbox(organization_id)`
3. Detail + accept/decline: `partner_respond_resource_referral_request`
4. Optional: mark `completed` RPC (future migration)
5. Member mobile: load `list_my_resource_referral_requests` on resource detail / My Path

**Partner tests:** Re-run `npm run test:all` in partner repo after UI land.
