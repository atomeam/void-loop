import test from 'node:test';
import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/system-handoff.js';

test('system-handoff matches its examples and near misses', () => {
  for (const ex of skill.examples) {
    assert.ok(skill.match(ex.toLowerCase()), ex);
  }
  for (const near of skill.nearMisses) {
    assert.equal(skill.match(near.toLowerCase()), false, near);
  }
});

test('system-handoff run returns its name', () => {
  const api = { showPage: (fn) => { const el = { innerHTML: '' }; fn(el); return el; }, esc: (s) => String(s) };
  assert.equal(skill.run('handoff this system: client onboarding', api), 'system-handoff');
});
