// Applies all migrations to a throwaway local Postgres and reports failures. `npm run test:sql`
import { createLocalDb } from './lib/local-db.mjs';

const { db, errors } = await createLocalDb({ quiet: false });
if (errors.length) {
  console.error(`\n${errors.length} migration(s) failed to apply locally:`);
  for (const e of errors) console.error(` - ${e.file}: ${e.message}`);
  process.exit(1);
}
const t = await db.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'");
console.log(`\nAll migrations applied on a local Postgres. ${t.rows[0].n} public tables.`);
