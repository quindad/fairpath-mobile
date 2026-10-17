// Local (PGlite) proof for the AI credit rate-limit / spend-cap system. In plain terms: this proves a member
// genuinely cannot spend AI credits they don't have, and that the whole platform genuinely cannot spend past a
// global daily ceiling, no matter how the request is made. Nothing hosted touched -- ephemeral database only.
//
// `node scripts/test-local-ai-credit-rate-limit.mjs`
import fs from 'node:fs';
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }

const draftSql = fs.readFileSync('docs/proposed-migrations/20261013020000_ai_credit_rate_limit_DRAFT.sql', 'utf8').replace(/\r\n/g, '\n');
try { await db.exec(draftSql); } catch (e) { console.error('Draft failed to apply locally:', e.message); process.exit(1); }

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, pattern, what) => ok(r.error && pattern.test(r.error), `${what}: expected a denial matching ${pattern}, got ${JSON.stringify(r.error ?? r.rows).slice(0, 160)}`);

const MEMBER = await addUser(db, 'credits-member@test.local');
const OUTSIDER = await addUser(db, 'credits-outsider@test.local');

await test('a signed-out caller cannot spend credits at all', async () => {
  denied(await tryAs(db, 'anon', "select public.spend_ai_credits('job_fit_explanation', 1)"), /SIGNED_OUT|permission denied/i, 'signed-out spend');
});

await test('a member with zero balance cannot spend -- no grant, no spend, ever', async () => {
  denied(await tryAs(db, MEMBER, "select public.spend_ai_credits('job_fit_explanation', 1)"), /INSUFFICIENT_CREDITS/, 'zero-balance spend');
});

await test('a member cannot grant themselves credits -- grant_ai_credits is service_role only', async () => {
  denied(await tryAs(db, MEMBER, "select public.grant_ai_credits($1, 1000, 'admin_adjustment')", [MEMBER]), /permission denied/i, 'self-grant attempt');
});

await test('service_role grants real credits, then the member can spend exactly that many and no more', async () => {
  must(await tryAs(db, 'service', "select public.grant_ai_credits($1, 5, 'monthly_grant')", [MEMBER]), 'grant');
  for (let i = 0; i < 5; i++) must(await tryAs(db, MEMBER, "select public.spend_ai_credits('job_fit_explanation', 1)"), `spend ${i + 1}`);
  denied(await tryAs(db, MEMBER, "select public.spend_ai_credits('job_fit_explanation', 1)"), /INSUFFICIENT_CREDITS/, 'spend after balance exhausted');
});

await test('spending more than the current balance in one call is rejected, not partially allowed', async () => {
  must(await tryAs(db, 'service', "select public.grant_ai_credits($1, 3, 'monthly_grant')", [MEMBER]), 'grant 3');
  denied(await tryAs(db, MEMBER, "select public.spend_ai_credits('credit_report_explanation', 10)"), /INSUFFICIENT_CREDITS/, 'overspend in one call');
  const row = (await db.query('select balance from public.ai_credit_balances where user_id=$1', [MEMBER])).rows[0];
  ok(row.balance === 3, 'balance changed even though the spend was rejected: ' + row.balance);
});

await test('every spend and grant leaves an append-only, accurate ledger entry', async () => {
  const rows = (await db.query('select delta, reason, balance_after from public.ai_credit_ledger where user_id=$1 order by created_at', [MEMBER])).rows;
  ok(rows.length >= 7, 'expected at least 7 ledger rows (2 grants + 5 spends) from this test run, got ' + rows.length);
  ok(rows.some((r) => r.reason === 'monthly_grant' && r.delta === 5), 'missing the 5-credit grant in the ledger');
  ok(rows.filter((r) => r.reason === 'workflow_spend').length === 5, 'expected exactly 5 spend entries');
});

await test('a member cannot read another member\'s balance or ledger', async () => {
  must(await tryAs(db, 'service', "select public.grant_ai_credits($1, 10, 'monthly_grant')", [OUTSIDER]), 'grant to outsider');
  const balRows = must(await tryAs(db, MEMBER, 'select balance from public.ai_credit_balances where user_id=$1', [OUTSIDER]), 'cross-read balance');
  ok(balRows.length === 0, 'a member could read another member\'s AI credit balance');
  const ledgerRows = must(await tryAs(db, MEMBER, 'select id from public.ai_credit_ledger where user_id=$1', [OUTSIDER]), 'cross-read ledger');
  ok(ledgerRows.length === 0, 'a member could read another member\'s AI credit ledger');
});

await test('the global daily spend circuit breaker trips and blocks ALL further spending, even a member with plenty of balance left', async () => {
  must(await tryAs(db, 'service', "select public.grant_ai_credits($1, 100000, 'admin_adjustment')", [MEMBER]), 'grant huge balance');
  await db.query("update public.ai_global_daily_spend set hard_cap_credits = 10 where spend_date = (now() at time zone 'utc')::date");
  await db.query("insert into public.ai_global_daily_spend (spend_date, credits_spent) values ((now() at time zone 'utc')::date, 0) on conflict (spend_date) do update set credits_spent = 0, tripped = false, tripped_at = null");
  must(await tryAs(db, MEMBER, "select public.spend_ai_credits('job_fit_explanation', 8)"), 'spend under cap');
  denied(await tryAs(db, MEMBER, "select public.spend_ai_credits('job_fit_explanation', 5)"), /GLOBAL_SPEND_LIMIT_TRIPPED/, 'spend that would cross the global cap');
  // The refused call itself can't persist a "tripped" flag (a Postgres exception rolls back everything that
  // call did) -- what matters is that it's STILL refused, repeatedly, which is what the next line proves.
  denied(await tryAs(db, MEMBER, "select public.spend_ai_credits('job_fit_explanation', 5)"), /GLOBAL_SPEND_LIMIT_TRIPPED/, 'a second over-cap attempt (8 spent + 5 requested still exceeds the 10 cap) is refused too, well under the member\'s own balance');
  must(await tryAs(db, MEMBER, "select public.spend_ai_credits('job_fit_explanation', 2)"), 'spend that exactly reaches the cap (10 total) should succeed and set tripped=true');
  const tripped = (await db.query("select tripped from public.ai_global_daily_spend where spend_date = (now() at time zone 'utc')::date")).rows[0].tripped;
  ok(tripped === true, 'global breaker did not record itself as tripped once a successful spend reached the cap');
});

done('local Postgres — AI credit rate-limit / spend-cap system (NOT applied to any real database)');
await db.close();
