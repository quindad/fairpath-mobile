import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('community exchange privacy boundaries', () => {
  it('community screens do not import justice or opportunity snapshot modules', () => {
    const files = [
      'src/app/community/index.tsx',
      'src/app/community/need-help/new.tsx',
      'src/app/community/need-help/[id].tsx',
      'src/app/community/help-now.tsx',
      'src/core/community/community-help-service.ts',
      'src/core/opportunity/orchestrator.ts',
      'src/core/opportunity/intent-parser.ts',
    ];
    for (const f of files) {
      const src = read(f);
      assert.doesNotMatch(src, /justice-records|justice_cases|build_opportunity_snapshot|professional-profile-model/);
    }
  });
});
