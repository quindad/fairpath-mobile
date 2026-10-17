import assert from 'node:assert/strict';
import test from 'node:test';
import { hasValidCoordinates, mappableOnly } from '../src/core/location/map-data.ts';
import { readFileSync } from 'node:fs';

test('map markers keep real valid coordinates and reject invalid coordinates', () => {
  const rows = [
    { id: 'columbus', latitude: 39.9612, longitude: -82.9988 },
    { id: 'missing', latitude: null, longitude: null },
    { id: 'latitude-out-of-range', latitude: 91, longitude: -83 },
    { id: 'longitude-out-of-range', latitude: 40, longitude: -181 },
    { id: 'not-finite', latitude: Number.NaN, longitude: -83 },
  ];
  assert.deepEqual(mappableOnly(rows).map((row) => row.id), ['columbus']);
  assert.equal(hasValidCoordinates(rows[0]), true);
});

test('map markers retain detail navigation and honest empty states', () => {
  const housing = readFileSync('src/components/HousingMap.native.tsx', 'utf8');
  const jobs = readFileSync('src/components/JobMap.native.tsx', 'utf8');
  assert.match(housing, /onOpen\(home\)|onOpen={onOpen}/);
  assert.match(jobs, /onOpenJob/);
  assert.match(housing, /No mappable homes yet/);
  assert.match(jobs, /No mappable jobs yet/);
});

test('manual ZIP, city/state and radius filters remain available without GPS', () => {
  const jobs = readFileSync('src/app/find-jobs.tsx', 'utf8');
  const housing = readFileSync('src/app/find-housing.tsx', 'utf8');
  const resources = readFileSync('src/app/resources.tsx', 'utf8');
  assert.match(jobs, /ZIP code, city, or city and state/);
  assert.match(housing, /ZIP code, city, or city and state/);
  assert.match(resources, /5-digit ZIP code/);
  assert.match(jobs, /radiusMiles:radius/);
  assert.match(housing, /radiusMiles:radius/);
  assert.match(resources, /radiusMiles: next\.radius/);
  assert.doesNotMatch(jobs + housing + resources, /requestForegroundPermissionsAsync|getCurrentPositionAsync/);
});

test('Google Maps keys stay in build-time configuration and iOS keeps its fallback without a key', () => {
  const config = readFileSync('app.config.js', 'utf8');
  const env = readFileSync('.env.example', 'utf8');
  assert.match(config, /process\.env\.GOOGLE_MAPS_ANDROID_API_KEY/);
  assert.match(config, /process\.env\.GOOGLE_MAPS_IOS_API_KEY/);
  assert.match(config, /googleMapsIosEnabled: Boolean\(iosMapsKey\)/);
  assert.match(env, /package com\.fairpathfwd\.fairpathmobile/);
  assert.match(env, /bundle id com\.fairpathfwd\.fairpathmobile/);
  assert.doesNotMatch(config + env, /AIza[0-9A-Za-z_-]{20,}/);
});
