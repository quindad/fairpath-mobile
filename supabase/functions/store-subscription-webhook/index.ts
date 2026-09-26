// Boundary for Apple App Store Server Notifications V2 / Google Play RTDN.
//
// NOT IMPLEMENTED ON PURPOSE. Verifying a store notification requires credentials and products that do not
// exist yet (App Store Connect API key + shared secret, Google Play service account, product ids). Until they
// do, this endpoint refuses every request rather than pretending a purchase happened.
//
// When implemented, this function must: (1) verify the notification signature/JWS with the store's keys,
// (2) map the original transaction id to a FairPath user through a server-side mapping (never from the request),
// and (3) call public.apply_subscription_event with the VERIFIED state. Entitlement then follows automatically.
import { json } from '../_shared/http.ts';

Deno.serve(() => json(501, {
  error: 'store_billing_not_configured',
  detail: 'Store subscription verification is not connected. No purchase can be recorded through this endpoint yet.',
}));
