// Location services audit — foreground-only, ZIP fallback, Signal integration.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

check(read('package.json').includes('expo-location'), 'expo-location must be installed.');
check(/locationWhenInUsePermission/.test(read('app.json')), 'iOS/Android location permission copy required.');
check(/refreshDeviceLocation/.test(read('src/core/location/device-location-service.ts')), 'Device location refresh required.');
check(!/BackgroundLocation|startLocationUpdatesAsync/i.test(read('src/core/location/device-location-service.ts')), 'No background tracking in V1.');
check(/loadMemberSearchLocation/.test(read('src/core/signal/signal-orchestrator.ts')), 'Signal tools must use shared search location.');
check(/searchResources/.test(read('src/core/signal/signal-orchestrator.ts')), 'Signal must run live resource search.');
check(/GeocodingProvider/.test(read('src/core/location/geocoding-provider.ts')), 'Geocoding provider abstraction required.');

if (failures.length) {
  console.error('Location audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Location audit passed.');
