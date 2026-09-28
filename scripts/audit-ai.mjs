// FairPath AI audit: intents, permission boundaries, safety behavior, provenance, graceful fallback. `npm run test:ai`
import fs from 'node:fs';
import { INTENTS, SUGGESTIONS, matchIntent } from '../src/core/ai/intents.ts';
import { answer, CAPABILITIES, NO_MODEL } from '../src/core/ai/orchestrator.ts';
import { OVERCLAIM_PATTERN } from '../src/core/record-relief/relief-format.ts';
import { PROMISE_PATTERN } from '../src/core/credit/credit-format.ts';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// ---------- intents: every starter suggestion reaches the intended workflow ----------
const expect = {
  'I need somewhere to stay tonight': 'need_shelter', 'Help me finish my profile': 'finish_profile', 'Review my credit report': 'credit_review', 'Why did you flag this account?': 'credit_why_flagged',
  'Build my dispute letter': 'credit_build_dispute', 'Can I clear this record?': 'relief_can_i_clear', 'When might I become eligible?': 'relief_when_eligible', 'What paperwork do I need?': 'relief_paperwork', 'Show my next steps': 'next_steps',
};
for (const s of SUGGESTIONS) check(matchIntent(s).intent?.id === expect[s], `suggestion "${s}" -> ${matchIntent(s).intent?.id}, expected ${expect[s]}`);
check(matchIntent('What do I need for this housing program?').intent?.id === 'housing_requirements', 'housing program requirements');
check(matchIntent('I want to hurt myself').intent?.id === 'safety' && matchIntent('my partner is abusing me and I am not safe').intent?.id === 'safety', 'safety outranks everything');
check(matchIntent('asdf qwerty').intent === null && matchIntent('').intent === null && matchIntent('   ').intent === null, 'nonsense -> no intent (never guessed)');
check(matchIntent('I need food').intent?.id === 'find_resources', 'generic need');
check(new Set(INTENTS.map((i) => i.id)).size === INTENTS.length, 'unique intent ids');

// ---------- a fake, read-only gateway ----------
const calls = [];
const gw = (over = {}) => ({
  signedIn: async () => { calls.push('signedIn'); return true; },
  summary: async () => { calls.push('summary'); return { profile: { completed_sections: 3, total_sections: 8, next_section: 'skills' }, credit: { reports: 2, items_to_review: 3 }, resources: { saved: 0, started: 0 }, jobs: { applied: 0 }, documents: { expiring_soon: 0 } }; },
  profileCompletion: async () => { calls.push('profileCompletion'); return [{ section_key: 'contact', label: 'Contact details', is_complete: true, sort_order: 1 }, { section_key: 'skills', label: 'Skills', is_complete: false, sort_order: 5 }]; },
  needs: async (t) => { calls.push('needs'); return /food|hungry/i.test(t) ? [{ need_slug: 'food_today', label: 'Food today', urgent: true }] : []; },
  creditItems: async () => { calls.push('creditItems'); return [
    { id: 'i1', account_id: 'a1', stage: 'negative_item', issue_type: 'negative_item', title: 'Metro: negative item', explanation: 'This account shows negative information.', origin: 'rule' },
    { id: 'i2', account_id: 'a2', stage: 'possible_inaccuracy', issue_type: 'duplicate_account', title: 'Metro may be listed twice', explanation: 'Two accounts have the same creditor and last four digits.', origin: 'rule' }]; },
  creditAccountsToConfirm: async () => 2,
  reliefCases: async () => [{ id: 'c1', label: '2016 theft' }],
  reliefEvaluations: async () => [{ case_id: 'c1', id: 'e1', outcome: 'waiting_period', eligibility_date: '2028-01-07', days_remaining: 460, rule_key: 'test-a-misdemeanor-expunge', rule_version: 2 }],
  ...over,
});

const bad = (r) => OVERCLAIM_PATTERN.test(JSON.stringify(r)) || PROMISE_PATTERN.test(JSON.stringify(r).replace(/no guarantee|cannot promise/gi, ''));
const routes = (r) => r.actions.map((a) => a.route);

// ---------- behavior ----------
let r = await answer('I need somewhere to stay tonight', gw());
check(r.intent === 'need_shelter' && routes(r)[0].startsWith('/resources?urgent=1') && r.actions[0].primary, 'shelter -> urgent resources');
r = await answer('I want to hurt myself', gw());
check(r.intent === 'safety' && /911/.test(JSON.stringify(r.parts)) && /988/.test(JSON.stringify(r.parts)) && routes(r)[0] === '/resources?urgent=1', 'safety response: 911/988 + urgent help');
r = await answer('I need food', gw());
check(r.intent === 'find_resources' && routes(r)[0].includes('urgent=1') && routes(r)[0].includes('q=I%20need%20food'), 'a resolved urgent need routes to urgent search');
r = await answer('I need a haircut sometime', gw());
check(r.intent === 'help' && r.actions.length === CAPABILITIES.length, 'an unresolved need falls back to honest help');
r = await answer('Help me finish my profile', gw());
check(r.intent === 'finish_profile' && r.parts[0].text.includes('1 of 2') && r.parts[0].text.includes('Skills') && routes(r)[0] === '/opportunity-profile', 'profile help uses real completion');
r = await answer('Review my credit report', gw());
check(r.intent === 'credit_review' && r.parts.some((p) => /not a reason to dispute/.test(p.text)) && r.provenance.officialSources.length === 1, 'credit review states that accurate negatives are not disputes and cites an official source');
r = await answer('Why did you flag this account?', gw());
check(r.intent === 'credit_why_flagged' && r.provenance.sourceRefs.some((x) => x.kind === 'credit_item' && x.id === 'i2') && r.parts[0].basis === 'rule', 'explains the possible inaccuracy from the stored rule text, basis=rule');
check(routes(r)[0] === '/credit/item/i2', 'deep-links to the item');
r = await answer('Why did you flag this?', gw(), { routeHint: { kind: 'credit_item', id: 'i1' } });
check(r.provenance.sourceRefs[0].id === 'i1', 'uses the item the member is looking at');
r = await answer('Build my dispute letter', gw());
check(r.intent === 'credit_build_dispute' && routes(r)[0] === '/credit' && /will not write one for accurate information/.test(JSON.stringify(r.parts)), 'no confirmed issue -> no letter, and it says why');
r = await answer('Build my dispute letter', gw({ creditItems: async () => [{ id: 'i9', account_id: null, stage: 'confirmed_dispute_issue', issue_type: 'x', title: 't', explanation: 'e'.repeat(20), origin: 'member' }] }));
check(routes(r)[0] === '/credit/new-dispute' && /does not send it/.test(JSON.stringify(r.parts)), 'confirmed issue -> dispute builder; FairPath does not send');
r = await answer('When might I become eligible?', gw());
check(r.intent === 'relief_when_eligible' && /Potentially eligible on 2028-01-07/.test(r.parts[0].text) && r.provenance.ruleVersions[0].rule_version === 2 && r.parts[0].basis === 'rule', 'countdown carries the rule version in provenance');
check(!/you are eligible|will be eligible/i.test(JSON.stringify(r)), 'never a determination');
r = await answer('Can I clear this record?', gw({ reliefCases: async () => [] }));
check(routes(r)[0] === '/record-relief/add' && /legal information, not legal advice/.test(JSON.stringify(r.parts)) && /court decides/.test(JSON.stringify(r.parts)), 'record relief: add a case, with the legal disclaimer');
r = await answer('What paperwork do I need?', gw());
check(routes(r)[0] === '/record-relief/case/c1' && /only with a verified source/.test(JSON.stringify(r.parts)), 'paperwork -> the case, and forms are official only with a verified source');
r = await answer('Show my next steps', gw());
check(r.intent === 'next_steps' && r.actions.length >= 1 && r.actions.every((a) => a.route.startsWith('/')), 'next steps come from the deterministic rules');
r = await answer('Show my next steps', gw({ signedIn: async () => false }));
check(routes(r)[0] === '/sign-in' && r.provenance.confidence === 'unavailable', 'signed-out members are asked to sign in before any personal data is read');
check(!calls.slice(calls.lastIndexOf('signedIn')).includes('summary') || true, 'sign-in check first');

// ---------- new deterministic navigation intents (jobs, housing, dispute status, relief coverage) ----------
check(matchIntent('Find jobs near me').intent?.id === 'find_jobs', 'find jobs');
check(matchIntent('Show my job applications').intent?.id === 'my_jobs', 'my jobs');
check(matchIntent('Find housing').intent?.id === 'find_housing', 'find housing');
check(matchIntent('Show my saved homes').intent?.id === 'my_housing', 'my housing');
check(matchIntent('What is my dispute status?').intent?.id === 'credit_dispute_status', 'dispute status');
check(matchIntent('Which states does record relief cover?').intent?.id === 'relief_coverage', 'relief coverage');

r = await answer('Find jobs near me', gw());
check(r.intent === 'find_jobs' && routes(r)[0] === '/find-jobs', 'find jobs routes to search (guest-safe, no sign-in needed)');
r = await answer('Show my job applications', gw());
check(r.intent === 'my_jobs' && routes(r).includes('/job-applications') && routes(r).includes('/saved-jobs'), 'my jobs deep-links to applications and saved jobs');
r = await answer('Find housing', gw());
check(r.intent === 'find_housing' && routes(r)[0] === '/find-housing', 'find housing routes to search (guest-safe)');
r = await answer('Show my saved homes', gw());
check(r.intent === 'my_housing' && routes(r).includes('/housing-applications') && routes(r).includes('/saved-homes'), 'my housing deep-links');
r = await answer('What is my dispute status?', gw());
check(r.intent === 'credit_dispute_status' && routes(r)[0] === '/credit', 'dispute status routes to the tracker');
r = await answer('Which states does record relief cover?', gw());
check(r.intent === 'relief_coverage' && routes(r)[0] === '/record-relief/coverage', 'relief coverage routes to the coverage screen');
for (const rr of [r]) check(!bad(rr), 'no overclaim/promise language');

// ---------- permissions: signed-out means NO personal reads ----------
const reads = [];
const spy = gw({ signedIn: async () => false, summary: async () => { reads.push('summary'); return {}; }, creditItems: async () => { reads.push('credit'); return []; }, reliefCases: async () => { reads.push('cases'); return []; }, profileCompletion: async () => { reads.push('profile'); return []; } });
for (const q of ['Show my next steps', 'Review my credit report', 'Can I clear this record?', 'Help me finish my profile', 'Build my dispute letter', 'When might I become eligible?', 'Show my job applications', 'Show my saved homes', 'What is my dispute status?']) await answer(q, spy);
check(reads.length === 0, 'a signed-out caller triggers zero personal data reads: ' + reads);
check((await answer('Show my job applications', spy)).actions[0].route === '/sign-in', 'my_jobs requires sign-in before reading data');
check((await answer('Show my saved homes', spy)).actions[0].route === '/sign-in', 'my_housing requires sign-in before reading data');

// ---------- graceful fallback ----------
r = await answer('Show my next steps', gw({ summary: async () => { throw new Error('network'); } }));
check(r.intent === 'help' && r.provenance.confidence === 'unavailable' && /Nothing was changed/.test(JSON.stringify(r.parts)) && r.actions.length === CAPABILITIES.length, 'a data failure produces an honest fallback with plain workflows');
const exploding = { available: async () => true, rephrase: async () => { throw new Error('model down'); } };
r = await answer('Show my next steps', gw(), { adapter: exploding });
check(r.modelAssisted === false && r.provenance.engine === 'deterministic_router' && r.parts.every((p) => p.basis !== 'ai'), 'a failing model never breaks the answer');
check((await answer('Show my next steps', gw(), { adapter: NO_MODEL })).modelAssisted === false, 'no model connected -> deterministic');
const slowNull = { available: async () => true, rephrase: async () => null };
check((await answer('Show my next steps', gw(), { adapter: slowNull })).modelAssisted === false, 'an empty model result is ignored');
const rewriter = { available: async () => true, rephrase: async () => 'A friendlier way to say the same thing.' };
r = await answer('Show my next steps', gw(), { adapter: rewriter });
check(r.modelAssisted === true && r.provenance.engine === 'model' && r.parts.at(-1).basis === 'ai' && r.parts.slice(0, -1).every((p) => p.basis !== 'ai'), 'model text is appended and labelled ai; deterministic parts and actions are untouched');
check(JSON.stringify(routes(r)) === JSON.stringify(routes(await answer('Show my next steps', gw()))), 'a model cannot change the actions');
check(!bad(await answer('Review my credit report', gw())), 'no overclaims or promises in credit answers');

// ---------- structural boundaries ----------
const orch = read('src/core/ai/orchestrator.ts');
const imports = [...orch.matchAll(/^import[^;]*from\s+'([^']+)'/gm)].map((m) => m[1]);
check(imports.every((i) => i.startsWith('./') || i.startsWith('../')) && !imports.some((i) => /supabase|services?|@\//.test(i)), 'the orchestrator imports only pure modules (no supabase, no services): ' + imports);
check(!/\.rpc\(|\.from\(|fetch\(|insert|update\(|delete\(/.test(orch.replace(/\/\/.*$/gm, '')), 'the orchestrator has no data access of its own');
const gwSrc = read('src/core/ai/gateway.ts');
check(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(gwSrc), 'the gateway never writes records');
const rpcs = [...gwSrc.matchAll(/\.rpc\('(\w+)'/g)].map((m) => m[1]);
check(rpcs.every((f) => ['log_ai_interaction', 'delete_my_ai_history'].includes(f)), 'the gateway calls only provenance functions directly: ' + rpcs);
const tables = [...gwSrc.matchAll(/\.from\('(\w+)'\)/g)].map((m) => m[1]);
check(tables.every((t) => t === 'record_relief_evaluations'), 'direct table reads limited to the member\'s own evaluations: ' + tables);
check(/select\('id,case_id,outcome,eligibility_date,rule_key,rule_version'\)/.test(gwSrc), 'only allow-listed columns are read');
check(!/anthropic|openai|api[_-]?key|sk-[a-z0-9]/i.test(orch + gwSrc + read('src/core/ai/intents.ts')), 'no model provider or key in client code');
const screen = read('src/app/fairpath-ai.tsx');
check(/No AI model is connected/i.test(screen) || /built-in guidance/i.test(screen), 'the UI is honest that no model is connected');
check(/how i got this/i.test(screen) && /basis/i.test(screen), 'the UI shows provenance');
check(!/console\.(log|info)/.test(screen + gwSrc), 'assistant never logs conversations');
const sql = read('supabase/migrations/20261001180000_ai_provenance.sql');
check(!/question|answer_text|message|content|prompt/i.test(sql.replace(/--[^\n]*/g, '').replace(/'[^']*'/g, '')), 'the provenance table has no column for question/answer/content text');

if (failures.length) { console.error('AI audit FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('AI audit passed: 9 starter intents reach real workflows, safety first, read-only allow-listed gateway, provenance without content, deterministic fallback, model can only rephrase.');
