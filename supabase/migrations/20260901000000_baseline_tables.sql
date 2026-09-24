-- BASELINE (DEV BOOTSTRAP ONLY): FairPath production table structure.
--
-- Generated from a read-only export of the production 'fairpath-mobile'
-- project's public schema (36 tables, 440 columns) by
-- supabase/baseline/generate-baseline-tables.mjs. DO NOT hand-edit —
-- regenerate instead.
--
-- Contains ONLY: table + column definitions, types, NOT NULL, defaults.
-- Primary/foreign/unique/check constraints, indexes, RLS, policies,
-- functions, triggers, grants, storage buckets and cron come from the
-- production definitions export via
-- supabase/migrations/20260901000100_baseline_constraints_security_logic.sql.
--
-- SAFETY GUARD: this migration REFUSES to run if public.profiles already
-- exists. Production has public.profiles, so this file can never be applied
-- to production (or to any already-bootstrapped database) — it can only
-- bootstrap an EMPTY database such as fairpath-mobile-dev.
--
-- Never mark this migration as applied on production (no 'migration repair'
-- against production).

do $$
begin
  if to_regclass('public.profiles') is not null then
    raise exception 'BASELINE REFUSED: public.profiles already exists. This baseline only bootstraps an empty database (fairpath-mobile-dev). It must never run against production.';
  end if;
end $$;

create table public."app_config" (
  "key" text not null,
  "value" jsonb not null,
  "updated_at" timestamptz default now() not null
);

create table public."external_opportunities" (
  "id" uuid default gen_random_uuid() not null,
  "source_id" uuid not null,
  "kind" text not null,
  "external_id" text not null,
  "canonical_url" text,
  "raw_payload" jsonb default '{}'::jsonb not null,
  "normalized_payload" jsonb default '{}'::jsonb not null,
  "content_hash" text,
  "first_seen_at" timestamptz default now() not null,
  "last_seen_at" timestamptz default now() not null,
  "expires_at" timestamptz,
  "active" boolean default true not null
);

create table public."fairpath_subscriptions" (
  "user_id" uuid not null,
  "plan" text not null,
  "status" text not null,
  "current_period_end" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."housing_application_documents" (
  "id" uuid default gen_random_uuid() not null,
  "application_id" uuid not null,
  "user_id" uuid not null,
  "document_type" text not null,
  "file_name" text not null,
  "storage_path" text not null,
  "mime_type" text,
  "size_bytes" bigint,
  "status" text default 'uploaded'::text not null,
  "rejection_reason" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."housing_application_events" (
  "id" uuid default gen_random_uuid() not null,
  "application_id" uuid not null,
  "actor_user_id" uuid,
  "event_type" text not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamptz default now() not null
);

create table public."housing_applications" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "listing_id" uuid not null,
  "application_type" text default 'standard'::text not null,
  "status" text default 'started'::text not null,
  "answers" jsonb default '{}'::jsonb not null,
  "submitted_at" timestamptz,
  "updated_at" timestamptz default now() not null,
  "current_step" integer default 1 not null,
  "applicant_snapshot" jsonb default '{}'::jsonb not null,
  "consent_snapshot" jsonb default '{}'::jsonb not null,
  "partner_note" text,
  "status_reason" text
);

create table public."housing_fasttrack_orders" (
  "id" uuid default gen_random_uuid() not null,
  "application_id" uuid not null,
  "user_id" uuid not null,
  "currency" text default 'usd'::text not null,
  "base_amount_cents" integer default 7500 not null,
  "discount_cents" integer default 0 not null,
  "amount_due_cents" integer not null,
  "status" text default 'requires_payment'::text not null,
  "provider" text,
  "provider_payment_id" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."housing_inquiries" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "listing_id" uuid not null,
  "subject" text default 'Question about this home'::text not null,
  "message" text not null,
  "status" text default 'open'::text not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "response_message" text,
  "responded_at" timestamptz
);

create table public."housing_listings" (
  "id" uuid default gen_random_uuid() not null,
  "owner_id" uuid not null,
  "title" text not null,
  "description" text default ''::text not null,
  "property_type" text default 'apartment'::text not null,
  "address_line1" text,
  "address_line2" text,
  "city" text not null,
  "state" text not null,
  "postal_code" text,
  "latitude" double precision,
  "longitude" double precision,
  "bedrooms" numeric,
  "bathrooms" numeric,
  "square_feet" integer,
  "rent_monthly" numeric not null,
  "deposit_amount" numeric,
  "application_fee" numeric,
  "available_date" date,
  "lease_terms" text[],
  "amenities" text[],
  "utilities_included" text[],
  "pet_policy" text,
  "parking" text,
  "accessibility_features" text[],
  "screening_summary" text,
  "eligibility_rules" jsonb default '{}'::jsonb not null,
  "virtual_tour_url" text,
  "tour_provider" text,
  "floor_plan_url" text,
  "video_url" text,
  "fasttrack_enabled" boolean default false not null,
  "status" text default 'draft'::text not null,
  "featured" boolean default false not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "source_id" uuid,
  "external_opportunity_id" uuid,
  "source_label" text default 'FairPath'::text not null,
  "source_url" text,
  "garage_spaces" integer,
  "parking_types" text[] default '{}'::text[] not null,
  "furnished" boolean default false not null,
  "has_basement" boolean default false not null,
  "has_yard" boolean default false not null,
  "has_balcony_patio" boolean default false not null,
  "laundry_type" text,
  "has_central_air" boolean default false not null,
  "pet_types" text[] default '{}'::text[] not null,
  "move_in_ready" boolean default false not null,
  "walk_score" integer,
  "transit_score" integer,
  "bike_score" integer,
  "neighborhood_data_updated_at" timestamptz,
  "school_data_provider" text,
  "school_data_updated_at" timestamptz,
  "neighborhood_data_provider" text,
  "required_application_documents" text[] default '{}'::text[] not null
);

create table public."housing_media" (
  "id" uuid default gen_random_uuid() not null,
  "listing_id" uuid not null,
  "media_type" text not null,
  "url" text not null,
  "sort_order" integer default 0 not null,
  "caption" text
);

create table public."housing_nearby_places" (
  "id" uuid default gen_random_uuid() not null,
  "listing_id" uuid not null,
  "provider" text not null,
  "provider_place_id" text not null,
  "category" text not null,
  "name" text not null,
  "distance_miles" numeric,
  "sort_order" integer default 0 not null,
  "data_updated_at" timestamptz default now() not null
);

create table public."housing_reports" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "listing_id" uuid not null,
  "reason" text not null,
  "details" text,
  "status" text default 'open'::text not null,
  "created_at" timestamptz default now() not null
);

create table public."housing_schools" (
  "id" uuid default gen_random_uuid() not null,
  "listing_id" uuid not null,
  "provider" text not null,
  "provider_school_id" text not null,
  "name" text not null,
  "school_type" text,
  "grades" text,
  "distance_miles" numeric,
  "quality_label" text,
  "profile_url" text,
  "sort_order" integer default 0 not null,
  "data_updated_at" timestamptz default now() not null
);

create table public."housing_tour_requests" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "listing_id" uuid not null,
  "preferred_date" date not null,
  "preferred_window" text not null,
  "note" text,
  "status" text default 'requested'::text not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "confirmed_date" date,
  "confirmed_window" text,
  "partner_note" text
);

create table public."job_applications" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "job_id" uuid not null,
  "status" text default 'started'::text not null,
  "answers" jsonb default '{}'::jsonb not null,
  "submitted_at" timestamptz,
  "updated_at" timestamptz default now() not null
);

create table public."jobs" (
  "id" uuid default gen_random_uuid() not null,
  "employer_id" uuid not null,
  "title" text not null,
  "company_name" text not null,
  "description" text default ''::text not null,
  "location_text" text,
  "workplace_type" text default 'onsite'::text not null,
  "employment_type" text default 'full_time'::text not null,
  "pay_min" numeric,
  "pay_max" numeric,
  "pay_period" text,
  "currency" text default 'USD'::text not null,
  "schedule" text[],
  "benefits" text[],
  "skills" text[],
  "requirements" text[],
  "education_requirement" text,
  "experience_level" text,
  "background_policy_summary" text,
  "eligibility_rules" jsonb default '{}'::jsonb not null,
  "application_method" text default 'fairpath'::text not null,
  "external_apply_url" text,
  "status" text default 'draft'::text not null,
  "featured" boolean default false not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "source_id" uuid,
  "external_opportunity_id" uuid,
  "source_label" text default 'FairPath'::text not null,
  "source_url" text,
  "city" text,
  "state" text,
  "postal_code" text,
  "latitude" double precision,
  "longitude" double precision,
  "location_precision" text,
  "easy_apply_enabled" boolean default false not null,
  "application_questions" jsonb default '[]'::jsonb not null,
  "company_website_url" text,
  "published_at" timestamptz,
  "expires_at" timestamptz,
  "closed_at" timestamptz
);

create table public."marketplace_claim_events" (
  "id" uuid default gen_random_uuid() not null,
  "claim_id" uuid not null,
  "actor_user_id" uuid,
  "event_type" text not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamptz default now() not null
);

create table public."marketplace_claims" (
  "id" uuid default gen_random_uuid() not null,
  "item_id" uuid not null,
  "claimant_id" uuid not null,
  "status" text default 'requested'::text not null,
  "pickup_deadline" timestamptz,
  "pickup_code" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "counts_toward_quota" boolean default true not null,
  "approved_at" timestamptz,
  "ready_at" timestamptz,
  "completed_at" timestamptz,
  "cancelled_at" timestamptz,
  "declined_at" timestamptz,
  "no_show_at" timestamptz
);

create table public."marketplace_items" (
  "id" uuid default gen_random_uuid() not null,
  "seller_id" uuid not null,
  "title" text not null,
  "description" text default ''::text not null,
  "category" text default 'other'::text not null,
  "condition" text,
  "price" numeric default 0 not null,
  "is_free" boolean default true not null,
  "city" text not null,
  "state" text not null,
  "pickup_notes" text,
  "safe_pickup" boolean default true not null,
  "status" text default 'available'::text not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "latitude" double precision,
  "longitude" double precision,
  "postal_code" text,
  "quantity" integer default 1 not null,
  "featured" boolean default false not null,
  "seller_type" text default 'individual'::text not null,
  "pickup_area" text,
  "moderation_status" text default 'approved'::text not null,
  "listed_at" timestamptz,
  "claimed_at" timestamptz,
  "removed_at" timestamptz
);

create table public."marketplace_media" (
  "id" uuid default gen_random_uuid() not null,
  "item_id" uuid not null,
  "url" text not null,
  "sort_order" integer default 0 not null,
  "storage_path" text,
  "mime_type" text
);

create table public."marketplace_messages" (
  "id" uuid default gen_random_uuid() not null,
  "claim_id" uuid not null,
  "sender_id" uuid not null,
  "body" text not null,
  "created_at" timestamptz default now() not null
);

create table public."marketplace_pickup_details" (
  "item_id" uuid not null,
  "seller_id" uuid not null,
  "location_name" text,
  "address_line1" text,
  "address_line2" text,
  "city" text not null,
  "state" text not null,
  "postal_code" text,
  "instructions" text,
  "contact_phone" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."marketplace_reports" (
  "id" uuid default gen_random_uuid() not null,
  "item_id" uuid not null,
  "reporter_id" uuid not null,
  "reason" text not null,
  "details" text,
  "status" text default 'open'::text not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."marketplace_saves" (
  "user_id" uuid not null,
  "item_id" uuid not null,
  "created_at" timestamptz default now() not null
);

create table public."offense_catalog" (
  "id" uuid default gen_random_uuid() not null,
  "jurisdiction_type" text default 'state'::text not null,
  "state_code" text,
  "jurisdiction_name" text not null,
  "offense_code" text not null,
  "offense_title" text not null,
  "offense_level" text,
  "offense_degree" text,
  "offense_class" text,
  "offense_category" text,
  "description" text,
  "source_agency" text,
  "source_url" text not null,
  "effective_start" date,
  "effective_end" date,
  "active" boolean default true not null,
  "aliases" text[] default '{}'::text[] not null,
  "search_terms" text[] default '{}'::text[] not null,
  "last_verified_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."opportunity_evidence" (
  "id" uuid default gen_random_uuid() not null,
  "external_opportunity_id" uuid,
  "local_job_id" uuid,
  "local_housing_id" uuid,
  "evidence_type" text not null,
  "evidence_text" text,
  "evidence_source" text not null,
  "confidence" numeric,
  "machine_extracted" boolean default false not null,
  "reviewed_at" timestamptz,
  "created_at" timestamptz default now() not null
);

create table public."opportunity_ingestion_runs" (
  "id" uuid default gen_random_uuid() not null,
  "source_id" uuid not null,
  "status" text not null,
  "fetched_count" integer default 0 not null,
  "created_count" integer default 0 not null,
  "updated_count" integer default 0 not null,
  "error_count" integer default 0 not null,
  "error_summary" text,
  "started_at" timestamptz default now() not null,
  "finished_at" timestamptz
);

create table public."opportunity_sources" (
  "id" uuid default gen_random_uuid() not null,
  "kind" text not null,
  "provider_key" text not null,
  "display_name" text not null,
  "status" text default 'planned'::text not null,
  "ingestion_mode" text not null,
  "terms_url" text,
  "attribution_required" boolean default false not null,
  "ai_processing_allowed" boolean default false not null,
  "configuration" jsonb default '{}'::jsonb not null,
  "last_sync_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."product_events" (
  "id" bigint generated by default as identity not null,
  "user_id" uuid,
  "event_name" text not null,
  "surface" text not null,
  "entity_id" text,
  "properties" jsonb default '{}'::jsonb not null,
  "created_at" timestamptz default now() not null
);

create table public."profile_answers" (
  "user_id" uuid not null,
  "question_id" text not null,
  "answer" jsonb not null,
  "source" text default 'user'::text not null,
  "verification_state" text default 'self_reported'::text not null,
  "updated_at" timestamptz default now() not null
);

create table public."profiles" (
  "id" uuid not null,
  "first_name" text,
  "last_name" text,
  "account_type" text default 'member'::text not null,
  "onboarding_completed" boolean default false not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "goals" text[] default '{}'::text[] not null,
  "location_text" text,
  "justice_impacted" text,
  "opportunity_priorities" text[] default '{}'::text[] not null,
  "work_preferences" text[] default '{}'::text[] not null,
  "housing_preferences" text[] default '{}'::text[] not null,
  "ai_preferences" text[] default '{}'::text[] not null,
  "onboarding_completed_at" timestamptz
);

create table public."saved_housing" (
  "user_id" uuid not null,
  "listing_id" uuid not null,
  "created_at" timestamptz default now() not null
);

create table public."saved_housing_searches" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "name" text default 'Housing search'::text not null,
  "query" text default ''::text not null,
  "location" text default ''::text not null,
  "filters" jsonb default '{}'::jsonb not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."saved_jobs" (
  "user_id" uuid not null,
  "job_id" uuid not null,
  "created_at" timestamptz default now() not null
);

create table public."user_convictions" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "offense_catalog_id" uuid,
  "jurisdiction_type" text default 'state'::text not null,
  "state_code" text,
  "county" text,
  "court_name" text,
  "case_number" text,
  "offense_code" text,
  "offense_title" text not null,
  "offense_level" text,
  "offense_degree" text,
  "offense_class" text,
  "disposition" text,
  "conviction_date" date,
  "sentence_date" date,
  "sentence_summary" text,
  "release_date" date,
  "supervision_status" text,
  "source_type" text default 'self_reported'::text not null,
  "verification_state" text default 'self_reported'::text not null,
  "source_reference" text,
  "share_with_employers" boolean default false not null,
  "user_notes" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create table public."user_notifications" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "category" text not null,
  "title" text not null,
  "body" text not null,
  "route" text,
  "metadata" jsonb default '{}'::jsonb not null,
  "read_at" timestamptz,
  "created_at" timestamptz default now() not null
);
