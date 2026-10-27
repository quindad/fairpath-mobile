/**
 * Startup must not statically import native modules that development-signal iOS builds omit.
 */
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

const layout = read('src/app/_layout.tsx');
if (/from 'expo-notifications'|from "expo-notifications"|from '@stripe\/stripe-react-native'/.test(layout)) {
  console.error('FAIL: _layout.tsx must not statically import expo-notifications or Stripe');
  process.exit(1);
}
if (!/loadExpoNotificationsModule/.test(layout)) {
  console.error('FAIL: _layout.tsx must use loadExpoNotificationsModule');
  process.exit(1);
}

const payNative = read('src/components/PaymentsProvider.native.tsx');
if (/from '@stripe\/stripe-react-native'/.test(payNative)) {
  console.error('FAIL: PaymentsProvider.native must not statically import @stripe/stripe-react-native');
  process.exit(1);
}

const push = read('src/core/notifications/push-registration.ts');
if (/from 'expo-notifications'|from "expo-notifications"/.test(push)) {
  console.error('FAIL: push-registration must not statically import expo-notifications');
  process.exit(1);
}

const deliver = read('src/core/documents/deliver.ts');
if (/from 'expo-print'|from 'expo-sharing'/.test(deliver)) {
  console.error('FAIL: deliver.ts must lazy-load print/share');
  process.exit(1);
}

const sheet = read('src/core/payments/payment-sheet.native.ts');
if (/from '@stripe\/stripe-react-native'/.test(sheet)) {
  console.error('FAIL: payment-sheet.native must lazy-load Stripe');
  process.exit(1);
}

const capability = read('src/core/native/native-module-capability.ts');
for (const mod of ['ExpoPushTokenManager', 'ExpoPrint', 'StripeSdk']) {
  if (!capability.includes(`'${mod}'`)) {
    console.error(`FAIL: native-module-capability must probe ${mod}`);
    process.exit(1);
  }
}

console.log('PASS native capability contract: optional native modules are not imported at startup');
