// tools/new-skill.mjs: the one-command way to add a skill. node --test tools/new-skill.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRank, validate, render } from './new-skill.mjs';

test('a new skill is asked last, ten after the highest rank', () => {
  assert.equal(nextRank({}), 10);
  assert.equal(nextRank({ a: 10, b: 1040, c: 500 }), 1050);
});

test('bad names, repeats and empty example lists are refused with a reason', () => {
  const ranks = { weather: 10 };
  assert.equal(validate({ name: 'tide-tables', examples: ['high tide in lisbon'], near: [] }, ranks).ok, true);
  for (const name of ['', 'Tide', '1tide', 'tide tables', '../x', 'a']) assert.equal(validate({ name, examples: ['x y'], near: [] }, ranks).ok, false, name);
  assert.match(validate({ name: 'weather', examples: ['x y'], near: [] }, ranks).why, /already exists/);
  assert.match(validate({ name: 'tides', examples: [], near: [] }, ranks).why, /at least one ask/);
  assert.match(validate({ name: 'tides', examples: ['a b'], near: ['A B'] }, ranks).why, /both an example and a near miss/);
  assert.equal(validate({ name: 'tides', examples: ['x'.repeat(121)], near: [] }, ranks).ok, false);
});

test('the file it writes is a working skill on exactly its examples, and quotes cannot break out of it', async () => {
  const examples = ['when is high tide in lisbon', 'tide times for "porto" (today)', "it's low tide? now"];
  const src = render({ name: 'tide-tables', examples, near: ['what is a tide'] });
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  const s = mod.default;
  assert.equal(s.name, 'tide-tables');
  for (const e of examples) assert.equal(s.match(e.toLowerCase(), e), true, e);
  assert.equal(s.match('what is a tide', 'what is a tide'), false, 'the near miss is not taken');
  assert.equal(s.match('when is high tide in lisbon today', ''), false, 'exact to start with: the next agent widens WHEN');
  let html = '';
  const el = { set innerHTML(v) { html = v; } };
  const ret = s.run('x', { esc: (t) => String(t).replace(/</g, '&lt;'), showPage: (b) => b(el) });
  assert.equal(ret, 'tide-tables');
  assert.match(html, /<h2>Tide tables<\/h2>/);
});
