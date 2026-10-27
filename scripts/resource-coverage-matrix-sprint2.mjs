/**
 * Read-only resource coverage snapshot for Sprint 2 (no DB writes).
 *   node scripts/resource-coverage-matrix-sprint2.mjs
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { DEV_PROJECT_REF, projectRefFromUrl } from '../supabase/seed/lib/guards.mjs';

const CATEGORIES = [
  'employment',
  'housing',
  'transportation',
  'food',
  'legal',
  'reentry',
  'veterans',
  'childcare',
  'crisis',
  'education',
  'credit',
  'money',
  'health',
  'homelessness',
  'entrepreneurship',
];

const catalog = JSON.parse(fs.readFileSync('data/resource-sources/authoritative-catalog.json', 'utf8'));
const catalogSources = catalog.sources ?? [];

let dev = { connected: false, categories: {}, totalSearch: null, columbusTransport: null, note: '' };

if (fs.existsSync('.env.local')) {
  const env = Object.fromEntries(
    fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  if (projectRefFromUrl(url) === DEV_PROJECT_REF) {
    const sb = createClient(url, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    dev.connected = true;
    for (const cat of CATEGORIES) {
      const { data, error } = await sb.rpc('search_resources', {
        p_query: null,
        p_zip: '43215',
        p_radius_miles: 25,
        p_category: cat,
        p_free_only: false,
        p_urgent: false,
        p_delivery: null,
        p_include_national: false,
        p_limit: 1,
        p_offset: 0,
      });
      dev.categories[cat] = error ? { error: error.message } : { total: data?.length ? Number(data[0].total_count) : 0 };
    }
    const all = await sb.rpc('search_resources', {
      p_query: null,
      p_zip: '43215',
      p_radius_miles: 50,
      p_category: null,
      p_free_only: false,
      p_urgent: false,
      p_delivery: null,
      p_include_national: true,
      p_limit: 1,
      p_offset: 0,
    });
    dev.totalSearch = all.error ? all.error.message : all.data?.length ? Number(all.data[0].total_count) : 0;
    const tr = await sb.rpc('search_resources', {
      p_query: 'transportation',
      p_zip: '43215',
      p_radius_miles: 25,
      p_category: 'transportation',
      p_free_only: false,
      p_urgent: false,
      p_delivery: null,
      p_include_national: false,
      p_limit: 3,
      p_offset: 0,
    });
    dev.columbusTransport = tr.error
      ? { error: tr.error.message }
      : { count: tr.data?.length ?? 0, titles: (tr.data ?? []).map((r) => r.resource_row?.title).filter(Boolean) };
  } else dev.note = 'env not DEV ref';
} else dev.note = 'no .env.local';

const report = {
  at: new Date().toISOString(),
  authoritativeCatalog: {
    sourceCount: catalogSources.length,
    categoriesListed: [...new Set(catalogSources.flatMap((s) => s.categories))].sort(),
    ohioPrioritySources: catalogSources.filter((s) => /ohio|columbus|cleveland|211.*ohio/i.test(JSON.stringify(s))).map((s) => s.id),
  },
  devGuestSearch: dev,
  signalIntegration: 'search_resources RPC + signal-resource-relevance.ts (transport category, no national backfill)',
  myPathIntegration: 'member_opportunity_plan_items — blocked if migration not on DEV',
  nextAction: 'Expand authoritative-catalog with OH workforce/211 adapters; batch import after approval',
};

fs.writeFileSync('data/resource-sources/coverage-matrix-sprint2.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
