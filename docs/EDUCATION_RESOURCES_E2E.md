# Education & resources member loop (Tasks 109–113)

**Automated:** `npm run test:education`, `npm run test:resources`, `npm run test:sql:resources`.

## 109 — Academy catalog

1. `/academy` banner states national programs live in **Resources**; below catalog is **development fixtures**.
2. Search + cost filters; each card shows cost class honestly (`free_with_paid_certificate` ≠ fully free).
3. **Go to course** opens external URL (`Linking.openURL`).

## 110 — No fake in-app credentials

1. `/academy/[id]` explains FairPath links out — no local certificate theater.
2. Real provider catalogs (Coursera/Udemy) blocked until partnership — banner copy.

## 111 — Resources discovery

1. `/resources` guest or signed in → `search_resources` (verified + published + fresh only).
2. Failed fresh search clears stale rows (same pattern as jobs/housing).
3. Explore → **Resources** and **Academy** both `live`.

## 112 — Resource detail

1. `/resource/{id}` → `get_resource_detail`; freshness, cost, hours, external links via safe URL helper.
2. Save / progress / report via RPCs (see `test:resources` member-state migration).
3. Manual accuracy pass: **042** on DEV data.

## 113 — Saved resources

1. `/saved-resources` lists `list_my_saved_resources` rows; tap back to detail.

## Signal (optional)

`academy-lesson-question` Edge function when in-app lesson UI returns — today primary path is external enrollment.
