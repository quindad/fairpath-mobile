import assert from 'node:assert/strict';
import test from 'node:test';
import { validateExtraction, last4Only } from '../src/core/credit/extraction.ts';
import { signalPlainText } from '../src/core/ai/signal-plain-text.ts';
import { explainAccountConfirmCounts } from '../src/core/credit-studio/workspace-summary.ts';

/** Synthetic Experian-shaped expectations — no real PII. */
test('48 account detail pages validate without merge (distinct open dates)', () => {
  const accounts = Array.from({ length: 48 }, (_, i) => ({
    furnisher_name: i < 5 ? 'Capital One' : `Creditor ${i}`,
    account_type: 'revolving',
    account_number: `5000${String(1000 + i).slice(-4)}`,
    payment_status: i < 27 ? 'current' : 'paid_closed',
    opened_date: `201${(i % 9) + 1}-0${(i % 8) + 1}-15`,
    balance_cents: i === 47 ? 52500 : 0,
    credit_limit_cents: 100000,
    is_collection: false,
    is_charged_off: false,
  }));
  const out = validateExtraction({ bureau: 'experian', report_date: '2026-10-26', accounts, inquiries: [] });
  assert.equal(out.ok, true);
  if (!out.ok) return;
  assert.equal(out.payload.accounts.length, 48);
  const cap = out.payload.accounts.filter((a) => a.furnisher_name === 'Capital One');
  assert.equal(cap.length, 5);
  assert.equal(new Set(cap.map((a) => a.opened_date)).size, 5, 'same creditor with different open dates stay distinct');
});

test('Verizon-shaped settled negative keeps last4 and settled status', () => {
  const out = validateExtraction({
    bureau: 'experian',
    accounts: [
      {
        furnisher_name: 'Verizon Wireless',
        account_type: 'other',
        account_number: '****1234',
        payment_status: 'settled',
        status_text: 'Settled',
        balance_cents: 52500,
        is_collection: false,
        is_charged_off: false,
      },
    ],
    inquiries: [],
  });
  assert.equal(out.ok, true);
  if (!out.ok) return;
  assert.equal(out.payload.accounts[0].payment_status, 'settled');
  assert.equal(out.payload.accounts[0].balance_cents, 52500);
  assert.equal(last4Only('****1234'), '1234');
});

test('signalPlainText removes Markdown asterisks', () => {
  assert.equal(signalPlainText('**Balance** is reported'), 'Balance is reported');
});

test('account confirm counter explains 48 total vs 47 to confirm', () => {
  assert.match(explainAccountConfirmCounts(48, 47), /already confirmed.*47 still need/i);
  assert.match(explainAccountConfirmCounts(48, 0), /Every tracked account/i);
});
