// lib/job-regions.js: a two-letter country code as the narrowest region the remote job listings name (/jobs/?cc=).
// Run: node --test tools/job-regions.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { regionOfCountry } from '../void-live-deploy/lib/job-regions.js';

test('the named countries keep their own region', () => {
  assert.deepEqual(['US', 'CA', 'GB', 'DE', 'AU', 'NZ'].map(regionOfCountry), ['usa', 'canada', 'uk', 'germany', 'oceania', 'oceania']);
});
test('the grouped countries land in their group, and case does not matter', () => {
  assert.equal(regionOfCountry('PT'), 'europe');
  assert.equal(regionOfCountry('br'), 'latam');
  assert.equal(regionOfCountry('Ae'), 'emea');
  assert.equal(regionOfCountry('jp'), 'asia');
  assert.equal(regionOfCountry('KE'), 'africa');
});
test('Austria and Switzerland are Europe, not Germany', () => {
  assert.equal(regionOfCountry('AT'), 'europe');
  assert.equal(regionOfCountry('CH'), 'europe');
});
test('an unknown or malformed code gives an empty region', () => {
  for (const c of ['ZZ', 'AQ', '', null, undefined, 'USA', 'U', '1A', 'toString', 'constructor']) assert.equal(regionOfCountry(c), '', String(c));
});
