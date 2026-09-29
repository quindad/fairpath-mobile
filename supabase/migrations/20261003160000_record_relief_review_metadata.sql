-- Adds missing production-critical review metadata to Record Relief, found via a schema audit against the
-- fields a real legal-data operation needs. Additive only — respects the existing normalized design (jurisdictions
-- / rules / forms / federal pathways stay separate tables), does not touch the existing draft/verified/superseded/
-- retired status enum or anything the evaluation engine reads (no gating behavior changes here).
--
-- Gaps found and closed: no "next review due" field (staleness was only a derived UI warning, never queryable),
-- no reviewer identity anywhere (a rule could be marked "verified" with zero record of WHO verified it), and no
-- staff-only internal notes field (only the member-facing `summary` existed — researchers need a place for
-- working notes, source excerpts, and open questions that should never reach a member).
alter table public.record_relief_rules
  add column if not exists next_review_at date,
  add column if not exists researched_by text,
  add column if not exists reviewed_by text,
  add column if not exists staff_notes text;

alter table public.record_relief_federal_pathways
  add column if not exists next_review_at date,
  add column if not exists researched_by text,
  add column if not exists reviewed_by text,
  add column if not exists staff_notes text;

alter table public.record_relief_forms
  add column if not exists next_review_at date,
  add column if not exists reviewed_by text,
  add column if not exists staff_notes text;

comment on column public.record_relief_rules.next_review_at is
  'When this rule should next be checked against its source, regardless of last_verified_at staleness. Distinct from staleness: a fast-changing jurisdiction may need review sooner than the generic 1-year staleness warning.';
comment on column public.record_relief_rules.researched_by is
  'Opaque identifier (never a raw name) of who drafted/researched this rule version. Null for TEST fixtures.';
comment on column public.record_relief_rules.reviewed_by is
  'Opaque identifier of who verified this rule version before it reached status=verified. A rule should never move to verified with this null in production data (enforced by process/Admin UI later, not a DB constraint here, to avoid retroactively breaking the existing TEST fixtures).';
comment on column public.record_relief_rules.staff_notes is
  'Internal-only working notes (source excerpts, open questions, ambiguities). Never shown to members — member-facing text belongs in `summary` only. No client code should ever select this column into a member-visible response.';
