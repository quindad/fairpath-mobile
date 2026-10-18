// Credit + FairPath+ member app loop (092–100). `npm run test:credit-member`
import fs from 'node:fs';

const failures = [];
const check = (c, m) => {
  if (!c) failures.push(m);
};
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const creditIndex = read('src/app/credit/index.tsx');
const creditTools = read('src/app/credit-tools.tsx');
const plus = read('src/app/plus.tsx');
const signal = read('src/core/ai/signal.ts');
const billing = read('src/core/billing/billing-provider.ts');

check(fs.existsSync('src/app/credit/index.tsx'), 'Credit hub route must exist.');
check(/dispute|report|upload/i.test(creditIndex + creditTools), 'Credit surfaces must link to report review and disputes.');
check(!/will raise your score|guaranteed removal/i.test(creditIndex + creditTools + plus), 'Member credit copy must not promise outcomes.');
check(/draftDisputeLetter|credit-report-explanation/.test(signal), 'Signal must expose credit workflows via Edge Functions.');
check(/usePlusStatus|my_fairpath_plus_status|getBillingProvider/.test(plus), 'FairPath+ must read server status and billing provider.');
check(/not_configured|FAIRPATH_PLUS_STORE_NOTE|configured/.test(plus + billing), 'Billing must be honest when the store is not connected.');
check(/restorePurchases/.test(plus), 'FairPath+ must offer restore without faking success.');

if (failures.length) {
  console.error('Credit member audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Credit member audit passed: Credit hub, Signal hooks, FairPath+ honesty boundaries.');
