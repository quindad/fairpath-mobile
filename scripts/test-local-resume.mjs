// Local (PGlite) SQL suite for Resume Studio. `npm run test:sql:resume`
import { addUser, createLocalDb, tryAs } from './lib/local-db.mjs';
import { makeRunner } from './lib/local-fixtures.mjs';

const { test, ok, done } = makeRunner();
const { db, errors } = await createLocalDb();
if (errors.length) { console.error('Migrations failed locally:', errors); process.exit(1); }
const M = await addUser(db, 'm@test.local');
const N = await addUser(db, 'n@test.local');
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const denied = (r, text, what) => ok(r.error && r.error.includes(text), `${what}: expected "${text}", got ${JSON.stringify(r.error ?? r.rows).slice(0, 220)}`);
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.rows; };

await test('a member can create, read, update and delete only their own resumes', async () => {
  const c = must(await tryAs(db, M, `insert into public.member_resumes (user_id, title, target_role, content) values ($1, 'Warehouse resume', 'Warehouse Associate', '{"summary":"Hard worker."}'::jsonb) returning *`, [M]), 'insert');
  ok(c[0].title === 'Warehouse resume' && c[0].id, 'created');
  const nRead = must(await tryAs(db, N, `select * from public.member_resumes where id = $1`, [c[0].id]), 'n select');
  ok(nRead.length === 0, "N must not see M's resume");
  const upd = must(await tryAs(db, M, `update public.member_resumes set title = 'Updated title' where id = $1 returning title, updated_at`, [c[0].id]), 'update');
  ok(upd[0].title === 'Updated title', 'update works');
  const nUpd = must(await tryAs(db, N, `update public.member_resumes set title = 'hacked' where id = $1 returning id`, [c[0].id]), 'n update attempt');
  ok(nUpd.length === 0, "N's update affects zero rows (RLS), never M's row");
  must(await tryAs(db, M, `delete from public.member_resumes where id = $1`, [c[0].id]), 'delete');
  ok((await one('select count(*)::int as n from public.member_resumes where id = $1', [c[0].id])).n === 0, 'deleted');
});

await test('guests cannot read or write resumes at all', async () => {
  const r = await tryAs(db, 'anon', `select * from public.member_resumes`);
  ok(r.error && r.error.includes('permission denied'), 'guest select denied: ' + JSON.stringify(r.error));
  const w = await tryAs(db, 'anon', `insert into public.member_resumes (user_id, title) values ($1, 'x')`, [M]);
  ok(w.error, 'guest insert denied');
});

await test('content is bounded: must be a JSON object, and oversized content is rejected', async () => {
  denied(await tryAs(db, M, `insert into public.member_resumes (user_id, content) values ($1, '[]'::jsonb)`, [M]), 'check', 'array content rejected');
  const huge = JSON.stringify({ summary: 'x'.repeat(25000) });
  denied(await tryAs(db, M, `insert into public.member_resumes (user_id, content) values ($1, $2::jsonb)`, [M, huge]), 'check', 'oversized content rejected');
});

await test('duplicate_resume() creates an independent copy, never a live reference', async () => {
  const c = must(await tryAs(db, M, `insert into public.member_resumes (user_id, title, content) values ($1, 'Original', '{"summary":"A"}'::jsonb) returning id`, [M]), 'insert')[0];
  const dup = must(await tryAs(db, M, 'select * from public.duplicate_resume($1)', [c.id]), 'duplicate')[0];
  ok(dup.id !== c.id && dup.title === 'Original (copy)' && JSON.stringify(dup.content) === '{"summary":"A"}', 'duplicated: ' + JSON.stringify(dup));
  await db.query(`update public.member_resumes set content = '{"summary":"Changed"}'::jsonb where id = $1`, [c.id]);
  const after = await one('select content from public.member_resumes where id = $1', [dup.id]);
  ok(JSON.stringify(after.content) === '{"summary":"A"}', 'editing the original must not change the duplicate');
  denied(await tryAs(db, N, 'select * from public.duplicate_resume($1)', [c.id]), 'RESUME_UNAVAILABLE', "N cannot duplicate M's resume");
});

await test('a soft per-member limit exists (RESUME_LIMIT), and it is per member', async () => {
  for (let i = 0; i < 20; i++) must(await tryAs(db, N, `insert into public.member_resumes (user_id, title) values ($1, $2)`, [N, 'r' + i]), 'fill');
  denied(await tryAs(db, N, `insert into public.member_resumes (user_id, title) values ($1, 'one too many')`, [N]), 'RESUME_LIMIT', '21st resume for N');
  must(await tryAs(db, M, `insert into public.member_resumes (user_id, title) values ($1, 'still fine')`, [M]), "M's own count is unaffected by N's limit");
});

await test('deleting a member cascades their resumes', async () => {
  const del = await addUser(db, 'del@test.local');
  must(await tryAs(db, del, `insert into public.member_resumes (user_id, title) values ($1, 'temp')`, [del]), 'insert');
  await db.query('delete from auth.users where id = $1', [del]);
  ok((await one('select count(*)::int as n from public.member_resumes where user_id = $1', [del])).n === 0, 'cascaded');
});

done('Resume Studio');
