# Command Center TODO — built from the Unite Us research package + what I've personally verified live

Source: `FairPath-UniteUs-Research-Package.zip` (20 engineering batches, B00–B20) + my own hands-on testing of `quindad-fairpath-partner` this session (real login, real data, real create-action proven end-to-end — not just code reading).

**Evidence key:** ✅ VERIFIED (I personally clicked it and watched it work) · 🟡 CODE EXISTS, not click-tested · 🔲 NOT BUILT · ⚠️ GAP (exists but has a known hole)

---

## Part 1 — What's already real (don't rebuild this)

| Research batch | What it asks for | Actual status |
|---|---|---|
| B02 Shared shell | `/admin` + partner workspaces, nav, access-denied states | ✅ VERIFIED — logged in, every section loads, role/org shown in header |
| B01 Org access | Membership, roles, capabilities, isolation | 🟡 Real tables exist (`organization_members`, `organization_capabilities`), RLS-backed. **Not yet proven live that Org A can't see Org B** (next action below) |
| B06/B07 Referral send/receive/accept/reject | Draft → send → inbox → accept/reject | 🟡 Real backend exists (`partner_referral_crm_core.sql` — full `NEED → REFERRAL → ACCEPT/DECLINE → OUTCOME` state machine, found and read this session). Referrals *page* loads live, showed honest empty state. Not yet click-tested with real data end to end. |
| B08 Service delivery / closed loop | Episode record, outcome evidence | 🟡 `job_placements` table + `partner_record_placement()` — I personally found and **fixed a real security hole** in this exact function this session (capability check was missing), proved the fix on a test database. Not yet applied to real DEV — waiting on your go-ahead. |
| B13 Employer workspace | Jobs, applications, stages, hire confirmation | 🟡 Backend hardened this session: hiring-stage pipeline tested 11/11, org-context tested 7/7, placement-evidence gap found+fixed 3/3 (all on a test database, real fix not yet applied live). Jobs *page* in Partner app loads live, real data. |
| B14 Housing workspace | Listings, applications, review stages | 🟡 Housing page loads live, real data, honest empty state |
| Campaigns (not in Unite Us research — FairPath-original) | Outreach to your own caseload only | ✅ VERIFIED — I created a real test campaign, it saved, showed up in the list, both light and dark mode confirmed |
| Impact/evidence | Fact lineage, confidence, no fake numbers | ✅ VERIFIED — page explicitly says "We don't estimate. We wait until we can prove it," lists exactly what's unproven (wages, retention, housing stability, message delivery) |

**Bottom line on Part 1:** the skeleton Freebuff's research assumed might not exist — a real shell, real auth, real org-scoped data, a real referral/case-management backend, a real hiring pipeline — **already exists and is substantially real**, not a mockup. The research package's B00 ("find out what's already built") is largely answered by this table.

## Part 2 — Real, confirmed gaps (from research + my own code reading)

1. **Org-to-org isolation — NOT YET PROVEN LIVE.** I only logged in as one test org. Need a second synthetic org and proof Org A genuinely cannot see Org B's caseload/jobs/housing/referrals. **(Doing this next, see below.)**
2. **Placement-evidence security hole — FOUND, FIXED, NOT YET APPLIED.** Already covered above — waiting on your approval to push the fix to real DEV.
3. **Consent versioning (B04)** — the research package wants explicit, revocable, scoped consent records (who can see what, for how long). Not yet confirmed whether FairPath's existing consent model covers partner-side data sharing the same way it covers AI/document consent on mobile.
4. **Documents/attachments in the Command Center (B10)** — case managers need to see/share documents with proper access control. Not yet checked whether this exists partner-side.
5. **Follow-up queues & notifications (B11)** — overdue follow-ups, reminders, SLA tracking. The Caseload page already *shows* an overdue-follow-up count, so the data model partially exists — whether real notifications fire is unconfirmed.
6. **Institutional workspace (B15)** — correctional/pre-release partner access. Not started, lower priority per your own focus ("jobs and housing" first).
7. **Exports/reporting maturity (B17)** — CSV/report generation with privacy protections. Unconfirmed.

## Part 3 — The "make it work like Indeed/Homes.com" ask

I already did real competitor research this session (separate docs in `docs/competitive-intelligence/`). Relevant, concrete findings:
- **Conversational/AI search is now table stakes** — Homes.com, Apartments.com, and RentCafe *all three* have it. FairPath AI already exists; extending it to handle job/housing search conversationally is the single highest-leverage "feel like the big guys" move, and it's not a new system — it's extending `orchestrator.ts`, which already exists.
- **Indeed has zero fair-chance specialization** — confirms FairPath's conviction-aware matching is a real differentiator, not something to copy from Indeed.
- **Apartments.com's tenant-screening tool explicitly screens on criminal history, no fair-chance mitigation** — validates FairPath's existing per-listing screening-disclosure feature as genuinely protective, not just nice-to-have.
- **Honest Jobs' "verified employer" trust signal** and **ZipRecruiter's "Breakroom" employer-quality ratings** are both real, buildable ideas for a listing-level trust panel — already scoped in the Honest Jobs research package's backlog.

None of this requires copying big-box UI — it means: good search/filter UX (which FairPath mobile's Jobs/Housing search already has, per earlier verification this session), plus the two-sided trust signal idea, plus conversational AI search.

## Part 4 — "Top-notch CRM" = the Caseload/Referral/Case-management side

This is literally what the Unite Us research package (B04, B06–B11) is about. The honest state: the backend exists and is more sophisticated than it looks (full referral state machine, follow-up tracking fields already in the data model) — what's unverified is whether the full lifecycle (draft → send → hold → accept → service delivered → verified closure → reopened) actually works end to end with real data, since I've only seen it with empty test data so far.

---

## Immediate next action (executing now, not just listed)

**Prove org isolation live** — create a second synthetic test org, log in as it, confirm it genuinely cannot see the first test org's data anywhere in the Command Center. This is the single most important unproven claim in the entire research package (Unite Us's own research flagged it as the #1 architectural risk: "membership in an organization must not expose all members, all care histories, or another organization's records").
