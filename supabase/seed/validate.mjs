// Offline validation of the seed inventory against the REAL production schema (committed exports):
//   supabase/baseline/source/production_columns.csv      -> columns, NOT NULL, defaults, types
//   supabase/baseline/source/production_definitions.csv  -> CHECK enumerations, unique keys
// Used by the runner (fail fast before any write) and by scripts/audit-seed.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, parseCsvObjects } from '../baseline/csv.mjs';
import { isUuid, uuidv5 } from './lib/uuid.mjs';
import { materializeJob, materializeListing } from './build-inventory.mjs';

const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../baseline/source');

function loadSchema(sourceDir = SOURCE) {
  const cols = parseCsvObjects(fs.readFileSync(path.join(sourceDir, 'production_columns.csv'), 'utf8'));
  const tables = {};
  for (const c of cols) {
    (tables[c.table_name] ||= {})[c.column_name] = { nullable: c.is_nullable === 'YES', hasDefault: c.column_default !== 'null', udt: c.udt_name };
  }
  const defs = JSON.parse(parseCsv(fs.readFileSync(path.join(sourceDir, 'production_definitions.csv'), 'utf8'))[1][0]);
  const enums = {};   // "table.column" -> Set(allowed)
  const subsets = {}; // "table.column" -> Set(allowed elements) for array <@ ARRAY[...] checks
  for (const c of defs.constraints) {
    if (c.type !== 'c') continue;
    const table = c.table.replace(/^public\./, '');
    let m = /^CHECK \(\(?\(?"?([a-z_]+)"? = ANY \(ARRAY\[(.+?)\]\)\)?\)?\)$/.exec(c.def);
    if (m) { enums[`${table}.${m[1]}`] = new Set([...m[2].matchAll(/'([^']*)'::text/g)].map((x) => x[1])); continue; }
    m = /^CHECK \(\(?"?([a-z_]+)"? <@ ARRAY\[(.+?)\]\)\)?$/.exec(c.def);
    if (m) subsets[`${table}.${m[1]}`] = new Set([...m[2].matchAll(/'([^']*)'::text/g)].map((x) => x[1]));
  }
  return { tables, enums, subsets };
}

function typeProblem(udt, v) {
  switch (udt) {
    case 'uuid': return typeof v === 'string' && isUuid(v) ? null : 'not a uuid';
    case 'text': return typeof v === 'string' ? null : 'not text';
    case '_text': return Array.isArray(v) && v.every((x) => typeof x === 'string') ? null : 'not text[]';
    case 'jsonb': return v !== undefined && typeof v === 'object' ? null : 'not json object/array';
    case 'bool': return typeof v === 'boolean' ? null : 'not boolean';
    case 'int4': case 'int8': return Number.isInteger(v) ? null : 'not an integer';
    case 'numeric': case 'float8': return typeof v === 'number' && Number.isFinite(v) ? null : 'not a number';
    case 'timestamptz': return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? null : 'not a timestamp';
    case 'date': return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : 'not a date (YYYY-MM-DD)';
    default: return `unhandled type ${udt}`;
  }
}

function checkRows(table, rows, schema, problems, label) {
  const cols = schema.tables[table];
  if (!cols) { problems.push(`${table}: table not found in production_columns.csv`); return; }
  rows.forEach((row, i) => {
    const where = `${label}[${i}]${row.title ? ` "${row.title}"` : row.offense_code ? ` ${row.offense_code}` : ''}`;
    for (const k of Object.keys(row)) if (!cols[k]) problems.push(`${where}: unknown column ${table}.${k}`);
    for (const [name, meta] of Object.entries(cols)) {
      const v = row[name];
      if (v === undefined || v === null) {
        if (!meta.nullable && !meta.hasDefault) problems.push(`${where}: NOT NULL column ${name} has no value and no default`);
        continue;
      }
      const tp = typeProblem(meta.udt, v);
      if (tp) problems.push(`${where}: ${name} ${tp} (${JSON.stringify(v).slice(0, 60)})`);
      const en = schema.enums[`${table}.${name}`];
      if (en && !en.has(v)) problems.push(`${where}: ${name}="${v}" violates CHECK (allowed: ${[...en].join(', ')})`);
      const sub = schema.subsets[`${table}.${name}`];
      if (sub && Array.isArray(v) && !v.every((x) => sub.has(x))) problems.push(`${where}: ${name} contains a value outside the allowed set (${[...sub].join(', ')})`);
    }
  });
}

/** Returns an array of problem strings (empty = valid). */
export function validateInventory(inv, { sourceDir } = {}) {
  const schema = loadSchema(sourceDir);
  const problems = [];
  const DUMMY = uuidv5('validation-dummy-user'); // a syntactically valid uuid, used ONLY for offline validation
  const NOW = Date.UTC(2026, 8, 26);

  checkRows('jobs', inv.jobs.map((j) => materializeJob(j, DUMMY, NOW)), schema, problems, 'jobs');
  checkRows('housing_listings', inv.listings.map((l) => materializeListing(l, DUMMY, NOW)), schema, problems, 'housing_listings');
  checkRows('housing_media', inv.media, schema, problems, 'housing_media');
  checkRows('offense_catalog', inv.offenses, schema, problems, 'offense_catalog');

  const dupes = (rows, f, name) => { const seen = new Set(); for (const r of rows) { const k = f(r); if (seen.has(k)) problems.push(`duplicate ${name}: ${k}`); seen.add(k); } };
  dupes(inv.jobs, (j) => j.id, 'job id');
  dupes(inv.listings, (l) => l.id, 'listing id');
  dupes(inv.media, (m) => m.id, 'media id');
  dupes(inv.offenses, (o) => `${o.jurisdiction_name}|${o.offense_code}|${o.effective_start}`, 'offense_catalog unique key');
  dupes(inv.users, (u) => u.email, 'seed account email');

  const employerKeys = new Set(inv.users.filter((u) => u.kind === 'employer').map((u) => u.key));
  const ownerKeys = new Set(inv.users.filter((u) => u.kind === 'owner').map((u) => u.key));
  for (const j of inv.jobs) if (!employerKeys.has(j._employerKey)) problems.push(`job "${j.title}" references unknown employer ${j._employerKey}`);
  for (const l of inv.listings) if (!ownerKeys.has(l._ownerKey)) problems.push(`listing "${l.title}" references unknown owner ${l._ownerKey}`);
  const listingIds = new Set(inv.listings.map((l) => l.id));
  for (const m of inv.media) if (!listingIds.has(m.listing_id)) problems.push(`media ${m.id} references unknown listing`);
  return problems;
}
