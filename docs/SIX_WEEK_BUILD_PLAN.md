# FairPath — Six Week Build Plan

Target: a launchable FairPath ecosystem in six weeks, with one shared backend and separate consumer, partner, and admin experiences.

## Week 1 — Platform foundation + consumer shell
- Lock shared domain models and design tokens.
- Keep the Expo consumer client stable across phone, tablet, and web.
- Define public web routes for Jobs, Housing, and Resources.
- Establish application/session guards and real navigation.
- Define the Partner/Admin application boundary.
- Remove placeholder dead ends from the highest-traffic consumer paths.

## Week 2 — Jobs
- Job schema, employer ownership, publishing states, and RLS.
- Public job search/detail.
- Mobile job search/detail/save/apply.
- Employer create/edit/publish/manage jobs.
- Admin verification/moderation hooks.

## Week 3 — Housing
- Housing/property/listing schema, ownership, publishing states, and RLS.
- Public housing search/detail.
- Mobile housing search/detail/save/apply.
- Property-owner listing management.
- FastTrack application foundation and admin review hooks.

## Week 4 — Matching + FairPath AI + resources
- Shared eligibility/matching services.
- Profile-aware job and housing recommendations.
- FairPath AI assistance for discovery and applications.
- Resource directory and jurisdiction-aware content architecture.
- Auditability/human review for high-impact workflows.

## Week 5 — Marketplace + messaging + revenue
- Marketplace claims and pickup workflow.
- Messaging.
- FairPath+ subscription foundation.
- FastTrack payments.
- Partner billing foundation.
- Notifications and transactional events.

## Week 6 — Partner/Admin completion + launch hardening
- Partner dashboards for employers, property owners, and organizations.
- Admin verification, moderation, support, and reporting.
- End-to-end permission/RLS review.
- Mobile/tablet/web QA.
- Accessibility, error states, analytics, privacy, store/web launch preparation.

## Definition of launchable
A launchable feature is not a mock screen. Its primary user journey has real data, authorization, loading/empty/error states, a working destination for every primary action, and an end-to-end test path.
