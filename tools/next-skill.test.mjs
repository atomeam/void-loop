// node --test tools/next-skill.test.mjs: the learning queue's next entry (tools/next-skill.mjs, frontier #2, asked by Void):
// the miss board's asks grouped by intent, the top intent of the last 7 days, a ready probe batch in tools/bench.json's
// shape and the files a skill for it touches. Fixture rows only: real misses are what people typed and never enter this repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { intentWords, groupByIntent, nextSkill, probeBatch, skillStub, filesFor } from './next-skill.mjs';

const NOW = Date.parse('2026-10-10T12:00:00Z'), ago = (h) => new Date(NOW - h * 3600e3).toISOString();
const row = (ask, count, h, extra = {}) => ({ ask, count, last: ago(h), first: ago(h + 30), fallback: '', ...extra });
const ROWS = [
  row('when is high tide in boston', 3, 5), row('tide times tomorrow', 2, 20), row('high tide today', 2, 40), row('Tides for Brighton?', 1, 70),
  row('how many calories in an avocado', 2, 10), row('calories in a banana', 1, 30),
  row('weather tomorrow in lima', 4, 2), // a skill already answers weather: this one is "extend", not "new"
  row('asdfgh', 9, 1), // keyboard mash: never an intent
  row('my key is sk_live_abcdefghijklmnop1234', 5, 1), // a key never leaves the board
  row('an old ask about tides', 9, 24 * 9), // older than a week
  row('what time is it in tokyo', 6, 3), // already benched
];
const KNOWN = new Set(['what time is it in tokyo']);
const SKILLS = ['weather', 'worldtime', 'define', 'recipe'];

test('an ask\'s intent is its telling words: filler and question words out, plurals folded', () => {
  assert.deepEqual(intentWords('When is high tide in Boston?'), ['high', 'tide', 'boston']);
  assert.deepEqual(intentWords('Tides for Brighton?'), ['tide', 'brighton']);
  assert.deepEqual(intentWords('how many calories in an avocado'), ['calorie', 'avocado']);
  assert.deepEqual(intentWords('what is it'), []);
});

test('the board is grouped by intent: one group per thing people wanted, ranked by how much they wanted it', () => {
  const groups = groupByIntent(ROWS, { now: NOW, known: KNOWN });
  const names = groups.map((g) => g.name);
  assert.equal(names[0], 'tide', 'four phrasings, eight misses: the top intent');
  assert.deepEqual(groups[0].asks.map((a) => a.ask).sort(), ['Tides for Brighton?', 'high tide today', 'tide times tomorrow', 'when is high tide in boston']);
  assert.equal(groups[0].count, 8);
  assert.ok(names.includes('calorie') && names.includes('weather'));
  const every = groups.flatMap((g) => g.asks.map((a) => a.ask)).join(' | ');
  assert.ok(!/asdfgh|sk_live|old ask|tokyo/.test(every), 'no mash, no key, nothing older than a week, nothing already benched: ' + every);
  assert.deepEqual(groupByIntent(ROWS, { now: NOW, known: KNOWN }), groups, 'the same board, the same groups');
});

test('the next skill: the top intent, its probe batch in bench.json\'s shape and the files it touches; an intent a skill already has is "extend"', () => {
  const n = nextSkill(ROWS, { now: NOW, known: KNOWN, skills: SKILLS });
  assert.equal(n.slug, 'tide');
  assert.equal(n.existing, null);
  assert.deepEqual(n.probe, n.asks.map((a) => ({ ask: a, want: 'skill:tide' })));
  assert.deepEqual(probeBatch(n), n.probe);
  assert.deepEqual(n.files, ['void-live-deploy/skills/tide.js', 'void-live-deploy/skills/index.json', 'tools/tide.test.mjs', 'tools/bench.json']);
  const w = groupByIntent(ROWS, { now: NOW, known: KNOWN }).find((g) => g.name === 'weather');
  assert.deepEqual(filesFor(w, SKILLS), ['void-live-deploy/skills/weather.js', 'tools/bench.json'], 'extend the skill that has the word, not a second one');
  assert.equal(nextSkill([], { now: NOW }), null, 'nothing missed, nothing next');
});

test('the skill stub is a skill the stage can load: name, examples from the asks, near misses to fill, run says none until built', async () => {
  const n = nextSkill(ROWS, { now: NOW, known: KNOWN, skills: SKILLS });
  const src = skillStub(n), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'next-skill-')), file = path.join(dir, 'tide.js');
  fs.writeFileSync(file, src);
  const m = (await import(pathToFileURL(file).href)).default;
  assert.equal(m.name, 'tide');
  assert.deepEqual(m.examples, n.asks);
  assert.ok(Array.isArray(m.nearMisses));
  for (const a of n.asks) assert.ok(m.match(a.toLowerCase(), a), 'its own asks match: ' + a);
  assert.ok(!m.match('weather tomorrow in lima', 'weather tomorrow in lima'));
  assert.equal(await m.run('high tide today', {}), 'none', 'a stub answers nothing until it is built');
  fs.rmSync(dir, { recursive: true, force: true });
});
