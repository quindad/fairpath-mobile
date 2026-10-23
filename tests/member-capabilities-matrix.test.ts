import assert from 'node:assert/strict';
import test from 'node:test';
import {
  capabilitiesFromOnboardingToolStep,
  justiceToolsEnabled,
  veteranToolsEnabled,
  type MemberCapabilities,
} from '../src/core/profile/member-capabilities-core.ts';

const REENTRY = 'Reentry & record relief';
const VETERAN = 'Veteran transition';
const NEITHER = 'Neither — skip for now';

type MatrixRow = {
  label: string;
  selected: string[];
  expected: Pick<MemberCapabilities, 'justice' | 'veteran'>;
  justiceEnabled: boolean;
  veteranEnabled: boolean;
};

const MATRIX: MatrixRow[] = [
  {
    label: 'explicit skip',
    selected: [NEITHER],
    expected: { justice: 'no', veteran: 'no' },
    justiceEnabled: false,
    veteranEnabled: false,
  },
  {
    label: 'reentry only',
    selected: [REENTRY],
    expected: { justice: 'yes', veteran: 'no' },
    justiceEnabled: true,
    veteranEnabled: false,
  },
  {
    label: 'veteran only',
    selected: [VETERAN],
    expected: { justice: 'no', veteran: 'yes' },
    justiceEnabled: false,
    veteranEnabled: true,
  },
  {
    label: 'both tools',
    selected: [REENTRY, VETERAN],
    expected: { justice: 'yes', veteran: 'yes' },
    justiceEnabled: true,
    veteranEnabled: true,
  },
  {
    label: 'skip ignored when reentry also selected',
    selected: [NEITHER, REENTRY],
    expected: { justice: 'yes', veteran: 'no' },
    justiceEnabled: true,
    veteranEnabled: false,
  },
  {
    label: 'skip ignored when veteran also selected',
    selected: [NEITHER, VETERAN],
    expected: { justice: 'no', veteran: 'yes' },
    justiceEnabled: false,
    veteranEnabled: true,
  },
  {
    label: 'empty selection defaults to no',
    selected: [],
    expected: { justice: 'no', veteran: 'no' },
    justiceEnabled: false,
    veteranEnabled: false,
  },
];

for (const row of MATRIX) {
  test(`capabilitiesFromOnboardingToolStep: ${row.label}`, () => {
    const caps = capabilitiesFromOnboardingToolStep(row.selected);
    assert.deepEqual(caps, row.expected);
    assert.equal(justiceToolsEnabled(caps), row.justiceEnabled, 'justiceToolsEnabled');
    assert.equal(veteranToolsEnabled(caps), row.veteranEnabled, 'veteranToolsEnabled');
  });
}
