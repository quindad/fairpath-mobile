/**
 * Dynamic config layered on app.json (Expo passes app.json in as `config`).
 *
 * Apple Pay / Google Pay need native capabilities that only exist once Sterling has created them:
 *   - APPLE_MERCHANT_ID    (e.g. merchant.com.fairpathfwd.fairpathmobile) — adds the Apple Pay entitlement.
 *                          Setting it BEFORE the merchant id exists in the Apple Developer account breaks the iOS build.
 *   - ENABLE_GOOGLE_PAY    ("true") — enables the Google Pay wallet metadata on Android.
 * Leave both unset (the default) and cards still work through Stripe's PaymentSheet; the wallets simply do not appear.
 * Set them as EAS environment variables (never in source) and rebuild the native client.
 */
module.exports = ({ config }) => ({
  ...config,
  plugins: (config.plugins ?? []).map((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name !== '@stripe/stripe-react-native') return plugin;
    return [
      '@stripe/stripe-react-native',
      {
        merchantIdentifier: process.env.APPLE_MERCHANT_ID || undefined,
        enableGooglePay: process.env.ENABLE_GOOGLE_PAY === 'true',
      },
    ];
  }),
});
