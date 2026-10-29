// the uuid skill (skills/uuid.js): its examples reach it, its near misses do not, the ids are version 4, and run() puts one
// on a page, escaped, with nothing fetched. "generate a uuid" and "make a guid" stay with util, which is asked first.
//   node --test tools/uuid.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isUuid, generate } from '../void-live-deploy/skills/uuid.js';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['Random UUID?', 'another guid', 'please give me a new uuid']) assert.ok(isUuid(a), a);
  assert.equal(skill.suite().ok, true);
});

test('version 4 ids, all different', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) { const id = generate(); assert.match(id, V4); seen.add(id); }
  assert.equal(seen.size, 200);
});

test('run shows one id on a page, through esc', async () => {
  const el = { innerHTML: '' }; const seen = [];
  const said = await skill.run('random uuid', { showPage: (f) => { f(el); return el; }, esc: (s) => { seen.push(s); return String(s); } });
  assert.equal(said, 'uuid');
  assert.equal(seen.length, 1);
  assert.match(seen[0], V4);
  assert.ok(el.innerHTML.includes(seen[0]));
});
