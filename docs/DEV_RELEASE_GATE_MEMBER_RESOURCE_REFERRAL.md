# DEV Release Gate — Member Resource Referral (separate from Community)

**Date:** 2026-10-23  
**Verdict:** **READY FOR APPROVAL (scoped)** — do **not** apply until explicit authorization.  
**Community Exchange:** already live on DEV (`20261021205913`) — independent migration.

---

## 1. Migration artifact

| Item | Path |
|------|------|
| Draft SQL | `docs/proposed-migrations/20261021185000_member_resource_referral_DRAFT.sql` |
| Depends on | `resources`, `resource_organizations`, `organization_capabilities`, `partner_is_org_manager` |
| Does **not** depend on | Community tables (may apply after community; order flexible) |

**Rollback:** documented in draft header (drop partner complete/respond/inbox, member list/submit, table).

---

## 2. RPC contract

| RPC | Caller | Purpose |
|-----|--------|---------|
| `member_submit_resource_referral_request` | Member | Consent timestamp; eligibility gate |
| `list_my_resource_referral_requests` | Member | My Path + resource detail status |
| `partner_list_resource_referral_inbox` | Org manager | Inbox |
| `partner_respond_resource_referral_request` | Org manager | Accept / decline → member notification |
| `partner_complete_resource_referral_request` | Org manager | Service delivered → member notification |

**Separate from:** CRM `referrals` / `participant_needs` (no auto-bridge).

---

## 3. Eligibility (server-enforced)

- Resource `publish_status = published`, `verification_state = verified`
- `source_authority = partner_submitted` **OR** org has active `case_management` capability

---

## 4. Local test evidence

| Suite | Result |
|-------|--------|
| `scripts/test-local-member-referral.mjs` | **8/8 PASS** (member + partner inbox/forbidden/accept/complete) |
| Partner vitest | **20/20 PASS** (includes resource-referral-actions contract) |
| Mobile regression | **92/92 PASS** (includes referral service + audits) |

---

## 5. Partner UI (pre-migration honest states)

| Surface | Path |
|---------|------|
| Inbox | `/referrals/resource-requests` |
| Actions | `src/app/resource-referral-actions.ts` |
| CRM link | `/referrals` → member resource inbox link |

Before migration: banner when RPC missing.

---

## 6. Mobile member UX

| Surface | Behavior |
|---------|----------|
| Resource detail | Consent copy + submit when `memberReferralBackendReady()` and participating resource |
| My Path | Lists referral rows with honest status (accepted ≠ complete) |
| Pending DEV | Copy when RPC absent |

---

## 7. Shared DEV today

- `member_resource_referral_requests` — **not present** (expected until apply)
- Post-apply: member submit → partner inbox → accept → complete → member notification + My Path refresh

---

## 8. Approval request

**Apply to shared DEV (when authorized):** `20261021185000_member_resource_referral_DRAFT.sql` only.

**Post-apply smoke (manual + script TBD):**

1. Member submits on `partner_submitted` published resource  
2. Partner manager lists inbox, accepts  
3. Partner marks complete  
4. Member sees status on resource / My Path  
5. Non-manager FORBIDDEN on inbox  

**Do not combine** with Profile or Justice migrations.

---

## 9. NOT READY items (post-apply only)

- Shared DEV E2E not executed (migration not applied)  
- Org-wide staff push for every referral (notifications insert for member only today)  
