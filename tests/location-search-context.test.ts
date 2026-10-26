import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseSearchZip,
  mergeSearchRadius,
  parseRadiusMilesFromNaturalLanguage,
  resolveSearchLocation,
} from '../src/core/location/search-location.ts';

test('parseRadiusMilesFromNaturalLanguage handles digits and words', () => {
  assert.equal(parseRadiusMilesFromNaturalLanguage('free groceries within 5 miles'), 5);
  assert.equal(parseRadiusMilesFromNaturalLanguage('help within five miles'), 5);
  assert.equal(parseRadiusMilesFromNaturalLanguage('no distance here'), null);
});

test('chooseSearchZip prefers manual then profile then device', () => {
  assert.deepEqual(chooseSearchZip({ manualZip: '44113', profileZip: '90210', deviceZip: '10001' }), {
    zip: '44113',
    source: 'manual',
  });
  assert.deepEqual(chooseSearchZip({ profileZip: '90210', deviceZip: '10001' }), { zip: '90210', source: 'profile' });
  assert.deepEqual(chooseSearchZip({ deviceZip: '10001' }), { zip: '10001', source: 'device' });
});

test('mergeSearchRadius honors query override', () => {
  assert.equal(mergeSearchRadius(25, 5), 5);
  assert.equal(mergeSearchRadius(25, null), 25);
});

test('resolveSearchLocation combines zip source and radius from query', () => {
  const r = resolveSearchLocation({
    profileZip: '44113',
    profileRadius: 25,
    queryText: 'food within 10 miles',
  });
  assert.equal(r.zip, '44113');
  assert.equal(r.radiusMiles, 10);
  assert.equal(r.source, 'profile');
});
