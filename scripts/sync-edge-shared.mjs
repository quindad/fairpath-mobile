// Copies the pure document-engine modules into the Edge Functions' shared folder so the SERVER renders with exactly the
// code the app previews with. Run after changing anything in src/core/documents or resource-format.
//   node scripts/sync-edge-shared.mjs          copy
//   node scripts/sync-edge-shared.mjs --check  exit 1 if the copies are out of date (used by the audit)
import fs from 'node:fs';
import path from 'node:path';

export const SYNC = [
  ['src/core/documents/spec.ts', 'supabase/functions/_shared/core/documents/spec.ts'],
  ['src/core/documents/document-types.ts', 'supabase/functions/_shared/core/documents/document-types.ts'],
  ['src/core/documents/render-pdf.ts', 'supabase/functions/_shared/core/documents/render-pdf.ts'],
  ['src/core/documents/render-docx.ts', 'supabase/functions/_shared/core/documents/render-docx.ts'],
  ['src/core/documents/builders/resources.ts', 'supabase/functions/_shared/core/documents/builders/resources.ts'],
  ['src/core/documents/builders/opportunity-profile.ts', 'supabase/functions/_shared/core/documents/builders/opportunity-profile.ts'],
  ['src/core/resources/resource-format.ts', 'supabase/functions/_shared/core/resources/resource-format.ts'],
];

const norm = (s) => s.replace(/\r\n/g, '\n');
const check = process.argv.includes('--check');
let stale = 0;
for (const [from, to] of SYNC) {
  const src = norm(fs.readFileSync(from, 'utf8'));
  const dst = fs.existsSync(to) ? norm(fs.readFileSync(to, 'utf8')) : null;
  if (dst === src) continue;
  stale++;
  if (check) { console.error('OUT OF SYNC: ' + to); continue; }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, src);
  console.log('synced ' + to);
}
if (check && stale) { console.error(`${stale} shared file(s) out of sync. Run: node scripts/sync-edge-shared.mjs`); process.exit(1); }
if (!check) console.log(stale ? `${stale} file(s) synced.` : 'Already in sync.');
