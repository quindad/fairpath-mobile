// Applies all migrations to a throwaway local Postgres and reports failures. `npm run test:sql`
import { createLocalDb } from './lib/local-db.mjs';

const { db, errors, skipped } = await createLocalDb({ quiet: false });
if (errors.length) {
  console.error(`\n${errors.length} migration(s) failed to apply locally:`);
  for (const e of errors) console.error(` - ${e.file}: ${e.message}`);
  process.exit(1);
}
const t = await db.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'");

const hardenedFunctions = [
  'credit_norm',
  'document_file_name',
  'document_safe_token',
  'entitlement_audit_log_immutable',
  'member_meetings_touch',
  'member_profile_validate',
  'member_resumes_limit',
  'member_resumes_touch',
  'member_row_cap',
  'referral_events_block_change',
  'resource_verification_events_block_change',
  'resources_touch_updated_at',
];
const searchPath = await db.query(`
  select p.proname, p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any($1::text[])
` , [hardenedFunctions]);
const missingSearchPath = searchPath.rows.filter(
  (row) => !row.proconfig?.some((setting) => /^search_path=pg_catalog,\s*public$/.test(setting)),
);
if (searchPath.rows.length !== hardenedFunctions.length || missingSearchPath.length) {
  const names = missingSearchPath.map((row) => row.proname).join(', ');
  console.error(`Database function search_path hardening is incomplete: ${names || 'one or more functions are missing'}.`);
  process.exit(1);
}

const exposedInternalFunctions = await db.query(`
  select p.oid::regprocedure::text as signature
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
    and (
      has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute')
    )
`);
if (exposedInternalFunctions.rows.length) {
  console.error(`Internal trigger functions remain API-callable: ${exposedInternalFunctions.rows.map((row) => row.signature).join(', ')}.`);
  process.exit(1);
}

console.log(`\nAll locally applicable migrations applied on Postgres. ${t.rows[0].n} public tables; ${skipped.length} hosted evidence migration(s) explicitly skipped.`);
