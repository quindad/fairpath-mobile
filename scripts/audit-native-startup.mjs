// Startup-critical native imports: must not statically load packages that require missing TurboModules.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const layout = read('src/app/_layout.tsx');
check(!/from 'expo-notifications'|from '@stripe\/stripe-react-native'/.test(layout), '_layout must not statically import notifications or Stripe');

const payNative = read('src/components/PaymentsProvider.native.tsx');
check(!/from '@stripe\/stripe-react-native'/.test(payNative), 'PaymentsProvider.native must lazy-load Stripe');
check(/stripeNativeAvailable|loadStripeReactNativeModule/.test(payNative), 'PaymentsProvider.native must probe StripeSdk before import');

const sheet = read('src/core/payments/payment-sheet.native.ts');
check(!/from '@stripe\/stripe-react-native'/.test(sheet), 'payment-sheet.native must lazy-load Stripe');

const push = read('src/core/notifications/push-registration.ts');
check(!/from 'expo-notifications'/.test(push), 'push-registration must not statically import expo-notifications');

const deliver = read('src/core/documents/deliver.ts');
check(!/from 'expo-print'|from 'expo-sharing'/.test(deliver), 'deliver.ts must not statically import print/share');

const cap = read('src/core/native/native-module-capability.ts');
for (const mod of ['ExpoPushTokenManager', 'ExpoPrint', 'ExpoSharing', 'StripeSdk', 'ExpoAppleAuthentication']) {
  check(cap.includes(`'${mod}'`), `native-module-capability must probe ${mod}`);
}

check(/development-signal/.test(read('eas.json')) && /FAIRPATH_IOS_QA_MINIMAL/.test(read('eas.json')), 'eas.json documents development-signal minimal profile');
check(/fairpathIosQaMinimal/.test(read('app.config.js')), 'app.config.js sets fairpathIosQaMinimal extra');

if (failures.length) {
  console.error('Native startup audit FAILED:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('Native startup audit passed: _layout and providers avoid static optional native imports.');
