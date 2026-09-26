# Sponsored FairPath+ entitlements (backlog / architecture requirement)

Status: REQUIREMENT ONLY. Not built. Recorded so Housing, Marketplace and future Account work do not
paint us into a corner. Do not implement inside the Housing pass unless it touches subscription entitlements.

## First use case: Corrections -> Community FairPath+ benefit

A person with a **verified FairPath profile from an approved correctional/tablet deployment** who later
migrates/activates that profile in the community app automatically receives **90 days of FairPath+ free**.

Hard requirements
- No card, no payment method, no checkout to activate. NOT a payment-provider trial.
- Eligibility comes from a **verified Corrections profile migration event**, recorded server-side.
  Never trust a client flag (`is_incarcerated`, `tablet_user`, `plus=true`, ...).
- Activates **once** per eligible person; the client cannot self-award or extend it.
- Server records: entitlement source, eligibility/migration event, activated_at, expires_at, status.
- FairPath+ is fully unlocked for the whole period. Member sees the expiry date/countdown, and gets
  advance reminders before it ends.
- At expiry: **no automatic charge**. With no paid subscription the account returns to the free tier and
  the normal FairPath+ renewal/paywall flow appears. The member may subscribe then.
- Expiry never deletes or locks the account, profile, applications, saved items or other free-tier data.
- Repeat migrations / account re-creation must not mint more 90-day grants (dedupe on the verified
  Corrections identity, not on the community account or email).
- Admin (future) can see source/status and handle legitimate exceptions through an **audited** process.

## Design: one generic entitlement system

Sponsored periods are just entitlement grants with a source, so the same system serves
institution-sponsored, nonprofit-sponsored, promotional and partner-funded periods later.

Sketch (names provisional):
- `entitlement_grants`: id, user_id, entitlement ('fairpath_plus'), source_type
  ('corrections_migration' | 'institution_sponsor' | 'nonprofit_sponsor' | 'promo' | 'partner' | 'support_exception'),
  source_ref (e.g. migration event id / sponsor id), status ('active'|'expired'|'revoked'), activated_at,
  expires_at, granted_by (system | admin user), created_at. Unique on (source_type, dedupe_key) so one verified
  Corrections identity yields at most one grant.
- `corrections_migration_events` (owned by the future Corrections/Account service): verified identity key,
  deployment, verified_at, consumed_grant_id. Written only by a trusted server path, never by the client.
- `entitlement_audit_log`: append-only record of every grant, extension, revoke and support exception (who/why).
- Effective plan = paid subscription (`fairpath_subscriptions`) OR any active, unexpired grant. Resolved
  server-side in one function (e.g. `current_fairpath_plan(user)`), used by every gate.
- Issuance only via security-definer functions / a service-role Corrections integration. Clients get
  read-only access to their own grants. RLS: owner read; no client insert/update/delete.
- Reminders: scheduled job writes `user_notifications` at e.g. 14 / 7 / 1 day(s) before `expires_at`.
  Expiry job flips status to 'expired'; nothing else changes.

## Where it lives in the architecture
- **Account / FairPath+** (membership domain): owns grants, effective-plan resolution, paywall/renewal UI,
  expiry countdown and reminders. Today only `fairpath_subscriptions` exists (unused by screens) and
  Marketplace reads `plan` through server RPCs; FastTrack quoting checks `fairpath_subscriptions` for the
  FairPath+ discount. Those server checks must move to the single effective-plan function when this is built,
  so a sponsored grant unlocks the same benefits (Marketplace 7 claims, FastTrack discount, etc.).
- **Corrections / tablet integration** (future service): issues the verified migration event. The community
  app never decides eligibility.
- **Admin** (future): read view + audited exception tooling over grants and the audit log.
- Client dead code `src/core/membership/entitlements.ts` has no importers today; it must become a thin
  reader of the server-resolved plan, never a source of truth.

## Not in scope of the Housing pass
Housing only reads plan indirectly (FastTrack discount via `quote_housing_fasttrack`). No Housing change is
needed now beyond keeping that check server-side (it is).
