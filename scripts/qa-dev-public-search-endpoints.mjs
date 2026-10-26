#!/usr/bin/env node
/** Anon-safe DEV probes: guest search_jobs + search_resources + gateway reachability. */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, readLinkedRef } from './lib/dev-qa-run.mjs';

const DEV_REF = 'znvhmuhojvwvjzmaqwff';
const env = loadEnvLocal();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const linkedRef = readLinkedRef();

const results = [];
const push = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  -> ' + detail : ''));
};

if (!url?.includes(DEV_REF) || linkedRef !== DEV_REF || !anonKey) {
  console.error('REFUSING: requires linked DEV .env.local');
  process.exit(1);
}

const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const zip = '43228';

const jobs = await client.rpc('search_jobs', {
  p_query: null,
  p_zip: zip,
  p_radius_miles: 25,
  p_location: null,
  p_remote: false,
  p_employment_type: null,
  p_second_chance: false,
  p_limit: 3,
  p_offset: 0,
  p_veteran_friendly: false,
});
push(
  'DEV anon search_jobs',
  !jobs.error && Array.isArray(jobs.data),
  jobs.error?.message ?? `${jobs.data?.length ?? 0} rows`,
);

const resources = await client.rpc('search_resources', {
  p_query: 'food',
  p_zip: zip,
  p_radius_miles: 25,
  p_limit: 3,
  p_offset: 0,
});
push(
  'DEV anon search_resources',
  !resources.error && Array.isArray(resources.data),
  resources.error?.message ?? `${resources.data?.length ?? 0} rows`,
);

const gw = await fetch(`${url}/functions/v1/fairpath-ai-gateway`, {
  method: 'POST',
  headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'ping' }),
});
push('DEV fairpath-ai-gateway deployed (anon auth gate)', gw.status !== 404, `status ${gw.status}`);

const payload = { at: new Date().toISOString(), results };
fs.writeFileSync('qa-dev-public-search-endpoints-results.json', JSON.stringify(payload, null, 2));

const failed = results.some((r) => !r.ok);
process.exit(failed ? 1 : 0);
