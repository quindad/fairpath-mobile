import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const NODE = process.execPath;
const checks = [
 ['TypeScript', 'npx', ['tsc','--noEmit'], true],
 ['Node regression suite', NODE, ['--test','tests/*.test.ts']],
 ['Notification database contract', NODE, ['scripts/test-local-notification-delivery.mjs']],
 ['Notification worker mocks', NODE, ['scripts/test-notification-worker.mjs']],
 ['Notification receipt mocks', NODE, ['scripts/test-notification-receipt-worker.mjs']],
 ['Jobs end to end', NODE, ['scripts/test-local-jobs-e2e.mjs']],
 ['Housing required documents', NODE, ['scripts/test-local-housing-documents.mjs']],
 ['Marketplace lifecycle', NODE, ['scripts/test-local-marketplace.mjs']],
 ['Member account database', NODE, ['scripts/test-local-member.mjs']],
 ['Cross-account isolation', NODE, ['scripts/test-local-cross-member-isolation.mjs']],
 ['Auth audit', NODE, ['scripts/audit-auth.mjs']],
 ['Native configuration audit', NODE, ['scripts/audit-native-readiness.mjs']],
 ['Navigation audit', NODE, ['scripts/audit-navigation.mjs']],
 ['Security audit', NODE, ['scripts/audit-security.mjs']],
 ['Nationwide Record Relief smoke', NODE, ['scripts/test-record-relief-nationwide-smoke.mjs']],
];

const results=[];
for(const [name,cmd,args,shell=false] of checks){
 const started=Date.now();
 const run=spawnSync(cmd,args,{encoding:'utf8',shell,timeout:600000});
 const output=(run.stdout+run.stderr).trim();
 results.push({name,passed:run.status===0,seconds:((Date.now()-started)/1000).toFixed(1),tail:output.split(/\r?\n/).slice(-8).join('\n')});
 console.log(`${run.status===0?'PASS':'FAIL'} ${name}`);
}

const blockers=[
 'Real push delivery still requires a configured DEV worker secret, deployed DEV function, push credentials, and a supported device.',
 'Independent qualified legal review remains required before Record Relief filing data can be published.',
];
const untested=[
 'Real APNs/FCM delivery and notification taps on physical iOS and Android devices.',
 'Jobs network interruption during submission and document-specific job requirements (no job document gate exists).',
 'Housing payment failure/cancellation against a provider sandbox in this offline command.',
 'Account recovery email delivery and universal-link return on physical devices.',
];
const failed=results.filter(x=>!x.passed);
const lines=[
 '# FairPath Mobile V1 release-readiness report', '',
 `Generated: ${new Date().toISOString()}`, '',
 `Automated result: ${results.length-failed.length}/${results.length} checks passed.`, '',
 '| Check | Result | Seconds |','|---|---:|---:|',
 ...results.map(x=>`| ${x.name} | ${x.passed?'PASS':'FAIL'} | ${x.seconds} |`), '',
 '## Release-blocking defects','',...blockers.map(x=>'- '+x),'',
 '## Untested or externally verified journeys','',...untested.map(x=>'- '+x),'',
 '## Evidence limits','',
 '- Notification provider success, rejection, timeout, and outage checks use a mocked Expo API. They do not prove device delivery.',
 '- SQL suites use local Postgres migrations and prove database behavior and row isolation. Hosted DEV checks remain separate.',
 '- Housing physical Storage deletion has separate DEV proof; the required-document suite validates Storage metadata presence locally.',
];
if(failed.length){lines.push('','## Failed output','');for(const x of failed)lines.push(`### ${x.name}`,'','```text',x.tail,'```','');}
fs.writeFileSync('docs/RELEASE_READINESS_REPORT_2026-10-08.md',lines.join('\n')+'\n');
console.log(`Report: docs/RELEASE_READINESS_REPORT_2026-10-08.md`);
process.exit(failed.length?1:0);
