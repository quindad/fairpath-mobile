// Explore tab + unified discovery patterns (Tasks 039–042). `npm run test:explore`
import fs from 'node:fs';

const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const explore = read('src/app/explore.tsx');
const chrome = read('src/components/ProductChrome.tsx');
const findJobs = read('src/app/find-jobs.tsx');
const findHousing = read('src/app/find-housing.tsx');
const resource = read('src/app/resources.tsx');

check(/SECTIONS:/.test(explore) && /Work and housing/.test(explore), 'Explore must group destinations into labeled sections.');
for (const route of ['/community', '/find-jobs', '/find-housing', '/resources', '/marketplace', '/record-relief', '/fairpath-ai', '/academy']) {
  check(explore.includes(`route: '${route}'`) || explore.includes(`route: "${route}"`), `Explore must link to ${route}.`);
}
check(/STATUS_LABEL/.test(explore) && /effectiveExploreStatus/.test(explore), 'Explore must use explore-readiness overrides for honest status.');
check(/status !== 'planned'/.test(explore), 'Planned destinations must not navigate.');
check(/isThemedRoute/.test(chrome) && /Explore','\/explore'/.test(chrome.replace(/\s/g, '')), 'Explore must be in bottom nav primary tabs.');

check(/searchJobs\(/.test(findJobs) && /JobMap/.test(findJobs), 'Jobs discovery uses server search + map toggle.');
check(/searchHousing\(/.test(findHousing) && /HousingMap/.test(findHousing), 'Housing discovery uses server search + map toggle.');
check(/searchResources/.test(resource), 'Resources discovery uses server searchResources, not static lists only.');

if (failures.length) {
  console.error('Explore audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Explore audit passed: catalog routes, guest-safe discovery entry points, map/search patterns.');
