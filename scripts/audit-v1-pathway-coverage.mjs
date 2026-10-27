// Reports real DEV resource fixture coverage per V1 pathway (local seed mirror + category slugs).
// Does not invent providers. Run: node scripts/audit-v1-pathway-coverage.mjs
import fs from 'node:fs';
import { createLocalDb } from './lib/local-db.mjs';
import { loadResourceFixtures } from './lib/local-fixtures.mjs';

const pathways = [
  ['skills_exchange', ['jobs', 'education']],
  ['microbusiness', ['entrepreneurship', 'jobs']],
  ['education_scholarships', ['education', 'money']],
  ['family_center', ['family', 'food', 'clothing']],
  ['events_volunteering', ['education', 'health_wellness']],
  ['benefits_navigator', ['benefits', 'money', 'emergency_help']],
  ['health_wellness', ['health_wellness']],
  ['mentorship', ['jobs', 'education', 'entrepreneurship']],
  ['transportation', ['transportation', 'id_documents']],
  ['community_drives', ['food', 'clothing', 'family']],
];

const { db, errors } = await createLocalDb();
if (errors.length) {
  console.error('DB baseline failed');
  process.exit(1);
}
await loadResourceFixtures(db);

const rows = [];
for (const [id, slugs] of pathways) {
  const counts = [];
  for (const slug of slugs) {
    const r = await db.query(
      `select count(distinct r.id)::int as n
       from public.resources r
       join public.resource_category_links l on l.resource_id = r.id
       where l.category_slug = $1 and r.publish_status = 'published'`,
      [slug],
    );
    counts.push({ slug, published: r.rows[0]?.n ?? 0 });
  }
  const total = counts.reduce((s, c) => s + c.published, 0);
  rows.push({ pathway: id, totalPublishedInCategories: total, byCategory: counts, myPath: 'device-local plan-store + community-plan-sync', actionGap: total === 0 ? 'no published fixtures in category' : null });
}

console.log(JSON.stringify({ note: 'DEV national catalog may differ; counts reflect local fixture mirror', pathways: rows }, null, 2));
