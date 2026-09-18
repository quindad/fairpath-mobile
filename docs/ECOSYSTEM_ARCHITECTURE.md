# FairPath Ecosystem Architecture

FairPath is one platform with separate user experiences.

## Experiences

- Consumer Mobile: iOS, Android, iPad, and Android tablets.
- Consumer Web: public job, housing, and resource discovery with a lighter browser experience.
- Partner Web: employers, property owners, and organizations manage listings, applicants, messages, and billing.
- Admin Web: FairPath staff manage verification, moderation, support, reporting, and platform operations.

## Shared Core

All experiences use the same FairPath backend and canonical records. They do not maintain separate copies of jobs, housing listings, accounts, applications, or messages.

Shared platform capabilities include:

- Supabase Postgres
- Supabase Auth
- authorization and row-level security
- opportunity and application models
- matching rules
- FairPath AI services
- messaging
- payments and subscriptions
- notifications
- analytics events

## Product rule

Share data, domain models, business rules, and brand primitives where practical. Do not force identical user interfaces across phone, tablet, public web, partner web, and admin web.

## Repository direction

The current Expo project remains the FairPath consumer cross-platform client. Shared domain code lives under src/core so it can be extracted into a shared package as the Partner/Admin web application is introduced. Partner/Admin should be a separate desktop-first application using the same backend, not a set of mobile screens stretched onto desktop.

## Data rule

A record has one canonical source. For example, an employer-created job is stored once and can be surfaced to consumer web, mobile, matching, notifications, and partner management according to authorization rules.
