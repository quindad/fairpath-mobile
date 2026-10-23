// Opportunity Engine contract audit. `node scripts/audit-opportunity.mjs`
import fs from 'node:fs';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };
const read = (p) => fs.readFileSync(p, 'utf8');

check(read('src/core/opportunity/orchestrator.ts').includes('Promise.all'), 'Orchestrator must query sources concurrently where applicable.');
check(read('src/core/opportunity/intent-parser.ts').includes('interpretOpportunityQuery'), 'Deterministic intent parser required.');
check(read('src/app/community/help-now.tsx').includes('OpportunityResultsList'), 'Help now must render actionable results.');
check(read('src/components/CommunityHelpPanel.tsx').includes('I need help'), 'Home panel must keep single entry to Help now.');
check(!read('src/app/home.tsx').includes('TextInput') || read('src/app/home.tsx').includes('Search jobs'), 'Home must not add a second general help search bar.');
check(read('src/core/opportunity/dedupe.ts').includes('dedupeOpportunityResults'), 'Dedupe layer required.');
check(read('docs/proposed-migrations/20261021185000_member_resource_referral_DRAFT.sql').includes('member_submit_resource_referral_request'), 'Member referral draft must exist separately from community migration.');
check(read('src/core/opportunity/v1-pathways.ts').includes('V1_PATHWAYS'), 'Ten V1 pathways registry required.');
check(read('src/app/grow/index.tsx').includes('V1_PATHWAYS'), 'Grow hub must surface V1 pathways.');

if (failures.length) {
  console.error('Opportunity audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Opportunity Engine audit passed.');
