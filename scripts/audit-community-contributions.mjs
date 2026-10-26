// Community contributions: client contracts + draft migration guards.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const draft = read('docs/proposed-migrations/20261026140000_community_contributions_DRAFT.sql');
check(/resource_reactions/.test(draft) && /unique \(user_id, resource_id\)/.test(draft), 'One reaction per member per resource.');
check(/community_contributions/.test(draft) && /is_fairpath_admin\(\)/.test(draft), 'Admin moderation must use is_fairpath_admin().');
check(/PRIVATE_INFO_REJECTED/.test(draft), 'Server must reject private record payloads.');
check(/counts_suppressed/.test(draft), 'Sensitive resources must suppress small-group counts.');

const aggregates = read('src/core/community/reaction-aggregates.ts');
check(/formatReactionAggregateLine/.test(aggregates), 'UI must format anonymous aggregates only.');
check(!/user_id|member_id/.test(aggregates), 'Reaction aggregate helper must not expose reactor identities.');

const validation = read('src/core/community/contribution-validation.ts');
check(/containsPrivateContributionText/.test(validation), 'Client-side private-info guard required.');

const detail = read('src/app/resource/[id].tsx');
check(/ResourceReactionBar/.test(detail) && /SUGGEST AN EDIT/.test(detail), 'Resource detail must wire reactions and edits.');

const resources = read('src/app/resources.tsx');
check(/ADD A RESOURCE/.test(resources), 'Resource Center must expose add-resource contribution.');

const rr = read('src/app/record-relief/case/[id].tsx');
check(/contribute-source/.test(rr), 'Record Relief must offer source contribution when forms missing.');

if (failures.length) {
  console.error('Community contributions audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Community contributions audit passed (draft migration + client contracts).');
