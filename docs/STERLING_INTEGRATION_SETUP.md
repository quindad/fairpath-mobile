# Sterling integration setup — one at a time, in priority order

Full context for each is in `docs/EXTERNAL_INTEGRATION_REGISTER.md`. This doc is just the "what do I click" guide.
Never paste a secret value into chat — I'll tell you exactly which file/dashboard field it belongs in.

## Priority 1 — Stripe (unblocks FairPath+ checkout)
1. **Provider:** Stripe.
2. **Account:** stripe.com — sign up if you don't have one; use test mode, no business verification needed yet.
3. **Account type:** standard Stripe account, stay in **Test mode** (toggle top-right of the dashboard).
4. **Enable:** nothing to enable — test mode is on by default for a new account.
5. **Credential needed:** your **test-mode publishable key** (starts `pk_test_...`), from Developers → API keys.
6. **Where it belongs:** a local `.env` file at the repo root (never committed) as
   `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`. Tell me once it's there — I'll confirm `.env` is gitignored
   before we go further, then restart the dev server to pick it up.
7. **Do NOT paste:** the key itself, or your **secret key** (starts `sk_test_...`) — that one never goes client-side
   at all.
8. **Cost:** free to create; Stripe only charges a fee on a completed transaction, and test mode never charges real
   money.
9. **How we verify:** I'll drive a test checkout in the Browser pane using Stripe's published test card number
   (4242 4242 4242 4242) and confirm PaymentSheet initializes and a test PaymentIntent succeeds.
10. **DEV vs PROD:** yes, separate keys — test-mode key for DEV now, live-mode key only once you're ready to charge
    real cards.

## Priority 2 — Confirm Google Sign-In in Supabase (may already be done)
1. **Provider:** Google Cloud OAuth + Supabase Auth.
2. **Account:** Supabase dashboard, project `znvhmuhojvwvjzmaqwff` → Authentication → Providers → Google.
3. **Check first:** open that page and tell me whether Google shows as **Enabled** already. If it is, send me a
   screenshot or just say "enabled" — no further action needed, I'll verify it live.
4. **If not enabled:** you'll need a Google Cloud project with an OAuth 2.0 Client ID (console.cloud.google.com →
   APIs & Services → Credentials → Create OAuth client ID → Web application). The **Authorized redirect URI** goes
   to your Supabase project's callback URL, shown on that same Supabase provider page.
5. **Credential needed:** Google OAuth **Client ID** and **Client Secret**.
6. **Where it belongs:** directly into the Supabase dashboard's Google provider fields — never into this repo, this
   one lives entirely server-side in Supabase.
7. **Do NOT paste:** the client secret into chat.
8. **Cost:** free.
9. **How we verify:** I'll drive a real Google sign-in in the Browser pane once you confirm it's enabled.
10. **DEV vs PROD:** yes eventually — a separate OAuth client for production once you move past Google's "Testing"
    publish status (which limits sign-in to accounts you've explicitly added as test users).

## Priority 3 — Walk Score API (real neighborhood data for Housing)
1. **Provider:** Walk Score (walkscore.com/professional/api).
2. **Account:** their API signup page — this one is an application, not instant.
3. **Account type:** individual/developer application is fine to start; mention it's for an app in development.
4. **Enable:** nothing to toggle — approval issues the key directly.
5. **Credential needed:** a Walk Score API key.
6. **Where it belongs:** Supabase Edge Function secret (server-side call, not client) — I'll tell you the exact
   `supabase secrets set` command once we're building the feature; no rush to get this key before then.
7. **Do NOT paste:** the key into chat once issued.
8. **Cost:** free at low volume; ask about commercial pricing in the application if they ask your expected volume.
9. **How we verify:** I'll call it server-side for a known test address and confirm a real score comes back before
   wiring it into any UI.
10. **DEV vs PROD:** one key is fine for both while volume is low; separate later if needed.

## Priority 4 — Google Maps Platform key (Android map pins)
1. **Provider:** Google Maps Platform.
2. **Account:** console.cloud.google.com (can reuse the same Google Cloud project as priority 2 if you did that
   first, or a fresh one).
3. **Account type:** standard Google Cloud project; billing must be enabled on the project to issue Maps keys even
   though usage will stay inside the free $200/month credit.
4. **Enable:** "Maps SDK for Android" specifically (APIs & Services → Library → search "Maps SDK for Android" →
   Enable).
5. **Credential needed:** an API key, restricted to Android apps + this project's Android package name.
6. **Where it belongs:** `app.json` under `android.config.googleMaps.apiKey` — I'll make that edit myself once you
   give me the key value here in chat is fine for this one specifically since it's a public, restricted client key
   (not a secret), but tell me if you'd rather I read it from an env var instead.
7. **Cost:** free under the $200/month credit at any realistic DEV volume.
8. **How we verify:** requires a native Android build (not testable in the Browser pane or Expo Go) — this one
   waits for the physical-device QA pass already queued.
9. **DEV vs PROD:** can share one key restricted to both package name variants, or split later.

## Priority 5 — Apple Sign-In (unchanged, still queued)
See `EXTERNAL_SETUP_CHECKLIST.md` section 2 for the existing full walkthrough — Apple Developer capability →
Supabase Apple provider → dev-client rebuild → physical-device test. Not repeated here since it hasn't changed.

---
Send me which one you want to start with, or just say "go" and I'll walk you through priority 1 first.
