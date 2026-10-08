# FairPath Record Relief — Browser QA and Release Gates
Date: 2026-10-07
Repository: fairpath-mobile
Branch: development/mobile-v1-completion
Environment: DEV only (Supabase project znvhmuhojvwvjzmaqwff). NEVER modify production.

## Instructions for Claude
Use the local Expo web development server and browser to perform REAL tests, not a code-only review. Start with `npx expo start --web --localhost` in this repository if not already running. Inspect actual rendered pages and interactions. Do not invent passes or screenshots. Never use real member case files or real user credentials. Use a dedicated synthetic DEV test identity and synthetic court documents only, if available. If not available, mark authenticated cases BLOCKED and describe precisely what is needed. Do not bypass authentication, row-level security, or consent. Do not change production, push commits, run migrations, or modify unrelated files without approval.

## Browser test matrix — record each PASS / FAIL / BLOCKED with screenshot, console error, reproduction steps
1. Navigate to Record Relief home, add case, coverage, court finder, and case packet screens. Confirm routes and back navigation work on desktop and mobile viewport.
2. On /record-relief/scan-packet, verify consent switch is OFF by default. Clicking ADD FIRST DOCUMENT without consent must show an error and must NOT open file picker, upload, or extract.
3. With consent ON, select a synthetic PDF or image. Verify upload and case packet flow with a dedicated DEV test account. Confirm consent RPC `record_relief_record_consent` succeeds BEFORE `extract-record-relief-case`. If no test account, mark BLOCKED; never pretend it passed.
4. Verify failure of consent RPC prevents AI extraction. Test missing consent, unsupported file type, oversized file, and signed-out behavior. Report any orphaned uploaded files.
5. Verify extracted facts appear for review, low-confidence/conflicting facts are flagged, and no AI extraction silently becomes a verified legal conclusion.
6. Evaluate a synthetic Ohio case with missing/unknown felony classification: app must not promise eligibility. Verify links to official court sources, and distinguish possible sealing, expungement, pardon and other relief.
7. Check accessibility labels, keyboard controls, screen-reader text, mobile layout, loading/error states and no secret tokens or case content leaked to browser console.
8. Verify member A cannot access member B's cases, uploads, or evaluations through the app/API using two synthetic DEV accounts. If unavailable mark BLOCKED.

## Backend tests (not browser-only)
9. Run `npx tsc --noEmit --pretty false` and `node --test --experimental-strip-types tests/record-relief*.test.ts`; capture exact pass/fail totals.
10. DEV-only test upload expiration: create synthetic file and metadata, trigger authorized retention process, verify actual object is absent from storage AND metadata is scrubbed. Check error/retry behavior. Never test against real user data.
11. Confirm unauthenticated Edge Function calls fail, RLS enforces ownership, service-only RPC cannot be called by authenticated role, and monitoring does not auto-approve legal rule changes.
12. Independent primary-source legal review of all 57 jurisdictions is a separate human legal approval gate. Do NOT call nationwide rules legally approved based on browser or unit tests.

## Final deliverable
Create `docs/RECORD_RELIEF_QA_RESULTS.md` with environment, commit, test date, PASS/FAIL/BLOCKED matrix, screenshots paths, console/network evidence, exact bugs and reproduction, and release recommendation. No blanket 100% claim unless all release gates pass. Do not touch Juice's unrelated work.
