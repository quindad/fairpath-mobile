import type { ReactNode } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

/**
 * Wraps the app with Stripe ONLY when a publishable key is configured. The publishable key is safe to ship
 * (it can only create payment methods); the secret key never exists in the app.
 */
export function PaymentsProvider({ children }: { children: ReactNode }) {
  const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!key) return <>{children}</>;
  return (
    <StripeProvider publishableKey={key} merchantIdentifier={process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID?.trim() || undefined} urlScheme="fairpathmobile">
      <>{children}</>
    </StripeProvider>
  );
}
