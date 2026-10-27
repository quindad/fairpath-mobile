# Community Exchange — Shared DEV E2E Report

**Project:** `znvhmuhojvwvjzmaqwff`  
**Migration:** `20261021205913` (applied — **do not re-apply**)  
**Report date:** 2026-10-23  

---

## 1. Real E2E result

| Run | Method | Result |
|-----|--------|--------|
| **2026-10-23 automated** | `node scripts/qa-dev-community-exchange-e2e.mjs --confirm-dev --use-documented-dev-accounts` | **13/13 assertions PASS** |
| Expiration sweep | Cron / service role only | **SKIP** (not counted as pass) |
| Artifact | `qa-dev-community-exchange-e2e-results.json` | Written (emails masked) |
| **2026-10-23 UI polish** | Community screens + `status-copy.ts` + My Path plan rows | **Implemented** — see §3 |

**Workflow proven on live DEV:**

1. Member A creates request → persists in `list_my_community_help_requests`  
2. Member B finds request on `list_open_community_help_board`  
3. Member B offers → offer `offered`, request stays **`open`**  
4. Member A sees offer via RLS; postal visible to owner only  
5. Member B **cannot** accept offer  
6. Member A accepts → **`matched`** (not fulfilled)  
7. Member A fulfills → **`fulfilled`**  
8. Member B cannot read fulfilled request via `member_get_community_help_request`  
9. Member A has `user_notifications` with `category = community`  
10. Member A cancels a separate request → **`cancelled`**

**Persistent test rows (DEV only, not deleted):** see JSON `requestId`, `offerId`, `cancelRequestId` — dedicated QA personas, not unrelated member data.

---

## 2. Authentication method

| Aspect | Implementation |
|--------|----------------|
| Member RPCs | **Supabase Auth** `signInWithPassword` + **anon/publishable key** client |
| JWT | Each RPC runs under the member’s **access token** (not service role) |
| Service role | **Not used** in default E2E path (`serviceRoleUsed: false`) |
| QA personas | `dev-free@fairpath.test` (A), `dev-plus@fairpath.test` (B) |
| Passwords | From env (`QA_COMMUNITY_MEMBER_*_PASSWORD`) or `--use-documented-dev-accounts` (same as `seed-dev-test-users.mjs`; never logged) |
| Optional | `--provision-disposable` + service role creates `@dev-seed.fairpath.test` users — **isolated setup only** |

**Script fix (this session):** Removed service-role requirement for the main workflow; corrected invalid postal (`44113` — DEV check constraint rejects non-ZIP patterns).

---

## 3. Mobile UI test results

| Check | Result |
|-------|--------|
| Native iPhone | **NOT TESTED** |
| Expo web smoke (`localhost:8082`) | **PARTIAL PASS** — signed-in QA session: Home → Community hub → Can-help (empty state) → New request form renders; List free item → marketplace form; automated submit blocked (RN controlled fields vs browser fill) |
| Expo web two-member flow | **NOT TESTED** (needs manual typing + second account sign-in) |
| Code contract audit | **PASS** — screens call same RPCs as harness |
| Community UI audit script | **PASS** after typography + stale-copy fixes (`npm run audit:community` if wired) |
| My Path community sync | **Code path verified** — device-local AsyncStorage via `community-plan-sync.ts`; **NOT cross-device** |

**Existing app surfaces (for manual QA):**

| Step | Screen | Actions |
|------|--------|---------|
| Create | `/community/need-help/new` | Submit → `createCommunityHelpRequest` + `syncCommunityRequestPlan` |
| Owner detail | `/community/need-help/[id]` | Accept/decline offers, **Mark fulfilled**, cancel |
| Helper | `/community/can-help` + board | Offer |
| My Path | `/my-path` | Plan item updates on create/detail reload (device-local) |

**Recommendation:** Run manual UI pass with same two DEV accounts; confirm button labels match `open` / `matched` / `fulfilled`.

---

## 4. Privacy test results (automated DEV)

| Test | Result |
|------|--------|
| Non-owner `postal_code` hidden on `member_get_community_help_request` | **PASS** |
| Helper cannot accept offer | **PASS** |
| Non-owner cannot read fulfilled request | **PASS** |
| Signed-out board RPC | **PASS** (`SIGNED_OUT`) |
| Offer visibility | Owner sees offers; helper RLS limited to own offer row |

---

## 5. Notifications

| Test | Result |
|------|--------|
| Member A inbox contains `community` notifications after offer flow | **PASS** (at least one row) |
| Push delivery / dedupe | **NOT TESTED** (in-app rows only) |

---

## 6. Cancellation & expiration

| Test | Result |
|------|--------|
| Member cancel open request | **PASS** |
| Expiration via `touch_community_help_expiry` | **NOT TESTED** (service_role-only; cron) |

---

## 7. My Path sync

| Test | Result |
|------|--------|
| Automated harness | **NOT TESTED** (AsyncStorage is on-device) |
| Implementation | `community-plan-sync.ts` on create + detail reload |
| Mapping | `open`→requested, `matched`→offer_received, `fulfilled`→completed |

---

## 8. Remaining defects / gaps

1. **Manual mobile UI** not executed — milestone needs one UI sign-off pass.  
2. **Expiration** not validated end-to-end without service_role cron.  
3. **Helper notification** on accept — inserted server-side; helper inbox not asserted in harness.  
4. E2E leaves real DEV rows (by design — no unrelated cleanup).  
5. `--use-documented-dev-accounts` uses known DEV seed passwords — prefer vault env vars in CI.

---

## 9. Referral release readiness

See **`docs/DEV_RELEASE_GATE_MEMBER_RESOURCE_REFERRAL.md`**.

| Evidence | Status |
|----------|--------|
| SQL 8/8 | PASS |
| Partner 20/20 | PASS |
| Consent preview on resource detail | Implemented |
| Partner inbox accept/decline/complete | Implemented (pre-migration banner) |
| Shared DEV apply | **Not done** — approval gate only |

---

## 10. V1 pathway coverage (fixture mirror)

Run: `node scripts/audit-v1-pathway-coverage.mjs` — counts **published** resources per pathway category slugs on local fixture DB (DEV catalog may differ). Routes alone ≠ complete features; gaps are **data/ops** where counts are zero.

---

## 11. Exact next recommended GO

1. **Manual UI E2E** — dev-free / dev-plus through app screens through **fulfilled**; verify My Path card text.  
2. **Approve & apply** member resource referral migration (separate gate).  
3. **Referral shared DEV E2E** after apply.  
4. Wire **opportunity alert matcher** (prefs exist; no scanner yet).  
5. Optional: add helper notification assertion to harness after accept step.

**Community Exchange milestone:** **RPC E2E PASS** on shared DEV; **UI milestone open** until manual screen pass documented.
