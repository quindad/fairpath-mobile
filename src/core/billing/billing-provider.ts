import { Platform } from 'react-native';

/**
 * Provider-neutral boundary for paid FairPath+ subscriptions (Apple App Store / Google Play).
 *
 * FairPath+ unlocks digital features, so it is sold through the platform stores, not through Stripe card entry.
 * The store SDK is intentionally NOT bundled yet: it needs products, agreements and credentials that do not
 * exist. Until then this provider reports `not_configured` and the UI says so. A purchase can never be
 * "simulated": entitlement changes only when trusted server code records a verified store notification
 * (apply_subscription_event), and the client merely re-reads my_fairpath_plus_status afterwards.
 */
export type BillingResult =
  | { status: 'not_configured'; message: string }
  | { status: 'cancelled' }
  | { status: 'purchased_pending_verification' }
  | { status: 'error'; message: string };

export interface BillingProvider {
  readonly name: 'apple' | 'google' | 'none';
  readonly configured: boolean;
  purchasePlus(): Promise<BillingResult>;
  restorePurchases(): Promise<BillingResult>;
}

class NotConfiguredProvider implements BillingProvider {
  readonly configured = false;
  constructor(readonly name: 'apple' | 'google' | 'none') {}
  private message() {
    const store = this.name === 'apple' ? 'App Store' : this.name === 'google' ? 'Google Play' : 'the app store';
    return `FairPath+ purchases through ${store} are not connected in this build yet. Nothing was charged.`;
  }
  async purchasePlus(): Promise<BillingResult> { return { status: 'not_configured', message: this.message() }; }
  async restorePurchases(): Promise<BillingResult> { return { status: 'not_configured', message: this.message() }; }
}

/** A real provider is returned here only when its store SDK is wired in AND its product id is configured. */
export function getBillingProvider(): BillingProvider {
  if (Platform.OS === 'ios') return new NotConfiguredProvider('apple');
  if (Platform.OS === 'android') return new NotConfiguredProvider('google');
  return new NotConfiguredProvider('none');
}
