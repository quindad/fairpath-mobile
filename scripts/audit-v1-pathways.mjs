// Verifies ten V1 pathways point at real app routes (no duplicate engines).
import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};

const src = fs.readFileSync('src/core/opportunity/v1-pathways.ts', 'utf8');
const grow = fs.readFileSync('src/app/grow/index.tsx', 'utf8');

check(src.includes('V1_PATHWAYS'), 'v1-pathways registry missing');

const routeMatches = [...src.matchAll(/primaryRoute:\s*'([^']+)'/g)].map((m) => m[1]);
check(routeMatches.length === 10, `expected 10 primary routes, got ${routeMatches.length}`);

function pathnameOnly(route) {
  return route.split('?')[0];
}

function routeFileExists(route) {
  const rel = pathnameOnly(route).replace(/^\//, '');
  const candidates = [
    path.join('src/app', rel + '.tsx'),
    path.join('src/app', rel, 'index.tsx'),
  ];
  return candidates.some((p) => fs.existsSync(p));
}

for (const route of routeMatches) {
  check(routeFileExists(route), `missing screen for pathway route ${route}`);
}

for (const route of routeMatches) {
  check(!route.includes('help-now'), `pathway must not use help-now as primary: ${route}`);
  check(route !== '/resources', `pathway must not use bare /resources: ${route}`);
}

check(
  grow.includes('router.push(p.primaryRoute'),
  'Grow hub cards must navigate via primaryRoute',
);
check(
  !grow.includes('helpNowQuery'),
  'Grow hub must not route cards through helpNowQuery / help-now',
);

const ids = [...src.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
check(!ids.includes('neighbor_network'), 'neighbor_network pathway must stay excluded');
check(!ids.includes('equipment_library'), 'equipment_library pathway must stay excluded');

if (failures.length) {
  console.error('V1 pathway audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('V1 pathway connection audit passed.');
