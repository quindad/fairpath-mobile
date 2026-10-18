# FairPath Mobile — Master Completion Tracker

**Branch:** `development/mobile-v1-completion`  
**HEAD (session start):** `12a2572`  
**Test baseline (session start):** `npm run test:all` → **55/55**; `npm run typecheck` → pass; `expo-doctor` → 10 packages out of date (non-blocking)  
**Directive:** FAIRPATH MOBILE — MASTER COMPLETION DIRECTIVE (160 tasks)

## Progress snapshot

| Metric | Count |
|--------|------:|
| Completed (verified) | 8 |
| In progress | Phase 3 Home |
| Blocked (external) | Signal **live** deploy (runbook ready), DEV migrations apply on cloud, Apple/Google device OAuth, IAP sandbox |
| Remaining | 152+ |

## Evidence log (newest first)

| Task | Status | Evidence |
|------|--------|----------|
| 034 | in progress | Home loads `get_member_home_summary` for application/saved counts |
| 032 | in progress | Home greeting uses `first_name` from personalization |
| 006 | done | `docs/FAIRPATH_ROUTE_INVENTORY.md` |
| 005 | done | typecheck pass; test:all 55/55 |
| 003 | done | Commits `8889d80`, `055a91c`, `bd56e63`, `12a2572` on branch |
| 002 | done | AGENTS.md, MEMBER_JOURNEY, EXIT_CRITERIA read |
| 001 | done | Clean tree on `development/mobile-v1-completion` @ `12a2572` |

---

## PHASE 0 — Repository recovery (001–009)

- [x] **001** Confirm branch and working tree
- [x] **002** Read repository instructions
- [x] **003** Verify delivered commits
- [x] **004** Create master tracker (this file)
- [x] **005** Baseline quality (typecheck, test:all)
- [x] **006** Route inventory → `docs/FAIRPATH_ROUTE_INVENTORY.md`
- [ ] **007** Feature-to-backend matrix
- [x] **008** Environment isolation (.env.example → DEV ref only)
- [ ] **009** P0/P1 defect register

## PHASE 1 — Authentication (010–020)

- [x] **010** Audit auth screens (`npm run test:auth` inventory + funnel checks)
- [x] **011** Email registration E2E (code paths + audit; manual verify-email in `AUTH_E2E_BROWSER_CHECKLIST.md`)
- [x] **012** Email login E2E (post-auth routing + DEV account; manual browser pass optional)
- [ ] **013** Apple Sign In — BLOCKED: device + Apple developer config
- [ ] **014** Google Sign In — BLOCKED: OAuth client config
- [ ] **015** Microsoft/Yahoo — evaluate
- [ ] **016** Phone auth if enabled
- [x] **017** Post-auth routing comprehensive (`resolvePostAuthRoute` on accept-terms + instant sign-up session; browser proof: `docs/AUTH_E2E_BROWSER_CHECKLIST.md`)
- [x] **018** Accept-terms persistence + DEV migration (RPC sync + ledger fallback; runbook `DEV_SUPABASE_MOBILE_V1_MIGRATIONS.md`; apply on DEV Supabase)
- [x] **019** Account recovery (forgot/reset + PKCE tests; manual inbox link optional)
- [x] **020** Authorization boundaries (`npm run test:auth-boundaries`, `docs/AUTH_AUTHORIZATION_BOUNDARIES.md`)

## PHASE 2 — Onboarding (021–030)

- [ ] **021** Review five-step onboarding
- [ ] **022** Welcome experience
- [ ] **023** Personalize goals → Home
- [ ] **024** Location collection
- [ ] **025** Reentry information respect
- [ ] **026** Veteran preferences
- [ ] **027** Experience summary + migration
- [x] **028** Finish later / resume (partial save → `/find-jobs`; private routes resume `/onboarding`)
- [ ] **029** Onboarding polish
- [x] **030** Full new-user journey E2E (`docs/NEW_USER_JOURNEY_E2E.md`, `npm run test:onboarding`)

## PHASE 3 — Home (031–038)

- [ ] **031** Audit home + HomeStatus
- [ ] **032** Personalized hero greeting
- [ ] **033** Quick actions
- [ ] **034** Application shortcuts with counts
- [ ] **035** Recommended opportunities
- [ ] **036** Member status cards
- [ ] **037** Empty/loading/error states
- [ ] **038** Responsive QA

## PHASE 4 — Explore (039–042)

- [ ] **039** Explore landing
- [ ] **040** Unified discovery patterns
- [ ] **041** Map integration
- [ ] **042** Resource detail accuracy

## PHASE 5 — Jobs (043–053)

- [ ] **043–053** (see Master Directive)

## PHASE 6 — Housing (054–060)

- [ ] **054–060** (see Master Directive; FastTrack gated off)

## PHASE 7 — Record Relief (061–071)

- [ ] **061–071** (preserve engine; legal QA)

## PHASE 8 — Signal AI (072–085)

- [ ] **072–085** (deploy DEV — runbook `SIGNAL_DEV_DEPLOY.md`, `test:signal-deploy`; **live deploy** needs operator secrets + `npm run deploy:signal:dev`)

## PHASE 9 — My Path (086–091)

- [ ] **086–091**

## PHASE 10 — Credit & FairPath+ (092–100)

- [ ] **092–100** (IAP — BLOCKED sandbox)

## PHASE 11 — Marketplace (101–108)

- [ ] **101–108** (claimant read-only messages shipped)

## PHASE 12 — Education & resources (109–113)

- [ ] **109–113**

## PHASE 13 — Notifications (114–118)

- [ ] **114–118**

## PHASE 14 — Profile & a11y (119–125)

- [ ] **119–125**

## PHASE 15 — Supabase DEV ops (126–135)

- [ ] **126–135** (migrations apply — APPROVAL REQUIRED on DEV)

## PHASE 16 — QA (136–152)

- [ ] **136–152**

## PHASE 17 — Launch prep (153–160)

- [ ] **153–160** (158 commit/push only when authorized)

---

*Full task text for 043–160 matches the Master Completion Directive in chat; expand this file as each task is verified.*
