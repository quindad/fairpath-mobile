// Static contract for Priority 5 journey: jobs + transportation near member location.
import fs from 'node:fs';
import { planReadToolsForQuestion } from '../src/core/signal/signal-tool-plan.ts';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const q = 'I need a job and transportation near me';
const plan = planReadToolsForQuestion(q, 'find_jobs');
check(plan.some((p) => p.toolId === 'search_jobs'), 'journey must plan job search');
check(plan.some((p) => p.toolId === 'search_resources'), 'journey must plan transportation/resources search');

const orch = fs.readFileSync('src/core/signal/signal-orchestrator.ts', 'utf8');
check(/loadMemberSearchLocation/.test(orch), 'orchestrator must resolve shared member location');
check(/resultCards/.test(orch), 'orchestrator must emit result cards');

const ui = fs.readFileSync('src/app/fairpath-ai.tsx', 'utf8');
check(/SignalTurn/.test(ui) && /resultCards/.test(fs.readFileSync('src/components/signal/SignalMessageBubble.tsx', 'utf8')), 'UI must render result cards');

const gateway = fs.readFileSync('supabase/functions/fairpath-ai-gateway/index.ts', 'utf8');
check(/search_jobs/.test(gateway) && /search_resources/.test(gateway), 'gateway must allowlist job + resource tools');
check(!/runSignalCall/.test(gateway), 'gateway must not spend Signal credits');

check(fs.existsSync('src/core/location/member-search-location.ts'), 'shared location loader must exist');

if (failures.length) {
  console.error('Signal member journey audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Signal member journey audit passed (static): multi-need plan, location stack, cards, gateway tools.');
