#!/usr/bin/env node
/**
 * Isolated DEV probe: measure anon-safe search_jobs / search_resources RPC latency (PostgreSQL path).
 * Does not start services or touch Metro. Writes scripts/poc/postgres-search-latency-results.json
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, readLinkedRef } from '../lib/dev-qa-run.mjs';

const DEV_REF = 'znvhmuhojvwvjzmaqwff';
const env = loadEnvLocal();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url?.includes(DEV_REF) || readLinkedRef() !== DEV_REF || !anonKey) {
  console.error('REFUSING: linked DEV .env.local required');
  process.exit(1);
}

const client = createClient(url, anonKey, { auth: { persistSession: false } });
const zip = '43228';
const samples = 5;

async function timeRpc(label, fn) {
  const ms = [];
  let rows = 0;
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    const r = await fn();
    ms.push(performance.now() - t0);
    if (r.error) throw new Error(`${label}: ${r.error.message}`);
    rows = Array.isArray(r.data) ? r.data.length : 0;
  }
  ms.sort((a, b) => a - b);
  return { label, rows, p50: ms[Math.floor(ms.length / 2)], p95: ms[ms.length - 1], samples: ms };
}

const results = [];
results.push(
  await timeRpc('search_jobs', () =>
    client.rpc('search_jobs', {
      p_query: 'warehouse',
      p_zip: zip,
      p_radius_miles: 25,
      p_location: null,
      p_remote: false,
      p_employment_type: null,
      p_second_chance: false,
      p_limit: 20,
      p_offset: 0,
      p_veteran_friendly: false,
    }),
  ),
);
results.push(
  await timeRpc('search_resources', () =>
    client.rpc('search_resources', {
      p_query: 'transportation food',
      p_zip: zip,
      p_radius_miles: 25,
      p_limit: 20,
      p_offset: 0,
    }),
  ),
);

const out = { at: new Date().toISOString(), zip, results };
fs.mkdirSync('scripts/poc', { recursive: true });
fs.writeFileSync('scripts/poc/postgres-search-latency-results.json', JSON.stringify(out, null, 2));
for (const r of results) {
  console.log(`${r.label}: p50=${r.p50.toFixed(0)}ms p95=${r.p95.toFixed(0)}ms rows=${r.rows}`);
}
