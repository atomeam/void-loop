// The memory card (void-live-deploy/skills/memory.js): Void answers from what it remembers (GET /api/memory?ask=).
// Run: node --test tools/memory-card.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { memoryOf, askUrl, rowsOf, noteId, noteRecord } from '../void-live-deploy/skills/memory.js';

test('the card opens on the ways people ask what they built or what Void remembers, and not on look-alikes', () => {
  assert.deepEqual(memoryOf('what did I build with react'), { q: 'react' });
  assert.deepEqual(memoryOf('What did I build in Python?'), { q: 'python' });
  assert.deepEqual(memoryOf('which projects have I made using rust'), { q: 'rust' });
  assert.deepEqual(memoryOf('what do you remember about the parser'), { q: 'the parser' });
  assert.deepEqual(memoryOf('remember anything about rust'), { q: 'rust' });
  assert.deepEqual(memoryOf('do you remember anything about svelte?'), { q: 'svelte' });
  assert.deepEqual(memoryOf('ask my memory about python'), { q: 'python' });
  assert.deepEqual(memoryOf('search my memory for oauth'), { q: 'oauth' });
  assert.deepEqual(memoryOf('what did I build'), { q: '' }, 'no topic: the API answers with its prompt sentence');
  for (const ask of ['remember me', 'memory game', 'how much memory does chrome use', 'what do you remember about me', 'do you remember me', 'what did I do today', 'what do you remember', 'remember to call mom', 'what did I build with it', ''])
    assert.equal(memoryOf(ask), null, ask);
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const e of skill.nearMisses) assert.ok(!skill.match(e.toLowerCase(), e), e);
});

test('the question is sent encoded and capped; the answer becomes one row per bullet and a plain sentence is one line', () => {
  assert.equal(askUrl('c# & rust'), '/api/memory?ask=c%23%20%26%20rust');
  assert.ok(askUrl('x'.repeat(500)).length < 230);
  assert.deepEqual(rowsOf('I remember 2 matches:\n\u2022 alpha (React): A tool. \u00b7 no remote copy\n\u2022 beta'),
    [{ bullet: false, text: 'I remember 2 matches:' }, { bullet: true, text: 'alpha (React): A tool. \u00b7 no remote copy' }, { bullet: true, text: 'beta' }]);
  assert.deepEqual(rowsOf('Nothing I remember matches zzzz.'), [{ bullet: false, text: 'Nothing I remember matches zzzz.' }]);
  assert.deepEqual(rowsOf(''), []);
});

test('"remember that <fact>" and "forget that <fact>" need a whole sentence; look-alikes are not this', () => {
  assert.deepEqual(memoryOf('remember that I prefer tabs over spaces'), { remember: 'I prefer tabs over spaces' });
  assert.deepEqual(memoryOf('Please remember that the deploy key lives in 1Password.'), { remember: 'the deploy key lives in 1Password' });
  assert.deepEqual(memoryOf('remember: my standup is at 9:30 daily'), { remember: 'my standup is at 9:30 daily' });
  assert.deepEqual(memoryOf('forget that I prefer tabs over spaces'), { forget: 'I prefer tabs over spaces' });
  for (const ask of ['remember the titans', "i can't remember", 'remember me', 'remember to call mom', 'remember that song', 'do you remember that', 'do you remember that song from 1999', 'forget it', 'forget about it', 'forget that', 'forget that song', 'forget my name', 'remember that ' + 'word '.repeat(60)])
    assert.equal(memoryOf(ask), null, ask);
});

test('a note has one id per fact (case, spacing and the final dot do not matter), so saying it twice keeps one and "forget that" finds it', async () => {
  const a = await noteId('I prefer tabs over spaces'), b = await noteId('  i PREFER tabs   over spaces. ');
  assert.equal(a, b); assert.match(a, /^note-[0-9a-f]{12}$/);
  assert.notEqual(a, await noteId('I prefer spaces over tabs'));
  const r = await noteRecord('I prefer tabs over spaces');
  assert.equal(r.kind, 'note'); assert.equal(r.summary, 'I prefer tabs over spaces'); assert.equal(r.id, a);
});
