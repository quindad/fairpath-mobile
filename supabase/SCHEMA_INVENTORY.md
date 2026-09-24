# Schema inventory (reconstructed from client code — NOT a verified schema dump)

**Status: blocked.** This environment has no Supabase CLI, no project login, and no
credentials beyond the client's public anon/publishable key, which cannot read
schema, RLS, or RPC bodies. A real baseline migration must come from
`supabase db pull` (or a manual `pg_dump`/dashboard export) run by someone with
project credentials — see `supabase/README.md`.

What follows is **not** that. It's every table, RPC, and storage bucket the
mobile client currently assumes exists, gathered by reading `src/` directly, so
the person who does have DB access has a checklist to reconcile against the
live project rather than starting from nothing. Column lists reflect what the
client selects/inserts — the live table may have more columns, different
nullability, different defaults, or different constraints than shown here.
Nothing below should be treated as authoritative until reconciled against
`supabase db pull` output.

## Tables

- **profiles** — id, first_name, last_name, location_text, justice_impacted, work_preferences, housing_preferences, ai_preferences, goals, opportunity_priorities, onboarding_completed, onboarding_completed_at, updated_at
- **profile_answers** — user_id, question_id, answer (jsonb), source, verification_state, updated_at — client upserts on `(user_id, question_id)`
- **offense_catalog** — id, jurisdiction_type, state_code, jurisdiction_name, offense_code, offense_title, offense_level, offense_degree, offense_class, offense_category, description, source_agency, source_url, effective_start, effective_end, active, aliases, search_terms, last_verified_at
- **user_convictions** — id, user_id, offense_catalog_id, jurisdiction_type, state_code, county, court_name, case_number, offense_code, offense_title, offense_level, offense_degree, offense_class, disposition, conviction_date, sentence_date, sentence_summary, release_date, supervision_status, source_type, verification_state, source_reference, share_with_employers, user_notes, created_at, updated_at — *service exists (`core/profile/conviction-service.ts`) but has zero callers in the app today*
- **jobs** — id, title, company_name, description, location_text, city, state, postal_code, workplace_type, employment_type, pay_min, pay_max, pay_period, benefits, skills, requirements, background_policy_summary, eligibility_rules (jsonb), application_method, external_apply_url, company_website_url, source_label, source_url, featured, created_at, status, published_at, expires_at, closed_at, latitude, longitude, location_precision, easy_apply_enabled, application_questions (jsonb)
- **saved_jobs** — user_id, job_id, created_at — unique on (user_id, job_id)
- **job_applications** — id, user_id, job_id, status, answers (jsonb), submitted_at, updated_at — unique on (user_id, job_id); client inserts directly, no RPC (see Foundation report)
- **housing_listings** — id, title, description, property_type, address_line1, address_line2, city, state, postal_code, created_at, bedrooms, bathrooms, square_feet, rent_monthly, deposit_amount, application_fee, available_date, lease_terms, amenities, utilities_included, pet_policy, parking, accessibility_features, screening_summary, eligibility_rules (jsonb), virtual_tour_url, floor_plan_url, video_url, fasttrack_enabled, required_application_documents, featured, source_label, source_url, latitude, longitude, garage_spaces, parking_types, furnished, has_basement, has_yard, has_balcony_patio, laundry_type, has_central_air, pet_types, move_in_ready, walk_score, transit_score, bike_score, neighborhood_data_provider, status
- **housing_media** — listing_id, url, media_type, sort_order
- **housing_schools** — listing_id, provider, provider_school_id, name, school_type, grades, distance_miles, quality_label, profile_url, sort_order
- **housing_nearby_places** — listing_id, provider, provider_place_id, category, name, distance_miles, sort_order
- **saved_housing** — user_id, listing_id, created_at — unique on (user_id, listing_id)
- **saved_housing_searches** — id, user_id, name, query, location, filters (jsonb), created_at, updated_at
- **housing_tour_requests** — id, user_id, listing_id, preferred_date, preferred_window, note, status, confirmed_date, confirmed_window, partner_note, created_at, updated_at
- **housing_inquiries** — id, user_id, listing_id, subject, message, status, response_message, responded_at, created_at, updated_at
- **housing_reports** — id, user_id, listing_id, reason, details, status, created_at
- **housing_applications** — id, user_id, listing_id, application_type, status, current_step, answers (jsonb), submitted_at, updated_at
- **housing_application_events** — id, application_id, event_type, metadata (jsonb), created_at
- **housing_application_documents** — id, application_id, user_id, document_type, file_name, storage_path, mime_type, size_bytes, status, rejection_reason, created_at, updated_at
- **housing_fasttrack_orders** — referenced only via the `quote_housing_fasttrack` RPC return shape (order_id, base_amount_cents, discount_cents, amount_due_cents, status, payment_enforced); client never queries the table directly
- **app_config** — referenced in docs only (`fasttrack_payment_enforced`); client never reads/writes it directly
- **user_notifications** — id, user_id, category, title, body, route, metadata (jsonb), read_at, created_at
- **product_events** — id, user_id, event_name, surface, entity_id, properties (jsonb), created_at — client-inserted analytics, not an audit log
- **marketplace_items**, **marketplace_media**, **marketplace_saves**, **marketplace_claims**, **marketplace_claim_events**, **marketplace_pickup_details**, **marketplace_messages**, **marketplace_reports** — full column lists not reproduced here; see `src/core/marketplace/marketplace-service.ts`, which is already a single well-scoped file and was left untouched by this pass

## RPCs referenced by the client

`submit_housing_application`, `quote_housing_fasttrack`, `approve_marketplace_claim`, `cancel_marketplace_claim`, `decline_marketplace_claim`, `expire_marketplace_pickups`, `mark_marketplace_claim_ready`, `mark_marketplace_no_show`, `marketplace_claim_candidates`, `marketplace_claim_quota`, `marketplace_claim_receipt`, `remove_marketplace_item`, `request_marketplace_claim`, `send_marketplace_pickup_message`, `set_marketplace_item_availability`, `verify_marketplace_pickup`

## Storage buckets referenced by the client

`housing-application-documents` (private, path-scoped by user id), `marketplace-media`

## New in this pass

- **feature_flags** — added fresh in `supabase/migrations/20260924_0001_feature_flags.sql`. This one *is* real, owned DDL (not reconstructed) since it didn't exist before.
