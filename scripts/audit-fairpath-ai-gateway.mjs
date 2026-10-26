import fs from 'node:fs';

const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

check(fs.existsSync('supabase/functions/fairpath-ai-gateway/index.ts'), 'fairpath-ai-gateway Edge Function must exist.');
const edge = fs.readFileSync('supabase/functions/fairpath-ai-gateway/index.ts', 'utf8');
check(/auth\.getUser/.test(edge), 'Gateway must authenticate members.');
check(!/runSignalCall/.test(edge), 'Orchestration gateway must not spend AI credits.');
check(/modelAssisted:\s*false/.test(edge), 'Gateway response must not claim model assistance.');
check(/search_jobs/.test(edge) && /search_resources/.test(edge), 'Gateway must execute RLS-backed read tools.');

const client = fs.readFileSync('src/core/ai/fairpath-ai-gateway-client.ts', 'utf8');
check(/fairpath-ai-gateway/.test(client), 'Client must invoke fairpath-ai-gateway.');

if (failures.length) {
  console.error('FairPath AI gateway audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('FairPath AI gateway audit passed.');
