# External setup checklist (things only Sterling can do outside the codebase)

Everything below is DEV/test first. Never paste a secret key into source, `.env.local`, chat or a commit.
Secrets go into **Supabase Edge Function secrets** or **EAS secrets** only.

## 0. Before anything: confirm you are on DEV

```powershell
Get-Content supabase/.temp/project-ref        # must print znvhmuhojvwvjzmaqwff
```

## 1. Supabase

Migrations that must appear on `npx supabase db push` (in this order, DEV only):

1. `20260929100000_inquiry_status_and_notifications.sql`
2. `20260929120000_auth_profile_hardening.sql`
3. `20260930100000_entitlements.sql`
4. `20260930110000_payments.sql`

(Older ones — jobs, housing search, secure housing applications — should already be applied. If any is still
pending, `db push` lists it too; that is fine.)

Auth providers (Dashboard -> Authentication -> Providers):
- **Apple**: enable. "Client IDs" must include the app bundle id `com.fairpathfwd.fairpathmobile` (native sign-in).
- **Google**: enable, paste the Google **Web** OAuth client id + secret (section 3).
- Authentication -> URL Configuration -> **Redirect URLs**: add `fairpathmobile://auth/callback`.
- Account linking: leave Supabase's default (it only links identities with the same VERIFIED email). Do not enable
  anything that merges accounts on unverified email. FairPath code never merges accounts itself.
- Recommended: turn on "Leaked password protection" (Auth -> Policies) for email/password.

Edge Functions (deploy to DEV only; the project must be linked to DEV):

```powershell
npx supabase functions deploy create-fasttrack-payment
npx supabase functions deploy stripe-webhook
npx supabase functions deploy claim-correctional-transition
npx supabase functions deploy store-subscription-webhook     # intentionally returns 501 until store billing exists
```

Function secrets (Dashboard -> Edge Functions -> Secrets, or `npx supabase secrets set NAME=value` from your own
terminal so the value never enters a file):

| Secret | Used by | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | create-fasttrack-payment, stripe-webhook | `sk_test_...` in DEV |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | `whsec_...` from the Stripe endpoint (section 4) |
| `CORRECTIONS_INTEGRATION_SECRET` | claim-correctional-transition | long random string shared with the Corrections integration |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically.

Turning FastTrack payment enforcement on (only after Stripe DEV testing works end to end), in the DEV SQL editor:

```sql
update public.app_config set value = 'true'::jsonb where key = 'fasttrack_payment_enforced';
```

## 2. Apple

- Apple Developer -> Identifiers -> App ID `com.fairpathfwd.fairpathmobile`: enable **Sign in with Apple**.
  (The app already declares the capability; the next EAS build will provision it.)
- **Apple Pay** (optional until you want wallets): create a Merchant ID (for example
  `merchant.com.fairpathfwd.fairpathmobile`), attach it to the App ID, and add it to Stripe (Settings -> Payment
  methods -> Apple Pay -> add the merchant certificate).
  Then set EAS env `APPLE_MERCHANT_ID=<that id>` and `EXPO_PUBLIC_APPLE_MERCHANT_ID=<that id>` and rebuild. Do NOT set
  these before the merchant id exists: it would break the iOS build. Without them cards still work; Apple Pay just
  does not appear.
- **FairPath+ subscriptions (App Store)** — still required, not built: App Store Connect -> Agreements (Paid Apps),
  create the auto-renewable subscription (product id to put in `src/core/membership/plus-config.ts` as
  `appleProductId`), create an App Store Server API key, and configure App Store Server Notifications V2 to point at the
  `store-subscription-webhook` function once it is implemented.

## 3. Google

- Google Cloud Console -> APIs & Services -> OAuth consent screen (external, add app name + support email).
- Credentials -> **OAuth client ID, type Web application**. Authorized redirect URI:
  `https://znvhmuhojvwvjzmaqwff.supabase.co/auth/v1/callback`. Put the client id + secret into Supabase (section 1).
- **Google Pay** (optional): Google Pay & Wallet Console business profile + Stripe Google Pay enabled. Set EAS env
  `ENABLE_GOOGLE_PAY=true` and `EXPO_PUBLIC_GOOGLE_PAY_ENABLED=true`, then rebuild the Android client.
- **FairPath+ subscriptions (Google Play)** — still required, not built: Play Console -> Monetize -> Subscriptions
  (product id -> `googleProductId`), a service account with Play Developer API access, and Real-time developer
  notifications -> `store-subscription-webhook` once implemented.

## 4. Stripe (test mode)

1. Stripe Dashboard (test mode) -> Developers -> API keys: copy the **publishable** key `pk_test_...` into
   `.env.local` as `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (safe to ship). Copy the **secret** key `sk_test_...` ONLY into
   Supabase secrets (`STRIPE_SECRET_KEY`).
2. Developers -> Webhooks -> add endpoint `https://znvhmuhojvwvjzmaqwff.supabase.co/functions/v1/stripe-webhook`
   with events: `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.requires_action`,
   `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`. Copy the signing secret
   (`whsec_...`) into Supabase secrets as `STRIPE_WEBHOOK_SECRET`.
3. Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (declined). Any future expiry / any CVC.
   **DEV testing must never charge a real card.** Keep Stripe in test mode.
4. Rebuild the dev client (Stripe and Apple authentication are native modules):
   `eas build --profile development --platform ios`.
5. Refunds are done in the Stripe Dashboard; the `charge.refunded` webhook updates FairPath.

## 5. Corrections migration (business event)

The community app never decides eligibility. The trusted Corrections integration (or a future Admin tool) calls
`claim-correctional-transition` with header `x-fairpath-integration-secret` and JSON
`{ "user_id", "identity_key", "deployment", "verified_at" }` after it has verified the person's tablet profile.
`identity_key` must be an opaque one-way key of the verified Corrections identity (never a name or DOC number).
Each identity and each account can receive the 90-day benefit once. Until that integration exists you can test the
function manually from your own terminal with the secret in an environment variable.

## 6. Push notifications (still required, not built)

The notification records, `push_tokens` and the `notification_deliveries` queue exist. Sending needs: an Apple APNs
key (.p8) or Expo push setup, `expo-notifications` in the app (native rebuild), and a worker (Edge Function on a
schedule) that reads `notification_deliveries` where `status = 'pending'`. None of that exists yet and nothing in the
app pretends to send push.

## 7. Edge Function status on DEV (as probed with the public key)

All four functions return 404 on DEV: none is deployed. Deploy only to DEV by passing the ref explicitly, so a wrong
CLI link can never redirect it to production:

| Function | Purpose | Safe to deploy to DEV now? | Secrets needed |
| --- | --- | --- | --- |
| `store-subscription-webhook` | Refuses (501) until store verification exists | Yes, no secrets, inert | none |
| `claim-correctional-transition` | Trusted Corrections claim endpoint | Yes; refuses (501) until the secret is set | `CORRECTIONS_INTEGRATION_SECRET` |
| `create-fasttrack-payment` | Server-priced Stripe PaymentIntent | Deploy yes; refuses (501) without a key. Do not test payments until Stripe TEST secrets are set | `STRIPE_SECRET_KEY` |
| `stripe-webhook` | Signature-verified payment settlement | Deploy yes; refuses (501) without secrets | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

```powershell
Get-Content supabase/.temp/project-ref      # must print znvhmuhojvwvjzmaqwff
npx supabase functions deploy store-subscription-webhook --project-ref znvhmuhojvwvjzmaqwff
npx supabase functions deploy claim-correctional-transition --project-ref znvhmuhojvwvjzmaqwff
npx supabase functions deploy create-fasttrack-payment --project-ref znvhmuhojvwvjzmaqwff
npx supabase functions deploy stripe-webhook --project-ref znvhmuhojvwvjzmaqwff
```

Deploying with `--project-ref` of the DEV project cannot affect production. Never run these with the production ref.
