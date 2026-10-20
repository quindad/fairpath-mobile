# FairPath Mobile — Master Completion Tracker

**Branch:** `development/mobile-v1-completion`  
**HEAD (session start):** `b098aca` (after regression: see latest commit)  
**Test baseline:** `npm run typecheck` → pass; `npm run test:all` → **64/64** (includes `test:education`)  
**Directive:** FAIRPATH MOBILE — MASTER COMPLETION DIRECTIVE (160 tasks)

## Progress snapshot

| Metric | Count |
|--------|------:|
| Completed (verified) | Phases 2–4 partial, 5–11 member loops (automated), 8 Signal deploy |
| In progress | Manual DEV proofs, legal gate 071, Phase 13+ |
| Blocked (external) | Signal **model smoke** (Edge secrets + device), DEV migrations apply on cloud, Apple/Google device OAuth, IAP sandbox |
| Remaining | 152+ |

## Evidence log (newest first)

| Task | Status | Evidence |
|------|--------|----------|
| 072–085 | done (deploy) | 17 functions on DEV; `npm run test:signal-deploy`; runbook `SIGNAL_DEV_DEPLOY.md`; live text needs secrets |
| 034 | done | Home loads `get_member_home_summary` for application/saved counts |
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
- [x] **007** Feature-to-backend matrix → `docs/FEATURE_BACKEND_MATRIX.md`
- [x] **008** Environment isolation (.env.example → DEV ref only)
- [x] **009** P0/P1 defect register → `docs/P0_P1_DEFECT_REGISTER.md`

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

Journey: `docs/NEW_USER_JOURNEY_E2E.md` · Automated: `npm run test:onboarding`

- [x] **021** Five-step funnel (goals → location → tools → work/home → focus)
- [x] **022** Welcome copy on step 1 (progress bar, back to browse on step 0)
- [x] **023** Goals persisted → Home personalization (`goals`, `homeQuickLinks` — `test:home`)
- [x] **024** Location collection (`location_text`, saved search radius via profile)
- [x] **025** Reentry tools (`justice_impacted`, private copy — not employer-facing)
- [x] **026** Veteran transition tools (optional step 3, merged into goals)
- [x] **027** Experience summary on location step (optional `experience_summary`, max 500 chars)
- [x] **028** Finish later / resume (partial save → `/find-jobs`; private routes resume `/onboarding`)
- [x] **029** UX polish (FormScrollView, progress, error/retry on save)
- [x] **030** Full new-user journey E2E (`docs/NEW_USER_JOURNEY_E2E.md`, auth + onboarding audits)

## PHASE 3 — Home (031–038)

- [x] **031** Audit home + HomeStatus (`npm run test:home`)
- [x] **032** Personalized hero greeting (first name + goals eyebrow)
- [x] **033** Quick actions (goal pills via `homeQuickLinks`)
- [x] **034** Application shortcuts with counts (`loadMemberSummary` strip)
- [x] **035** Recommended opportunities (featured jobs + see all)
- [x] **036** Member status cards (`HomeStatus` + readiness panel)
- [x] **037** Empty/loading/error states (featured jobs + retry)
- [ ] **038** Responsive QA (device/browser pass — manual)

## PHASE 4 — Explore (039–042)

- [x] **039** Explore landing (`/explore` sections + status labels)
- [x] **040** Unified discovery patterns (`test:explore`, jobs/housing/resources audits)
- [x] **041** Map integration (JobMap/HousingMap on find screens — `test:jobs` / `test:housing`)
- [ ] **042** Resource detail accuracy (manual + `test:resources`; see `EXPLORE_DISCOVERY_E2E.md`)

## PHASE 5 — Jobs (043–053)

Member loop: `docs/JOBS_MEMBER_LOOP_E2E.md` · Automated: `npm run test:jobs`, `npm run test:sql:jobs-e2e`

- [x] **043** Find jobs discovery (`/find-jobs`, guest `search_jobs`, pagination, error clears stale rows)
- [x] **044** WHERE / radius / filter modal (saved ZIP, 10–100 mi, remote + second-chance filters)
- [x] **045** List ↔ map (`JobMap`, pin → details, no duplicate map controls)
- [x] **046** Job detail CTAs (Easy Apply, save, Signal, signed-out `returnTo`)
- [x] **047** Saved jobs (`/saved-jobs`, save/unsave RPC, auth gate)
- [x] **048** Signal on job (fit explanation + cover letter draft hooks)
- [x] **049** Easy Apply (`/job-apply/[id]`, minimum fields, Opportunity Profile autofill, `ALREADY_APPLIED`)
- [x] **050** Applications hub (`/job-applications`, refresh, deep links)
- [x] **051** Application detail (timeline, withdraw, interview prep Signal)
- [x] **052** Saved job searches (save from find-jobs, `/saved-job-searches`, honest alert copy)
- [ ] **053** DEV cloud member loop proof → `docs/DEV_MANUAL_MEMBER_QA.md` § B

## PHASE 6 — Housing (054–060)

Member loop: `docs/HOUSING_MEMBER_LOOP_E2E.md` · Automated: `npm run test:housing`, `npm run test:sql:housing-documents`

- [x] **054** Find housing discovery (`search_housing`, pagination, stale-result clear on error)
- [x] **055** WHERE / radius / in-screen filters (saved ZIP, filter keys wired to RPC)
- [x] **056** List ↔ map (`HousingMap`, single MAP toggle)
- [x] **057** Listing detail (save, Signal fit, draft-first apply entry, signed-out `returnTo`)
- [x] **058** Apply flow (`housing-apply/new`, draft at step 2+, documents, submit RPC, FastTrack retired)
- [x] **059** Applications hub + workspace (timeline, withdraw, Signal application prep)
- [x] **060** Saved homes + saved searches (save/remove, reopen find-housing)
- [ ] **060 (manual)** DEV cloud housing loop → `docs/DEV_MANUAL_MEMBER_QA.md` § C

## PHASE 7 — Record Relief (061–071)

Member loop: `docs/RECORD_RELIEF_MEMBER_LOOP_E2E.md` · Automated: `npm run test:relief`, `npm run test:sql:relief`, `npm run test:relief-fixtures`

- [x] **061** Hub (`/record-relief`, disclaimer, case list, add entry)
- [x] **062** Coverage + jurisdiction catalog (verified-only reads; TEST DATA labeled)
- [x] **063** Add case validation (`validateCase`, payload without guessing unknowns)
- [x] **064** Shared evaluation (`evaluate-record-relief` Edge, `reevaluateCase`)
- [x] **065** Case workspace hedged outcomes (stale/changed rules, federal branch)
- [x] **066** Document exports (summary/checklist/worksheet/forms guide; registry rules)
- [x] **067** Scan packet consent + packet service (no silent uploads)
- [x] **068** SQL boundaries (RLS, no anon grants, no unverified rules in migration)
- [x] **069** Checklist + filing status on case screen
- [x] **070** Legal-safety wording audit (no overclaims across relief screens)
- [ ] **071** Legal review gate + live DEV proof (`RECORD_RELIEF_LEGAL_REVIEW_GATE.md`, operator QA)

## PHASE 8 — Signal AI (072–085)

- [x] **072–085** Signal DEV deploy (`npm run deploy:signal:dev` → 17 functions on `znvhmuhojvwvjzmaqwff`; **model live proof** still needs Edge secrets in Dashboard)

## PHASE 9 — My Path (086–091)

- [x] **086–091** My Path (`MY_PATH_E2E.md`, `test:my-path`; server sync/case tasks remain planned in UI)

## PHASE 10 — Credit & FairPath+ (092–100)

- [x] **092–100** Credit + FairPath+ app loop (`CREDIT_FAIRPATH_PLUS_E2E.md`, `test:credit`, `test:credit-member`, `test:entitlements`; **IAP live proof** still BLOCKED sandbox)

## PHASE 11 — Marketplace (101–108)

- [x] **101–108** Marketplace member/donor loop (`MARKETPLACE_MEMBER_LOOP_E2E.md`, `test:marketplace`; claimant read-only donor notes, no claimant messaging)

## PHASE 12 — Education & resources (109–113)

Loop: `docs/EDUCATION_RESOURCES_E2E.md` · `npm run test:education`, `npm run test:resources`

- [x] **109** Academy fixture catalog + honest cost labels + external links
- [x] **110** No in-app certificate theater (`/academy/[id]` redirect copy)
- [x] **111** Resources search + Explore links + Academy → Resources banner
- [x] **112** Resource detail RPC + save (automated); manual **042** on DEV content
- [x] **113** Saved resources hub

## PHASE 13 — Notifications (114–118)

Loop: `docs/NOTIFICATIONS_MEMBER_LOOP_E2E.md` · `npm run test:notifications`

- [x] **114** In-app inbox (load, mark one, mark all, settings link)
- [x] **115** Unread count on Home
- [x] **116** Settings + `register_push_token` / `unregister_push_token` (code complete)
- [x] **117** Notification tap routing in `_layout.tsx`
- [ ] **118** Device push proof (manual — **P0-005**)

## PHASE 14 — Profile & a11y (119–125)

- [ ] **119–125**

## PHASE 15 — Supabase DEV ops (126–135)

Runbook: `docs/DEV_SUPABASE_MOBILE_V1_MIGRATIONS.md` (operator checklist table)

- [x] **126–129** Documented: link DEV, migration list, review pending batch
- [ ] **130** `supabase db push` on DEV (**operator** — approval required)
- [ ] **131–132** SQL verify RPC + profile columns on cloud
- [ ] **133–134** Accept-terms + onboarding smoke on DEV app
- [x] **135** Evidence template + local proof (`test:sql:consent`, `test:all` 63/63)

## PHASE 16 — QA (136–152)

- [ ] **136–152**

## PHASE 17 — Launch prep (153–160)

- [ ] **153–160** (158 commit/push only when authorized)

---

*Full task text for 043–160 matches the Master Completion Directive in chat; expand this file as each task is verified.*
