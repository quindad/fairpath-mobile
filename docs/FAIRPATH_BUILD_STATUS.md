# FairPath Mobile — Build Status

Last updated: 2026-09-19

## Source of truth
This file is the handoff checkpoint for FairPath Mobile. Before starting a new build chat, read this file and the latest commits on `main`.

## Current lane
**Mobile → Housing**

Do not restart Jobs. Do not jump into FairPath Partner/Admin unless the mobile flow requires a small supporting model.

## Completed / verified on main
- Public Find Housing browse flow
- Dedicated Housing Filters screen
- Housing Filters remain public for guest browsing
- Housing detail screen
- Saved-home behavior wired to `saved_housing`
- Housing application lifecycle foundation wired to `housing_applications`
- FastTrack-aware application start state
- Swipeable multi-photo housing gallery
- Thumbnail controls for the main gallery photo
- Demo housing galleries used only when a listing has no real housing media
- Housing feed/detail already consume `housing_media` ordered by `sort_order`

Recent checkpoint commits:
- `7906e7e7` Keep housing filters public for guest browsing
- `8d97ce28` Make housing gallery thumbnails control main photo
- `8528673d` Add swipeable multi-photo housing gallery
- `52f38731` Connect dedicated filters to Find Housing
- `9bf364d5` Add dedicated housing filters screen
- `674eb34f` Add multi-photo demo galleries for housing
- `95284e8f` Rebuild housing detail with honest save and application states
- `3abdabb7` Rebuild Find Housing as premium public browse flow

## Important correction from chat recovery
The repository is authoritative. The current repo does **not** yet contain separate mobile screens for Saved Homes, My Housing Applications, or a full FastTrack readiness workspace. Those were discussed/planned, but should not be treated as completed until code exists on `main`.

## Completed in advanced Housing pass
- Bedrooms expanded to Studio / 1+ / 2+ / 3+ / 4+ / 5+ while preserving exact bedroom counts (including 8+ bedroom homes)
- Bathrooms expanded through 4+ with half-bath thresholds
- Property types expanded to apartment, townhome, house, duplex, condo, room
- Advanced Home filters: minimum square feet, garage, off-street parking, furnished, basement, yard/outdoor space, balcony/patio, laundry, central air, move-in ready
- Verified Walk Score threshold support added to filtering
- Supabase housing schema expanded for garage, parking types, home features, pet types, move-in state, Walk/Transit/Bike scores and provider freshness timestamps
- Housing detail now exposes real home features and verified mobility score surfaces when data exists
- No fake FairPath neighborhood score: neighborhood dimensions remain source-backed and separate
- Walk Score integration target confirmed for Walk / Transit / Bike data
- GreatSchools NearbySchools integration target confirmed for nearby K-12 school data; API key/provider setup still required before live school cards can ship

## Next build
### Property-owner photo system
This belongs primarily in **FairPath Partner** later, because owners/landlords manage listings there. Mobile should consume the resulting media cleanly.

Backend/data contract to preserve:
- `housing_media`
- up to 20 photos per listing
- stable `sort_order`
- cover photo = first ordered photo
- replace/delete/reorder support
- gallery order must drive both Find Housing card cover and Housing Detail gallery

### Mobile work immediately after media contract
1. Saved Homes screen
2. My Housing Applications screen
3. Housing application detail/workspace
4. FastTrack readiness checklist and honest locked/unlocked states
5. Wire Me screen links into those housing destinations
6. Continue Housing polish and error/empty/loading states

## Build principles
- Never fake live coverage, approval, submission, payment, eligibility, or protection.
- Guest browsing stays public where intended.
- Auth is requested only for actions that require an account.
- FairPath Mobile = user-facing experience.
- FairPath Partner = employer/property-owner operations.
- FairPath Admin = FairPath staff controls.
- FairPath Core = shared rules/models/services.
- Keep UI premium, dark, sharp, and consistent with FairPath lime `#A8F32C`.

## Git workflow
ChatGPT changes `main` only after inspecting current code and avoiding stale overwrites.
User workflow after a pushed build:
1. GitHub Desktop → **Fetch origin**
2. **Pull origin**
3. Expo → reload (`r`)
4. Test the exact flow requested
5. Report screenshots/errors; continue from this file + latest commit

## Architecture parked for later
Protection + Incentives remains documented in `docs/FAIRPATH_PROTECTION_AND_INCENTIVES_BLUEPRINT.md`. Keep it in the architecture, but do not let it interrupt the current Mobile → Housing lane.
