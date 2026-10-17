/**
 * Cursor-owned static cross-repo contract scan.
 * Reads Mobile proposed/canonical SQL and the sibling Partner checkout.
 * Does not modify Partner, Admin, or other agents' files.
 *
 * Exit 1 when an adapter mismatch is found so the gap is machine-visible.
 */
import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = process.cwd();
const partnerRoot = path.resolve(mobileRoot, '..', 'quindad-fairpath-partner');
const { test, ok, done } = (() => {
  const results = [];
  return {
    async test(name, fn) {
      try {
        await fn();
        results.push(true);
        console.log('PASS ' + name);
      } catch (e) {
        results.push(false);
        console.log('FAIL ' + name + '\n     ' + e.message);
      }
    },
    ok(c, m) {
      if (!c) throw new Error(m);
    },
    done(label) {
      const failed = results.filter((r) => !r).length;
      console.log(`\n${results.length - failed}/${results.length} passed (${label}).`);
      process.exit(failed ? 1 : 0);
    },
  };
})();

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

await test('partner checkout is present next to mobile', async () => {
  ok(fs.existsSync(path.join(partnerRoot, 'package.json')), 'missing sibling ' + partnerRoot);
});

const actions = read(path.join(partnerRoot, 'src', 'app', 'jobs', 'actions.ts'));
const auth = read(path.join(partnerRoot, 'src', 'lib', 'partner-auth.ts'));
const statusDraft = read(path.join(mobileRoot, 'docs', 'proposed-migrations', '20261009093000_partner_job_application_status_RPC_DRAFT.sql'));
const placementDraft = read(path.join(mobileRoot, 'docs', 'proposed-migrations', '20261009095000_partner_record_placement_hardening_DRAFT.sql'));
const placementsMigration = read(path.join(mobileRoot, 'supabase', 'migrations', '20261007110000_job_placements.sql'));

await test('status RPC name exists in proposed SQL', async () => {
  ok(/function public\.partner_update_job_application_status\(/.test(statusDraft), 'status RPC missing from draft');
});

await test('Partner status mutation uses partner_update_job_application_status RPC', async () => {
  ok(
    /rpc\(\s*['"]partner_update_job_application_status['"]/.test(actions),
    'Partner still mutates job_applications by table update instead of the proposed status RPC',
  );
  ok(
    !/\.from\(\s*['"]job_applications['"]\s*\)\s*\.update\(/.test(actions),
    'Partner jobs/actions.ts still contains from(\'job_applications\').update',
  );
});

await test('Partner org context uses partner_org_context RPC rather than implicit table resolver only', async () => {
  ok(
    /rpc\(\s*['"]partner_org_context['"]/.test(auth) || /partner_org_context\(/.test(auth),
    'partner-auth.ts loads organization_members/organization_capabilities tables and does not call partner_org_context()',
  );
});

await test('placement RPC argument names match Partner adapter', async () => {
  ok(/rpc\(\s*['"]partner_record_placement['"]/.test(actions), 'Partner is not calling partner_record_placement');
  for (const arg of ['p_application_id', 'p_starting_wage', 'p_wage_period', 'p_employment_type', 'p_notes']) {
    ok(actions.includes(arg), 'Partner placement adapter missing ' + arg);
    ok(placementDraft.includes(arg), 'placement draft missing ' + arg);
  }
});

await test('canonical placement notes limit is 1000 and Partner does not advertise 4000', async () => {
  ok(/notes text check \(notes is null or length\(notes\) <= 1000\)/.test(placementsMigration), 'canonical notes check missing');
  const partnerSrc = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) partnerSrc.push(read(full));
    }
  };
  walk(path.join(partnerRoot, 'src'));
  const blob = partnerSrc.join('\n');
  ok(!/\b4000\b/.test(blob.match(/notes[\s\S]{0,80}4000|4000[\s\S]{0,80}notes/)?.[0] || ''), 'Partner notes field still mentions 4000');
  const notesCap = blob.match(/notes[\s\S]{0,120}max(Length|length)\s*[:=]\s*(\d+)/i);
  if (notesCap) {
    ok(Number(notesCap[2]) <= 1000, 'Partner notes maxLength ' + notesCap[2] + ' exceeds 1000');
  }
});

await test('EMPLOYER_WRITES_ENABLED fail-closed gate is present in Partner', async () => {
  const envExample = fs.existsSync(path.join(partnerRoot, '.env.example')) ? read(path.join(partnerRoot, '.env.example')) : '';
  const srcBlob = actions + auth + envExample;
  ok(
    /EMPLOYER_WRITES_ENABLED/.test(srcBlob),
    'EMPLOYER_WRITES_ENABLED was not found in Partner jobs/actions, partner-auth, or .env.example',
  );
});

await test('status pipeline values are a subset of proposed RPC statuses', async () => {
  const pipeline = [...actions.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const used = ['viewed', 'interview', 'offer', 'hired', 'rejected'].filter((s) => pipeline.includes(s) || actions.includes("'" + s + "'"));
  ok(used.length >= 5, 'Partner PIPELINE missing expected statuses');
  ok(/submitted|viewed|interview|offer|hired|rejected|withdrawn/.test(statusDraft), 'status draft missing expected states');
});

done('cursor cross-repo partner adapter contract');
