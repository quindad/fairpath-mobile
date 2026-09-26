import { Platform } from 'react-native';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import type { PreparedPayment } from '@/core/payments/payments-service';

export type SheetResult = { status: 'completed' } | { status: 'canceled' } | { status: 'error'; message: string };

/**
 * Presents Stripe's PaymentSheet: cards plus Apple Pay (iOS, when a merchant id is configured) and Google Pay
 * (Android, when enabled). The sheet itself hides wallets the device cannot use.
 * IMPORTANT: 'completed' only means the member finished the sheet. It is NOT proof of payment; the caller must
 * wait for the server (Stripe webhook) to record the transaction as succeeded.
 */
export async function presentPaymentSheetFor(payment: PreparedPayment): Promise<SheetResult> {
  const merchantId = process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID?.trim();
  const googlePay = Platform.OS === 'android' && process.env.EXPO_PUBLIC_GOOGLE_PAY_ENABLED === 'true';
  const testMode = (process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').startsWith('pk_test');

  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: 'FairPath',
    customerId: payment.customer_id,
    customerEphemeralKeySecret: payment.ephemeral_key_secret,
    paymentIntentClientSecret: payment.client_secret,
    allowsDelayedPaymentMethods: false,
    returnURL: 'fairpathmobile://stripe-redirect',
    applePay: Platform.OS === 'ios' && merchantId ? { merchantCountryCode: 'US' } : undefined,
    googlePay: googlePay ? { merchantCountryCode: 'US', currencyCode: payment.currency.toUpperCase(), testEnv: testMode } : undefined,
  });
  if (initError) return { status: 'error', message: 'The payment form could not be opened. You were not charged.' };

  const { error } = await presentPaymentSheet();
  if (!error) return { status: 'completed' };
  if (error.code === 'Canceled') return { status: 'canceled' };
  return { status: 'error', message: error.message || 'The payment did not go through. You were not charged.' };
}
