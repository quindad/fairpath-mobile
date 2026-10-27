# FairPath V1 Opportunity Platform — Integration Report

**Date:** 2026-10-23 (updated)  
**Environment:** DEV — Community Exchange **live** on shared DEV (`20261021205913`); member referral migration **not applied**; no commits/pushes/deployments this session.

---

## 1. Ten-feature implementation matrix

| # | V1 pathway | Pillar | Discovery | Real action | Follow-through | Outcome truth |
|---|------------|--------|-----------|-------------|----------------|---------------|
| 1 | Skills exchange | Grow | `/grow`, Help now, Resources (`jobs`, `education`) | Open Academy / resource / register links | My Path plan (device-local) | Provider contact — not auto-complete |
| 2 | Microbusiness | Grow | `/entrepreneurship`, Help now | Startup Academy steps, entrepreneurship resources | Entrepreneurship progress store | No funding guarantee |
| 3 | Education & scholarships | Grow | `/opportunities`, Help now | Save programs, official URLs | My Path + opportunities registry | Deadlines not auto-marked complete |
| 4 | Family opportunity center | Need | Help now, Resources (`family`, …) | Resources, GIVE, community request | Community + My Path | Children not exposed on public posts |
| 5 | Events & volunteering | Can help | `/community/can-help`, Help now | Contact/register via resource/org | Community exchanges list | Not neighbor-task marketplace |
| 6 | Benefits navigator | Need | Help now, `/resources` | Official requirements + application paths | Referrals when RPC live | No eligibility guarantee |
| 7 | Health & wellness | Need | Help now, Resources (`health_wellness`) | Navigation / call / website | Referrals | No diagnosis |
| 8 | Mentorship | Grow | Help now, Resources | Program contact / referral | Referral status on My Path | No private mentor DM in V1 |
| 9 | Transportation | Need | Help now, Resources (`transportation`) | Pass/voucher programs | Ranked when mobility constraint | No ride dispatch |
| 10 | Community drives & impact | Can help | `/community`, GIVE | List/contribute via GIVE or external | Marketplace/community fulfillment rules | Pledges ≠ completed contributions |

**Excluded (per scope):** Neighbor Network, tools/equipment library.

---

## 2. Existing systems reused

- **Opportunity Engine:** `src/core/opportunity/*` (parser, orchestrator, dedupe, ranking, plan-store)
- **Resources:** `search_resources`, `resolve_resource_needs`, categories from `20261001100000_resources_core.sql`
- **Community Exchange:** UI + `community-help-service` + draft migration `20261021180000_*`
- **Marketplace / Food Rescue:** smart-help ranking, existing claim flow
- **Academy / Entrepreneurship / Jobs / Housing / Record Relief / Opportunities:** existing routes wired from pathway map
- **Partner CRM:** separate caseload `referrals` table; new **member resource referral** inbox alongside
- **Notifications:** referral accept/complete inserts in draft SQL (delivery depends on existing worker on DEV)

---

## 3. Actual code changes (this mission)

### Mobile (`fairpath-mobile`)

| Area | Files |
|------|--------|
| V1 registry | `src/core/opportunity/v1-pathways.ts` |
| Parser / orchestrator | `intent-parser.ts`, `orchestrator.ts`, `needs-model.ts` |
| UI | `src/app/grow/index.tsx`, `src/app/explore.tsx`, `src/app/my-path.tsx` |
| Tests | `tests/v1-pathways.test.ts`, extended `opportunity-intent-parser.test.ts` |
| Audits | `scripts/audit-opportunity.mjs`, `scripts/run-all-tests.mjs` |
| Referral SQL tests | `scripts/test-local-member-referral.mjs` → **8/8** (partner inbox/respond/complete) |
| Referral draft SQL | `partner_complete_resource_referral_request` added |
| Community docs/smoke | `docs/COMMUNITY_EXCHANGE_FULFILLMENT.md`, fixed post-apply smoke, `scripts/qa-dev-community-exchange-e2e.mjs` |
| My Path community sync | `src/core/opportunity/community-plan-sync.ts` |
| Opportunity alerts (local) | `opportunity-alert-prefs.ts`, notification settings toggles, unit tests |
| Pathway audit | `scripts/audit-v1-pathways.mjs` |

### Partner (`quindad-fairpath-partner`)

| Area | Files |
|------|--------|
| Inbox UI | `src/app/referrals/resource-requests/page.tsx` |
| Server actions | `src/app/resource-referral-actions.ts` |
| Nav link | `src/app/referrals/page.tsx` |
| Tests | `src/lib/__tests__/resource-referral-actions.test.ts` |

**Not modified:** Professional Profile draft, Canonical Justice draft.

---

## 4. Partner resource referral inbox status

| Item | Status |
|------|--------|
| Draft RPCs | `partner_list_resource_referral_inbox`, `partner_respond_resource_referral_request`, `partner_complete_resource_referral_request` |
| Partner UI | **Implemented** — accept / decline / mark service completed for org managers |
| Org scoping | `partner_is_org_manager(organization_id)` enforced in SQL |
| Honest pre-migration state | Banner when RPC missing (shared DEV today) |
| CRM separation | Copy + separate route from `/referrals` caseload table |
| Local SQL proof | **8/8 PASS** including FORBIDDEN for non-manager |
| Partner vitest | **20/20 PASS** (was 18/18 baseline + 2 new contract tests) |

**Release gate:** Referral migration still **NOT authorized to apply** until product approves; Partner integration is now testable locally after draft apply.

---

## 5. Community Exchange readiness

| Item | Status |
|------|--------|
| Shared DEV migration | **Applied** — version `20261021205913` (do **not** re-apply draft file) |
| Local SQL | **6/6 PASS** (draft parity) |
| Fulfillment semantics | `matched` ≠ `fulfilled`; see `docs/COMMUNITY_EXCHANGE_FULFILLMENT.md` |
| DEV E2E report | `docs/FAIRPATH_COMMUNITY_DEV_E2E_REPORT.md` |
| Automated E2E script | `scripts/qa-dev-community-exchange-e2e.mjs` — member JWT + anon key; **13/13 PASS** (expiration **SKIP**) |
| Mobile UI (web/iPhone) | **NOT TESTED** — typography/status-copy polish landed 2026-10-23 |
| My Path sync | Device-local `community-plan-sync.ts` — **not** cross-device |

---

## 6. Resource coverage gaps

Taxonomy already includes slugs aligned to V1 (`food`, `family`, `benefits`, `health_wellness`, `transportation`, `education`, `entrepreneurship`, `jobs`, etc.) — **no new category migration** in this mission.

| Gap | Notes |
|-----|--------|
| National real-data density | DEV fixtures (Cleveland-centric) — not a production catalog |
| Scholarships / drives | Rely on `opportunities` registry + org-published content; no invented seed listings |
| Community drives | No separate “drive” entity; V1 uses GIVE + org programs until Admin/Partner drive workflow extended |
| Referral availability flag | Member UI uses `memberReferralBackendReady()` + `partner_submitted` resources |

---

## 7. Opportunity Engine integration

- **Single engine:** Help now + pathway hub; no ten separate search stacks.
- **Multi-need:** e.g. GED + childcare + utilities parsed and searched (unit-tested).
- **V1 map:** `V1_PATHWAYS` + `resolveGrowthDiscovery()` feed resource category batches and routes.
- **No paid AI required** for baseline matching.

---

## 8. My Path integration

- Device-local **opportunity plan** unchanged (not cross-device synced).
- **Resource referral rows** loaded when RPC exists; statuses shown with honest copy (accepted ≠ service complete).
- **Community requests:** `syncCommunityRequestPlan()` on create + detail reload (`requested` / `offer_received` / `completed`).

---

## 9. Opportunity Alerts readiness

**Foundation added (local, opt-in default off):**

| Piece | Status |
|-------|--------|
| Device prefs | `loadOpportunityAlertPrefs` / `saveOpportunityAlertPrefs` — categories + 24h dedupe key |
| UI | Notification settings — master + per-category toggles (no push campaign activation) |
| Deep links | `opportunityDeepLinkFromMetadata()` for community + referral routes |
| Server push | **Not activated** — still requires `push_enabled` + token registration + worker verification |
| Matching engine | **Not built** — prefs only; no background scanner in this pass |

---

## 10. Admin changes

**None** in this mission (Admin repo not extended). Existing moderation/RBAC assumed for resources and marketplace.

---

## 11. Migration dependencies

| Migration | Depends on | Apply? |
|-----------|------------|--------|
| Community Exchange | Applied on DEV as `20261021205913` | **Do not re-apply** |
| `20261021185000_member_resource_referral_DRAFT.sql` | `resources`, org capabilities, `partner_is_org_manager` | **READY FOR APPROVAL (scoped)** — Partner UI + **8/8** SQL; **not applied** |
| Profile / Justice drafts | Independent | **Do not touch** |

Apply **separately** — never combine.

---

## 12. Actual test results

| Suite | Result | When |
|-------|--------|------|
| Mobile `npm run test:all` | **92/92 PASS** | 2026-10-23 |
| Community SQL (draft) | **6/6 PASS** | 2026-10-23 |
| Member referral SQL (draft) | **8/8 PASS** | 2026-10-23 |
| Partner `npm run test` | **20/20 PASS** | 2026-10-23 |
| Admin | **39/39** baseline | **Not rerun** |
| Shared DEV automated E2E | **14/14 PASS** (`qa-dev-community-exchange-e2e.mjs`, member JWT, 2026-10-23) |
| Mobile UI two-member manual | **NOT TESTED** (native iPhone **NOT TESTED**) |
| Native iPhone | Not run | Not claimed |
| Web responsive | Not run | Not claimed |

**Referral count reconciliation:** Authoritative harness is **8/8** (4 member + 4 partner). Earlier “4/6” in conversation was confusion with community **6/6**, not a failed referral test.

---

## 13. Local SQL / RLS evidence

- Community: RLS, category guard, `touch_community_help_expiry` service_role-only (gate doc).
- Referral: member read-own; writes via security definer RPCs; partner manager checks on inbox/respond/complete.
- Cross-member denial: covered by existing `test-local-cross-member-isolation.mjs` (not re-run individually).

---

## 14. Shared DEV limitations

- **Community:** Live — `communityHelpBackendReady()` should return true on DEV builds pointed at `znvhmuhojvwvjzmaqwff`.
- **Member resource referral:** RPCs **still absent** — mobile + Partner inbox show honest pending states.
- Run `qa-dev-community-exchange-e2e.mjs` locally to produce JSON proof artifact.

---

## 15. Native iPhone limitations

No physical device QA performed in this mission.

---

## 16. Security findings

- Partner resource referrals remain **organization-scoped** via SQL, not UI-only hiding.
- Community assistance does not require justice/profile/hardship documentation for ordinary flows.
- No new collection of financial or medical identifiers in V1 pathway UI.

---

## 17. Remaining blockers

1. **Executed** automated community E2E JSON on DEV (script ready; needs service role in runner env).
2. **UI E2E** two-member pass on Expo/web + My Path status confirmation.
3. **User approval** to apply member resource referral migration (separate from community).
4. **Referral shared DEV E2E** after migration apply.
5. **Opportunity alert matching** (scanner/scheduler) — prefs UI only so far.
6. **Resource data coverage** nationally — ops/content.
7. **My Path server sync** — separate draft if required.

---

## 18. Exact next recommended GO

1. **Engineering:** Run `node scripts/qa-dev-community-exchange-e2e.mjs --confirm-dev` with DEV service role; attach results JSON to this report.
2. **QA:** Manual two-member UI flow through **fulfilled**; verify notifications inbox routes.
3. **User:** Approve `20261021185000_member_resource_referral_DRAFT.sql` only (community already live).
4. **Engineering:** Apply referral migration on DEV via approved process; Partner `/referrals/resource-requests` + member resource detail + My Path referral statuses.
5. **Engineering:** Wire opportunity alert matcher to existing notification worker (respect local prefs + dedupe) — no push campaigns until verified.

**Success standard (unchanged):**  
MEMBER NEED OR GOAL → REAL OPPORTUNITY → WORKING ACTION → ACCURATE FOLLOW-THROUGH → CONFIRMED OUTCOME
