// Unified Community Exchange static contract. `node scripts/audit-community.mjs`
import fs from 'node:fs';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };
const read = (p) => fs.readFileSync(p, 'utf8');

const hub = read('src/app/community/index.tsx');
const explore = read('src/app/explore.tsx');
const home = read('src/app/home.tsx');
const nextStep = read('src/core/profile/next-step.ts');
const foodRules = read('src/core/community/food-listing-rules.ts');
const listItem = read('src/app/marketplace-list-item.tsx');

check(/I need help/i.test(hub) && /I can help/i.test(hub), 'Community hub must expose need/help entry points.');
check(explore.includes("route: '/community'"), 'Explore must link FairPath Exchange hub.');
check(read('src/app/community/help-now.tsx').includes('searchOpportunities'), 'Community must expose Opportunity Engine help-now route.');
check(explore.includes("route: '/community'") && !home.includes('CommunityHelpPanel'), 'Community entry must live on Explore (Home stays focused).');
check(/marketplace\.ready_for_pickup|marketplace_pickup/.test(nextStep), 'Next steps must include marketplace pickup signals.');
check(/homemade/i.test(foodRules), 'Food rules must block homemade/open leftovers in V1.');
check(/validateFoodListingText/.test(listItem), 'Marketplace list item must enforce food listing rules for Food category.');

const communityUi = [
  read('src/app/community/index.tsx'),
  read('src/app/community/can-help.tsx'),
  read('src/app/community/need-help/index.tsx'),
  read('src/app/community/need-help/[id].tsx'),
].join('\n');
check(!/database approval|waiting on database migration/i.test(communityUi), 'Community UI must not show stale migration warnings.');
check(/communityRequestStatusLabel|status-copy/.test(read('src/app/community/need-help/[id].tsx')), 'Request detail must use member-facing status copy.');
check(!/fontSize:\s*[6789][,\s}]/i.test(read('src/app/community/need-help/[id].tsx')), 'Request detail must avoid sub-10pt button text.');

const draft = read('docs/proposed-migrations/20261021180000_community_help_exchange_DRAFT.sql');
check(/member_create_community_help_request/.test(draft) && /TOO_MANY_OPEN/.test(draft), 'Community help draft migration must rate-limit open requests.');
check(/revoke all on table public\.community_help_requests/.test(draft), 'Community help tables must not allow direct writes from authenticated.');

if (failures.length) {
  console.error('Community audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Community audit passed: hub, home/explore wiring, food rules, draft migration guards.');
