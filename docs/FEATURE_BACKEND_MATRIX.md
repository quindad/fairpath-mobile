# Feature → backend matrix (Task 007)

Maps **member-facing product areas** on `development/mobile-v1-completion` to **Supabase / Edge** dependencies and **offline proof**. DEV project: `znvhmuhojvwvjzmaqwff`.

| Area | Mobile entry (routes / modules) | Backend (tables · RPC · Edge) | Automated proof | Manual / external gap |
| --- | --- | --- | --- | --- |
| Auth & session | `/sign-in`, `/sign-up`, `/accept-terms`, `post-auth-route.ts` | `auth.users`, `profiles`, terms RPCs | `test:auth`, `test:auth-boundaries`, `test:auth-post-auth` | Apple (**013**) / Google (**014**) device OAuth |
| Onboarding | `/onboarding` | `profiles` (goals, location, tools) | `test:onboarding`, journey doc | Cloud profile row after migrations |
| Home | `/home` | `get_member_home_summary`, jobs/housing counts | `test:home` | Responsive QA **038** |
| Explore | `/explore` | discovery links only (no single RPC) | `test:explore` | Resource detail **042** |
| Jobs | `/find-jobs`, `/job/*`, saved, applications | `search_jobs`, `submit_job_application`, `withdraw_job_application`, `saved_jobs` | `test:jobs`, `test:sql:jobs-e2e` | DEV published jobs + loop **053** |
| Housing | `/find-housing`, `/housing/*` | `search_housing`, draft/submit/withdraw RPCs, storage for docs | `test:housing`, `test:sql:housing-documents` | DEV listings + loop **060 (manual)** |
| Record Relief | `/record-relief/*` | `record_relief_*`, RLS; evaluate via Edge | `test:relief`, `test:sql:relief`, fixtures | Legal gate **071**, live evaluate |
| Signal (member AI) | `signal.ts`, job/housing/credit surfaces | 17× Edge Functions, `_shared` gateway, credits RPC | `test:signal-deploy`, `test:ai` (Assistant) | Edge secrets; device smoke |
| My Path | `/my-path` | path/case tables per audit | `test:my-path` | Server sync edge cases |
| Credit & FairPath+ | `/credit*`, `/plus`, entitlements UI | credit studio RPCs, grants | `test:credit`, `test:credit-member`, `test:entitlements` | IAP / Stripe live **092–100** |
| Marketplace | `/marketplace/*`, food rescue | claim RPCs, quotas, RLS | `test:marketplace`, `test:sql:marketplace` | Live claim on DEV optional |
| Resources | `/resources`, `/resource/[id]` | resources catalog RPCs | `test:resources`, `test:sql:resources` | Detail accuracy **042** |
| Notifications | `/notifications`, settings, push hooks | `user_notifications`, `push_tokens`, workers | `test:notifications`, SQL delivery tests | **114–118** push on device (no token reg today) |
| Documents / Resume | `/documents/*`, `/resume-studio/*` | storage, render Edge, resume RPCs | `test:documents`, `test:sql:documents`, render tests | — |
| Payments | `/payments`, `/plus` | Stripe client + future webhooks | `test:payments` | Keys, sandbox, webhooks |
| Profile & privacy | `/me`, `/opportunity-profile`, `/privacy` | profile tables, deletion RPCs | `test:profile`, `test:member` | — |
| Partner / employer | *(not in consumer app)* | Command Center only | — | By design |

**Cross-cutting:** `src/core/supabase/database.types.ts` (generated), migrations under `supabase/migrations/`, shared Edge sync `npm run sync:edge`. Apply DEV migrations: `docs/DEV_SUPABASE_MOBILE_V1_MIGRATIONS.md`.

**Related:** `docs/FAIRPATH_ROUTE_INVENTORY.md`, `docs/EXTERNAL_INTEGRATION_REGISTER.md`, `docs/P0_P1_DEFECT_REGISTER.md`.
