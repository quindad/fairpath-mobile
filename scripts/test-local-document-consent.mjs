// Local SQL: record_document_consent must sync profiles.*_accepted_* (accept-terms loop fix). `npm run test:sql:consent`
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) {
  console.error('Migrations failed locally:', errors);
  process.exit(1);
}

const M = await addUser(db, 'consent@test.local');
const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error}`);
  return r.rows;
};

await test('record_document_consent writes ledger rows and updates profile pointers', async () => {
  await db.query(
    `update public.profiles set terms_accepted_at = null, terms_accepted_version = null,
     privacy_accepted_at = null, privacy_accepted_version = null where id = $1`,
    [M],
  );
  must(await tryAs(db, M, `select public.record_document_consent('terms_accepted', 'v1', true)`), 'terms rpc');
  must(await tryAs(db, M, `select public.record_document_consent('privacy_accepted', 'v1', true)`), 'privacy rpc');
  const profile = (
    await db.query(
      `select terms_accepted_at, terms_accepted_version, privacy_accepted_at, privacy_accepted_version
       from public.profiles where id = $1`,
      [M],
    )
  ).rows[0];
  ok(profile.terms_accepted_at && profile.terms_accepted_version === 'v1', 'terms profile pointers');
  ok(profile.privacy_accepted_at && profile.privacy_accepted_version === 'v1', 'privacy profile pointers');
  const events = (
    await db.query(
      `select event_type, document_version, granted from public.consent_events where user_id = $1 order by event_type`,
      [M],
    )
  ).rows;
  ok(events.length === 2 && events.every((e) => e.granted !== false && e.document_version === 'v1'), 'ledger rows');
});

await test('members cannot forge consent for another account', async () => {
  const N = await addUser(db, 'other@test.local');
  const r = await tryAs(db, N, `select public.record_document_consent('terms_accepted', 'v1', true)`);
  ok(!r.error, 'rpc runs as self');
  const victim = (await db.query(`select terms_accepted_at from public.profiles where id = $1`, [M])).rows[0];
  const nProfile = (await db.query(`select terms_accepted_at from public.profiles where id = $1`, [N])).rows[0];
  ok(victim.terms_accepted_at && nProfile.terms_accepted_at, 'each user has own consent');
});

done();
