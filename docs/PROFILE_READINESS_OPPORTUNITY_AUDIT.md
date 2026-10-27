# Opportunity Profile vs FairPath Readiness — audit (V1)

## Two systems (intentional)

| | **Opportunity Profile** | **FairPath Readiness** |
|--|-------------------------|-------------------------|
| **Purpose** | Employer-facing professional facts (when member opts in on apply) | Private screening, documents, housing, eligibility |
| **Storage** | `profiles` contact + `member_*` tables | `profile_answers` |
| **Completion** | Server `get_opportunity_completion` → **8 sections** | Client `readiness-engine` → **6 areas %** |
| **Home / Me** | Member summary `profile.completed_sections / 8` | Home panel “FairPath Readiness %” |
| **Employer access** | Only via `job_applications.answers.opportunity_snapshot` | No employer RLS policies |

## Overlapping topics (not duplicate tables)

| Topic | Readiness question IDs | Canonical for Easy Apply |
|-------|------------------------|---------------------------|
| Skills | `employment.skills` | `member_skills` (fallback: profile_answers) |
| Education | `employment.education_level` | `member_education` |
| Certs | `employment.licenses_certifications` | `member_credentials` |
| Desired roles | `employment.desired_roles` | `member_job_preferences.desired_titles` |
| Transportation | `employment.transportation` | `member_job_preferences.transportation_modes` |

**Behavior today:** Easy Apply prefers `member_*`; legacy readiness answers fill gaps only. Submit still dual-writes some `profile_answers` from apply form — unchanged in V1.

## UX unification (no schema change)

- **Opportunity Profile hub** explains readiness is separate.
- **Profile Readiness → Employment** links to Opportunity Profile / Resume Studio (`employment-profile-bridge.ts`).
- **Professional headline** lives on `profiles` (proposed column) — not in readiness questionnaire.

## Conflicting indicators (clarified for members)

- “8 of 8 sections” (Opportunity) ≠ “Readiness 100%” (questionnaire). Both can appear; they measure different things.
- Jobs are **not** gated on either metric (audit-jobs).

## Justice boundary

- Neither system exposes justice tables to employers.
- Record statement on apply is **separate** opt-in from Opportunity Profile snapshot.
