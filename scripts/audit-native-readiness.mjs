import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const app = JSON.parse(read('app.json')).expo;
const dynamic = read('app.config.js');
const env = read('.env.example');
const eas = JSON.parse(read('eas.json'));
const supabase = read('src/lib/supabase.ts');

check(app.scheme === 'fairpathmobile', 'The native deep-link scheme must be fairpathmobile.');
check(app.ios?.bundleIdentifier === 'com.fairpathfwd.fairpathmobile', 'The iOS bundle identifier must be stable.');
check(/package:\s*config\.android\?\.package\s*\|\|\s*'com\.fairpathfwd\.fairpathmobile'/.test(dynamic), 'The resolved Android package identifier must be stable.');
check(app.icon && fs.existsSync(app.icon), 'The primary app icon must exist.');
check(app.ios?.icon && fs.existsSync(app.ios.icon), 'The iOS icon asset must exist.');
const splash = app.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
check(splash?.[1]?.image && fs.existsSync(splash[1].image), 'The splash image must exist.');
check(Boolean(eas.build?.development?.developmentClient), 'The development profile must create a development client.');
check(eas.build?.production?.autoIncrement === true, 'Production builds must auto-increment their store version.');
check(/process\.env\.GOOGLE_MAPS_ANDROID_API_KEY/.test(dynamic) && /process\.env\.GOOGLE_MAPS_IOS_API_KEY/.test(dynamic), 'Native map keys must come from build-time environment variables.');
check(!/AIza[0-9A-Za-z_-]{20,}/.test(dynamic + env), 'Google Maps credentials must not be embedded in tracked configuration.');
check(!/PRODUCTION_URL_FALLBACK|PRODUCTION_KEY_FALLBACK|sb_publishable_[A-Za-z0-9_-]+/.test(supabase), 'Supabase production configuration must not be embedded as a fallback.');
check(/if \(!envUrl \|\| envKeyIsPlaceholder\)/.test(supabase), 'A build must fail closed when Supabase configuration is missing.');
check(!/EXPO_PUBLIC_[A-Z_]*(SERVICE_ROLE|SECRET|WEBHOOK)/.test(env), 'Server secrets must never use EXPO_PUBLIC variables.');

if (failures.length) {
  console.error('Native readiness audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Native readiness audit passed: identifiers, assets, deep links, build profiles, map-key wiring, and environment fail-closed behavior verified.');
