# FairPath Mobile — route inventory (auto-maintained)

Generated during Master Completion Directive Phase 0 task **006**.

**Expo Router screens:** 107 files under `src/app/**/*.tsx` (includes dynamic `[id]` routes).

**Primary bottom navigation** (`ProductChrome` BottomNavBar): Home `/home`, Explore `/explore`, My Path `/my-path`, Signal `/fairpath-ai`, Profile `/me`.

**Auth & account:** `/`, `/sign-in`, `/sign-up`, `/check-email`, `/accept-terms`, `/onboarding`, `/auth/callback`, `/forgot-password`, `/reset-password`.

**Jobs:** `/find-jobs`, `/find`, `/job/[id]`, `/job-apply/[id]`, `/job-applications`, `/job-application/[id]`, `/saved-jobs`, `/saved-job-searches`.

**Housing:** `/find-housing`, `/housing-filters`, `/housing/[id]`, `/housing-apply/[id]`, `/housing-applications`, `/housing-application/[id]`, `/saved-homes`, `/saved-housing-searches`, `/housing-activity`, `/housing-inquiry/[id]`, `/housing-inquiry-thread/[id]`, `/housing-tour/[id]`, `/housing-report/[id]`, `/fasttrack-checkout/[id]` (retired redirect).

**Signal & AI:** `/fairpath-ai`, `/letter-explainer`, `/credit-tools`, plus contextual Signal on job/housing detail screens.

**Record relief:** `/record-relief`, `/record-relief/*` (add, case, scan, court-finder, coverage, my-statement, etc.).

**Credit:** `/credit`, `/credit/*`, `/credit-studio`, `/credit-tools`.

**Marketplace & food:** `/marketplace`, `/market-item/[id]`, `/marketplace-claim/[id]`, `/marketplace-claims`, `/marketplace-my-listings`, `/marketplace-manage/[id]`, `/marketplace-edit/[id]`, `/marketplace-list-item`, `/marketplace-report/[id]`, `/saved-marketplace`, `/food-rescue`.

**Profile & path:** `/me`, `/my-path`, `/opportunity-profile`, `/opportunity-profile/[section]`, `/complete-profile`, `/profile-readiness`, `/location-setup`, `/privacy`, `/appearance`, `/notification-settings`, `/notifications`, `/payments`, `/plus`.

**Resources & coverage:** `/resources`, `/resource/[id]`, `/saved-resources`, `/early-access`.

**Other product:** `/explore`, `/pathways`, `/opportunities`, `/academy`, `/academy/[id]`, `/veterans`, `/entrepreneurship`, `/documents/*`, `/resume-studio/*`, `/meetings/*`, `/legal-help`, `/safety`, `/dev-integration-health`.

**Integration health:** `/dev-integration-health` — use for DEV smoke checklist.

Orphan check: no `(tabs)` group; stack + bottom nav pattern. Root guards in `src/app/_layout.tsx` and `post-auth-route.ts`.
