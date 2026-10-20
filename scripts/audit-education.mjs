// Education & resources member surfaces: Academy honesty + Resources cross-links. `npm run test:education`
// Deep schema proof remains in `npm run test:resources`.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};

const academy = read('src/app/academy.tsx');
const academyDetail = read('src/app/academy/[id].tsx');
const fixtures = read('src/core/academy/fixtures.ts');
const contract = read('src/core/academy/catalog-contract.ts');
const resources = read('src/app/resources.tsx');
const resourceDetail = read('src/app/resource/[id].tsx');
const saved = read('src/app/saved-resources.tsx');
const signal = read('src/core/ai/signal.ts');
const explore = read('src/app/explore.tsx');

check(/DEV_FIXTURE_COURSES/.test(academy) && /development fixtures only/i.test(academy), 'Academy must label catalog as DEV fixtures.');
check(/OPEN RESOURCES/.test(academy) && /router\.push\('\/resources'/.test(academy), 'Academy must cross-link to Resources for real national programs.');
check(/searchCourses/.test(academy) && /Linking\.openURL/.test(academy), 'Academy must search fixtures and open external enrollment URLs.');
check(/does not run its own lesson|real courses and programs run by other organizations/i.test(academyDetail), 'Legacy /academy/[id] must not pretend to host lessons.');
check(/DEVELOPMENT FIXTURES ONLY|fixture-provider|example\.invalid/.test(fixtures), 'Academy fixtures must be provenance-marked test data.');
check(/free_with_paid_certificate/.test(contract), 'Cost contract must distinguish free learning vs paid certificate.');

check(/searchResources/.test(resources), 'Resources browse must use server search RPC.');
check(/loadResourceDetail/.test(resourceDetail), 'Resource detail must load via resources-service (get_resource_detail RPC).');
check(/provenanceBadge/.test(resourceDetail) && /freshnessLabel/.test(resourceDetail), 'Resource detail must surface verification/freshness honestly.');
check(/saveResource/.test(resourceDetail) && /unsaveResource/.test(resourceDetail), 'Resource detail must support save via RPC.');
check(/loadSavedResources/.test(saved), 'Saved resources screen must load member saves.');

check(/academy-lesson-question/.test(signal), 'Signal catalog must include academy lesson Q&A Edge function.');
check(/route: '\/academy'/.test(explore) && /route: '\/resources'/.test(explore), 'Explore must link Academy and Resources.');

if (failures.length) {
  console.error('Education audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Education audit passed: Academy fixture honesty, Resources RPC browse/detail/save, Explore links, Signal academy hook.');
