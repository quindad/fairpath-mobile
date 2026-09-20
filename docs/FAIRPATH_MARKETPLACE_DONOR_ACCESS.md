# FairPath Marketplace — Donor Access + Pickup Pass Plan

Last updated: 2026-09-20

## User requirement preserved
The original donor convenience concept is:
- donor can list a free item with a phone number,
- donor receives a short one-time code,
- target UX is a **4-digit code**,
- donor should not need a heavy Partner onboarding flow just to give away an item.

## Current implementation
Marketplace donor/listing actions currently use the signed-in FairPath account session. This is production-safe and lets the RLS/RPC ownership rules work now.

Do **not** fake a 4-digit phone code in the React client. A client-generated or locally checked code would provide no real identity proof.

## Why the exact 4-digit flow is separate
Hosted Supabase phone OTP is designed around its Auth SMS provider flow and normally uses a 6-digit OTP. The exact 4-digit UX therefore needs either:
1. a custom SMS challenge/session layer, or
2. a product decision to use the native Supabase phone OTP length instead.

## Option A — preserve exact 4 digits
Recommended only if the 4-digit requirement is important enough to justify a custom donor-auth lane.

Architecture:
1. Donor enters E.164 phone number.
2. Server/Edge Function rate-limits by phone/IP/device.
3. Server generates a cryptographically random 4-digit challenge.
4. Store only a salted hash, expiration, attempts remaining, and resend cooldown.
5. SMS provider delivers the code.
6. Verify only on the server.
7. After success, issue a short-lived donor access session/token.
8. Donor-only Marketplace write actions run through protected server endpoints that validate the donor token.
9. Upgrade/link the donor identity to a full FairPath account when the donor wants saved history, organization inventory, or other FairPath products.

Minimum controls:
- 5-minute expiration.
- resend cooldown.
- max verification attempts.
- per-phone + per-IP rate limits.
- lockout/backoff.
- never log plaintext codes.
- never store plaintext codes.
- rotate/revoke donor token after pickup/listing ownership changes.
- abuse monitoring.

## Option B — phone-first Supabase Auth
Use Supabase native phone OTP and accept its normal OTP format instead of requiring four digits.

Advantages:
- simpler,
- creates a real FairPath auth session,
- existing RLS works with no second identity system,
- less custom security surface,
- easier account linking/recovery.

Tradeoff:
- not the exact 4-digit UX.

## Recommendation for the five-week launch
Keep normal FairPath authentication for Marketplace donor writes in the launch candidate. Build the exact donor-phone shortcut only after the SMS provider and session design are chosen. It should improve donor convenience without weakening ownership/security.

## Pickup QR path
The Marketplace handoff already has the important secure contract:
- claim ID,
- approved/ready status,
- private pickup receipt,
- server-generated pickup code,
- donor-side verification RPC.

A QR pass should be a thin visual wrapper around that same contract:
1. Claimant app renders a QR containing an opaque pickup-pass payload.
2. Donor app scans it.
3. Donor client sends the claim/pass to the existing verification backend.
4. Backend validates seller ownership, claim status, and pass/code.
5. Same PICKED UP / CLAIMED transition occurs.

Do not create a second QR-only pickup lifecycle. Manual pickup-code entry remains the fallback.
