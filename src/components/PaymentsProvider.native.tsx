import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { loadStripeReactNativeModule, stripeNativeAvailable } from '@/core/native/native-module-capability';

type StripeModule = typeof import('@stripe/stripe-react-native');

/**
 * Wraps the app with Stripe ONLY when publishable key is configured AND StripeSdk is linked in this dev client.
 * The publishable key is safe to ship; the secret key never exists in the app.
 */
export function PaymentsProvider({ children }: { children: ReactNode }) {
  const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const [stripe, setStripe] = useState<StripeModule | null>(null);

  useEffect(() => {
    if (!key || !stripeNativeAvailable()) return;
    let active = true;
    void loadStripeReactNativeModule().then((mod) => {
      if (active && mod) setStripe(mod);
    });
    return () => { active = false; };
  }, [key]);

  if (!key || !stripe) return <>{children}</>;
  const { StripeProvider } = stripe;
  return (
    <StripeProvider
      publishableKey={key}
      merchantIdentifier={process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID?.trim() || undefined}
      urlScheme="fairpathmobile"
    >
      <>{children}</>
    </StripeProvider>
  );
}
