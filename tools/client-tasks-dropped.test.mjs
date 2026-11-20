import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/client-tasks-dropped.js';

test('client-tasks-dropped matches its examples and rejects near misses', () => {
  for (const ex of skill.examples) {
    assert.equal(skill.match(ex.toLowerCase(), ex), true, ex);
  }
  for (const miss of skill.nearMisses) {
    assert.equal(skill.match(miss.toLowerCase(), miss), false, miss);
  }
});

test('client-tasks-dropped suite check passes', () => {
  const s = skill.suite();
  assert.equal(s.ok, true);
});
