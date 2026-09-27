// Member hub / privacy / documents audit. `npm run test:member`
import fs from 'node:fs';
import * as ns from '../src/core/profile/next-step.ts';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// ---------- Next Step rules ----------
check(ns.nextSteps(null).length === 0 && ns.primaryNextStep(undefined) === null, 'no summary -> no steps (never invent one)');
const empty = { jobs: { applied: 0, saved: 0 }, housing: { drafts: 0 }, resources: { saved: 0, started: 0, completed: 0, unavailable_saved: 0 }, profile: { completed_sections: 0, total_sections: 8, next_section: 'contact' }, documents: { expiring_soon: 0 }, plus: { active: false } };
const s0 = ns.nextSteps(empty);
check(s0[0].key === 'profile_contact' && s0[0].route === '/opportunity-profile/contact', 'a brand-new member is guided to the first profile section: ' + s0[0].key);
check(s0.some((x) => x.key === 'find_resources'), 'discovery is offered when nothing is saved');
check(!s0.some((x) => x.key === 'find_jobs'), 'job search is not pushed before the profile has basics');
const full = { ...empty, profile: { completed_sections: 8, total_sections: 8, next_section: null }, resources: { saved: 2 }, jobs: { applied: 1 } };
check(ns.nextSteps(full).length === 0, 'a member with nothing outstanding gets no manufactured step');
const urgent = { ...empty, profile: { completed_sections: 5, total_sections: 8, next_section: 'preferences' }, housing: { drafts: 1 }, documents: { expiring_soon: 1 }, resources: { saved: 1, unavailable_saved: 1 },
  plus: { active: true, complimentary: true, days_remaining: 9 }, credit: { response_due_soon: 1, items_to_review: 3 }, record_relief: { eligible_now: 1, countdowns_due_soon: 1, rule_updates: 1 } };
const keys = ns.nextSteps(urgent).map((x) => x.key);
check(keys.join() === 'credit_response_due,rr_eligible_now,rr_rule_update,credit_review,rr_countdown_soon,plus_ending,document_expiring,saved_unavailable,housing_draft,profile_preferences,find_jobs', 'rule order is fixed and explainable: ' + keys.join());
check(JSON.stringify(ns.nextSteps(urgent)) === JSON.stringify(ns.nextSteps(JSON.parse(JSON.stringify(urgent)))), 'deterministic');
check(ns.nextSteps(urgent).every((x) => x.reason && x.route.startsWith('/') && x.title && x.body), 'every step names its trigger and a real route');
check(!/\bAI\b|smart|personalized for you|we think|recommended for you/i.test(read('src/core/profile/next-step.ts').replace(/\/\/[^\n]*/g, '')), 'Next Step wording must not pretend to be AI or personalization');
check(ns.nextSteps({ plus: { active: true, days_remaining: 30 } }).every((x) => x.key !== 'plus_ending'), 'FairPath+ warning only within 14 days');

// ---------- /me ----------
const me = read('src/app/me.tsx');
check(!/profile-readiness[\s\S]{0,120}Privacy|Privacy[\s\S]{0,120}profile-readiness/.test(me), 'the Privacy link must not point at Profile Readiness');
check(/'\/privacy'/.test(me) && /Privacy and account/.test(me), '/me links to the real Privacy screen');
check(/loadMemberSummary/.test(me) && !/\.from\('/.test(me), '/me metrics come from the server summary, never client-side table counts');
check(!/(fake|sample|lorem|placeholder)/i.test(me), 'no placeholder content on /me');
check(!/Resume Studio|resume status/i.test(me), 'no fake resume status');

// ---------- Privacy ----------
const priv = read('src/app/privacy.tsx');
check(/has NOT been deleted/.test(priv), 'the deletion request must say the account has NOT been deleted');
check(!/account (has been|was|is now) deleted|deleted your account|your account is deleted/i.test(priv), 'must never claim deletion happened');
check(/request_account_deletion|requestAccountDeletion/.test(priv) && /cancelAccountDeletion/.test(priv), 'request + cancel wired');
for (const who of ['Employers', 'Landlords and housing partners', 'Your documents', 'Your justice-related information']) check(priv.includes(who), `privacy explains ${who}`);
check(/FairPath cannot recall/.test(priv), 'the UI must say exported files cannot be recalled');
const ms = read('src/core/profile/member-summary.ts');
check(/get_member_home_summary/.test(ms) && /get_account_deletion_status/.test(ms), 'summary + deletion status are server functions');

// ---------- documents client ----------
const docSvc = read('src/core/documents/document-service.ts');
const tables = [...docSvc.matchAll(/\.from\('(\w+)'\)/g)].map((m) => m[1]);
check(tables.every((t) => t === 'generated_documents'), 'document service reads only generated_documents directly: ' + tables);
check(!/insert\(|update\(|delete\(/.test(docSvc.replace(/\/\/[^\n]*/g, '')), 'document rows are written only through functions');
check(/createSignedUrl\(path, 60\)/.test(docSvc), 'signed URLs are short-lived (60s)');
check(!/getPublicUrl|public: true/.test(docSvc), 'no public URLs');
const deliverNative = read('src/core/documents/deliver.ts');
const deliverWeb = read('src/core/documents/deliver.web.ts');
check(/expo-sharing/.test(deliverNative) && /expo-print/.test(deliverNative) && !/expo-sharing|expo-print|expo-file-system/.test(deliverWeb), 'native modules stay out of the web bundle');
check(/temp\?\.delete\(\)/.test(deliverNative), 'temp files are deleted after hand-off');
check(!/console\.(log|info|debug)/.test(docSvc + deliverNative + deliverWeb + read('src/core/documents/generate.ts')), 'document code never logs');
const gen = read('src/core/documents/generate.ts');
check(/generated_by|generatedBy/.test(gen) && /'device'/.test(gen), 'device-generated documents are labelled');
check(!/p_official_form_ref: (?!null)|officialFormRef\s*[:=]\s*\{/.test(gen + docSvc),'the client never sets an official form reference');
const create = read('src/app/documents/create.tsx');
check(/cannot recall/.test(create) && /PREPARED ON THIS DEVICE/.test(create), 'create screen states the recall limit and the generation source');
check(/logDocumentExport/.test(create), 'export actions are logged (metadata only)');

// ---------- Edge shared copies in sync ----------
const { SYNC } = await import('./sync-edge-shared.mjs');
for (const [from, to] of SYNC) {
  const a = fs.existsSync(to) ? read(to) : null;
  check(a === read(from), `Edge shared copy out of sync: ${to} (run: node scripts/sync-edge-shared.mjs)`);
}

if (failures.length) { console.error('Member audit FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('Member audit passed: deterministic Next Step, real summary, honest deletion language, private document client, shared Edge code in sync.');
