// Local (PGlite) SQL suite for the meetings/appointment layer. `npm run test:sql:meetings`
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }
const M = await addUser(db, 'm@test.local');
const N = await addUser(db, 'n@test.local');
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };
const denied = (r, text, what) => ok(r.error && r.error.includes(text), `${what}: expected "${text}", got ${JSON.stringify(r.error ?? r.rows).slice(0, 220)}`);
const iso = (daysFromNow) => new Date(Date.now() + daysFromNow * 86400000).toISOString();

const insert = (who, o = {}) => tryAs(db, who, `insert into public.member_meetings (user_id, title, meeting_type, provider, meeting_url, start_at) values ($1,$2,$3,$4,$5,$6) returning *`,
  [who === M ? M : N, o.title ?? 'Interview with Acme', o.type ?? 'employer_interview', o.provider ?? 'zoom', o.url ?? 'https://zoom.us/j/12345', o.start ?? iso(3)]);

await test('a member can create a meeting; owner-only read/update/delete', async () => {
  const c = must(await insert(M), 'insert')[0];
  ok(c.status === 'scheduled' && c.title === 'Interview with Acme', 'created with default status');
  const nRead = must(await tryAs(db, N, 'select * from public.member_meetings where id = $1', [c.id]), 'n select');
  ok(nRead.length === 0, "N must not see M's meeting");
  const nUpd = must(await tryAs(db, N, `update public.member_meetings set title = 'hacked' where id = $1 returning id`, [c.id]), 'n update attempt');
  ok(nUpd.length === 0, "N's update affects zero rows");
  const mUpd = must(await tryAs(db, M, `update public.member_meetings set title = 'Rescheduled interview' where id = $1 returning title`, [c.id]), 'm update');
  ok(mUpd[0].title === 'Rescheduled interview', 'owner can update');
});

await test('guests cannot read or write meetings', async () => {
  const r = await tryAs(db, 'anon', 'select * from public.member_meetings');
  ok(r.error && r.error.includes('permission denied'), 'guest select denied');
  const w = await tryAs(db, 'anon', `insert into public.member_meetings (user_id, title, meeting_type, start_at) values ($1, 'x', 'other', now())`, [M]);
  ok(w.error, 'guest insert denied');
});

await test('bad meeting URLs and invalid types/providers are rejected by the schema', async () => {
  denied(await insert(M, { url: 'not-a-url' }), 'check', 'non-URL meeting_url rejected');
  denied(await tryAs(db, M, `insert into public.member_meetings (user_id, title, meeting_type, start_at) values ($1,'x','fake_type',now())`, [M]), 'check', 'invalid meeting_type rejected');
  denied(await tryAs(db, M, `insert into public.member_meetings (user_id, title, meeting_type, provider, start_at) values ($1,'x','other','fake_provider',now())`, [M]), 'check', 'invalid provider rejected');
  denied(await tryAs(db, M, `insert into public.member_meetings (user_id, title, meeting_type, start_at, end_at) values ($1,'x','other',now(), now() - interval '1 hour')`, [M]), 'check', 'end before start rejected');
});

await test('set_meeting_status() only allows sensible transitions, and only for the owner', async () => {
  const c = must(await insert(M), 'insert')[0];
  denied(await tryAs(db, M, 'select * from public.set_meeting_status($1, $2, null)', [c.id, 'completed']), 'INVALID_TRANSITION', 'cannot jump straight to completed');
  const confirmed = must(await tryAs(db, M, 'select * from public.set_meeting_status($1, $2, null)', [c.id, 'confirmed']), 'confirm')[0];
  ok(confirmed.status === 'confirmed', 'scheduled -> confirmed');
  const done1 = must(await tryAs(db, M, 'select * from public.set_meeting_status($1, $2, null)', [c.id, 'completed']), 'complete')[0];
  ok(done1.status === 'completed', 'confirmed -> completed');
  denied(await tryAs(db, M, 'select * from public.set_meeting_status($1, $2, null)', [c.id, 'scheduled']), 'INVALID_TRANSITION', 'cannot go backward from completed');
  const c2 = must(await insert(M), 'insert 2')[0];
  const cancelled = must(await tryAs(db, M, 'select * from public.set_meeting_status($1, $2, $3)', [c2.id, 'cancelled', 'Rescheduled by employer']), 'cancel')[0];
  ok(cancelled.status === 'cancelled' && cancelled.cancelled_reason === 'Rescheduled by employer', 'cancel with reason');
  denied(await tryAs(db, N, 'select * from public.set_meeting_status($1, $2, null)', [c2.id, 'confirmed']), 'MEETING_UNAVAILABLE', "N cannot change M's meeting status");
});

await test('deleting a member cascades their meetings', async () => {
  const del = await addUser(db, 'del@test.local');
  must(await tryAs(db, del, `insert into public.member_meetings (user_id, title, meeting_type, start_at) values ($1,'temp','other',now())`, [del]), 'insert');
  await db.query('delete from auth.users where id = $1', [del]);
  ok((await one('select count(*)::int as n from public.member_meetings where user_id = $1', [del])).n === 0, 'cascaded');
});

done('Meetings');
