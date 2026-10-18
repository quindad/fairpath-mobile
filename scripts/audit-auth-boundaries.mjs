// Member-app authorization boundaries (Task 020). `npm run test:auth-boundaries`
import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

const layout = read('src/app/_layout.tsx');
const mig = read('supabase/migrations/20260929120000_auth_profile_hardening.sql');
const devHealth = read('src/app/dev-integration-health.tsx');

const { isPublicRoute } = await import('../src/core/auth/public-routes.ts');

const mustBePublic = [
  '/',
  '/find-jobs',
  '/find-housing',
  '/job/published-abc',
  '/housing/listing-1',
  '/sign-in',
  '/sign-up',
  '/auth/callback',
  '/check-email',
  '/resources',
  '/resource/abc',
];

const mustBePrivate = [
  '/home',
  '/me',
  '/onboarding',
  '/accept-terms',
  '/notifications',
  '/plus',
  '/payments',
  '/job-applications',
  '/job-apply/new',
  '/housing-apply/new',
  '/housing-activity',
  '/privacy',
  '/opportunity-profile/contact',
  '/marketplace-list-item',
  '/dev-integration-health',
  '/record-relief',
  '/credit',
];

for (const p of mustBePublic) check(isPublicRoute(p), `${p} must stay public (guest browse / auth entry).`);
for (const p of mustBePrivate) check(!isPublicRoute(p), `${p} must require sign-in.`);

check(/isPublicRoute/.test(layout) && /PUBLIC_BROWSE\(pathname\)/.test(layout), 'Root layout must gate private routes via shared isPublicRoute.');
check(/returnTo=/.test(layout), 'Private route guard must preserve returnTo for sign-in.');

check(/protect_profile_account_type/.test(mig) && /ACCOUNT_TYPE_LOCKED/.test(mig), 'Database must block client account_type changes.');
const profileUpdates = walk('src')
  .filter((f) => /\.(ts|tsx)$/.test(f))
  .map((f) => read(f))
  .join('\n');
check(!/from\('profiles'\)\.update\([\s\S]{0,200}account_type/.test(profileUpdates), 'Client must never update profiles.account_type.');
check(/account_type:\s*'member'/.test(read('src/app/sign-up.tsx')), 'Sign-up metadata may only declare member at registration.');

const appRoutes = walk('src/app').filter((f) => f.endsWith('.tsx') && !f.includes('_layout'));
const routeNames = appRoutes.map((f) => f.replace(/\\/g, '/').replace('src/app/', '').replace(/\/index\.tsx$/, '').replace(/\.tsx$/, ''));
for (const forbidden of ['employer', 'partner', 'landlord', 'staff']) {
  check(!routeNames.some((r) => r === forbidden || r.startsWith(forbidden + '/')), `Member app must not expose ${forbidden} console routes: ${routeNames.filter((r) => r.includes(forbidden)).join(', ') || 'ok'}`);
}

check(/!__DEV__/.test(devHealth), 'DEV integration health must refuse to render outside __DEV__.');

if (failures.length) {
  console.error('Auth boundaries audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Auth boundaries audit passed: public browse vs member-only routes, account_type locked server-side.');
