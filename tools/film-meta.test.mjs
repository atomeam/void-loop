import { test } from 'node:test';
import assert from 'node:assert/strict';
import filmMeta from '../void-live-deploy/skills/film-meta.js';

test('film-meta matches its examples and returns structured metadata', () => {
  assert.ok(filmMeta.match('film metadata for the matrix'));
  assert.ok(filmMeta.match('discover film inception'));
  assert.equal(filmMeta.name, 'film-meta');
});
