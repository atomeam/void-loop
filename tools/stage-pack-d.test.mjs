// Stage pack D (owner, 2026-10-18): constellation-weaver, forge-table, night-ritual, archive-of-one. The pure parts of each, and that
// each leaves its near misses alone. Run: node --test tools/stage-pack-d.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import weaver, { weaveAsk, starsOf, chainOf, weaveThing, readWeaves, WEAVES_KEY } from '../void-live-deploy/skills/constellation-weaver.js';
import forge, { forgeAsk, pairOf, ideaOf, keptCardOf } from '../void-live-deploy/skills/forge-table.js';
import ritual, { ritualAsk, lineFor, moonLine, nightCard, mayPlay, NIGHT_CSS, LINES } from '../void-live-deploy/skills/night-ritual.js';
import archive, { archiveAsk, archiveItems, stepIndex, stripHtml, slideHtml } from '../void-live-deploy/skills/archive-of-one.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const m = (sk, t) => sk.match(t.toLowerCase(), t);

test('weaver: the weave and summon asks parse; the real sky and loose summons are left alone', () => {
  assert.deepEqual(weaveAsk('weave a constellation called night ops'), { op: 'weave', name: 'night ops', refs: null });
  const w = weaveAsk('Weave a constellation called study from the timer and the note');
  assert.equal(w.name, 'study'); assert.deepEqual(w.refs.map((r) => r.kind), ['timer', 'sticky']);
  assert.equal(weaveAsk('weave a constellation called study from the timer'), null, 'one named thing is not a constellation');
  assert.deepEqual(weaveAsk('summon the constellation night ops'), { op: 'summon', name: 'night ops' });
  assert.equal(weaveAsk('summon night ops'), null, 'a bare summon needs a saved weave of that name');
  assert.deepEqual(weaveAsk('summon night ops', ['Night Ops']), { op: 'summon', name: 'night ops' });
  for (const t of ['what is a constellation', 'where is orion', 'which constellations are up tonight', 'summon a sprite', 'weave a basket', 'summon', 'weave a constellation called <b>x</b>']) assert.equal(m(weaver, t), false, t);
  for (const e of weaver.examples) assert.equal(m(weaver, e), true, e);
});

test('weaver: the stars, the chain of lines and the saved stage object', () => {
  const things = { a: { id: 'a', kind: 'timer', x: 0, y: 0 }, b: { id: 'b', kind: 'sticky', x: 300, y: 10 }, c: { id: 'c', kind: 'figure', x: 5, y: 5 }, d: { id: 'd', kind: 'weave', x: 1, y: 1 }, e: { id: 'e', kind: 'list', x: 150, y: 90 } };
  assert.deepEqual(starsOf(things, null).map((t) => t.id), ['a', 'b', 'e'], 'figures and other weaves are not stars');
  assert.deepEqual(starsOf(things, [{ kind: 'timer' }, { kind: 'sticky' }]).map((t) => t.id), ['a', 'b']);
  assert.deepEqual(starsOf(things, [{ kind: 'timer' }, { kind: 'calc' }]).map((t) => t.id), ['a'], 'a missing one is dropped, so the caller sees fewer than two');
  assert.deepEqual(chainOf([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 150, y: 10 }]), [[0, 2], [2, 1]]);
  assert.deepEqual(chainOf([{ x: 1, y: 1 }]), []);
  const th = weaveThing('w1', 'night ops', starsOf(things, null));
  assert.equal(th.kind, 'weave'); assert.deepEqual(th.ids, ['a', 'b', 'e']); assert.ok(th.y >= 8);
  assert.deepEqual(readWeaves({ getItem: (k) => (k === WEAVES_KEY ? '{"x":{"name":"x","ids":["a"]}}' : null) }), { x: { name: 'x', ids: ['a'] } });
  assert.deepEqual(readWeaves({ getItem: () => 'not json' }), {});
  assert.deepEqual(readWeaves({ getItem: () => '[1]' }), {});
});

test('forge: only a pair of kinds (or "these") forges; one thing, a verb or a merge does not', () => {
  assert.deepEqual(forgeAsk('forge these'), { refs: null });
  assert.deepEqual(forgeAsk('forge the timer and the note').refs.map((r) => r.kind), ['timer', 'sticky']);
  for (const t of ['forge a sword', 'forge a signature', 'forge ahead', 'how do i forge steel', 'merge a pizza and a black hole', 'forge', 'forge the timer', 'forge a sword and a shield']) assert.equal(m(forge, t), false, t);
  for (const e of forge.examples) assert.equal(m(forge, e), true, e);
});

test('forge: picks two things, names their ideas, builds an escaped kept card', () => {
  const things = { a: { id: 'a', kind: 'timer', x: 10, y: 10 }, b: { id: 'b', kind: 'sticky', x: 50, y: 50, text: 'buy milk and eggs' }, c: { id: 'c', kind: 'figure', x: 0, y: 0 }, d: { id: 'd', kind: 'kept', name: 'Pizza', html: '<p>hot</p>' } };
  assert.deepEqual(pairOf(things, [{ kind: 'timer' }, { kind: 'sticky' }]).map((t) => t.id), ['a', 'b']);
  assert.equal(pairOf(things, [{ kind: 'timer' }, { kind: 'timer' }]), null, 'one thing is not a pair');
  assert.deepEqual(pairOf(things, null, 'a').map((t) => t.id), ['a', 'd'], 'the selected one and the newest other');
  assert.deepEqual(pairOf(things, null).map((t) => t.id), ['b', 'd'], 'else the newest two (figures never)');
  assert.equal(pairOf({ a: things.a }, null), null);
  assert.equal(ideaOf(things.b), 'buy milk and eggs'); assert.equal(ideaOf({ kind: 'kept', name: 'A <b>big</b> one!! of many things here today' }), 'a b big b one');
  const c = keptCardOf(esc, { name: '<img src=x onerror=1>', line: 'a "line"', typeLine: 'Idea', power: 2, resistance: 1, income: 0 }, { name: 'Timer' }, { name: 'Note' }, 'f1', 5, 6);
  assert.equal(c.kind, 'kept'); assert.equal(c.x, 5); assert.ok(!/<img/.test(c.html) && /&lt;img/.test(c.html) && /&quot;line&quot;/.test(c.html));
});

test('night ritual: the asks, the quiet line, the moon worked out locally, the sound gate', () => {
  assert.equal(ritualAsk('Begin the night ritual'), 'begin'); assert.equal(ritualAsk('end the ritual'), 'end'); assert.equal(ritualAsk('end the night ritual'), 'end');
  for (const t of ['night mode', 'my morning ritual', 'what is a ritual', 'ritual dance meaning', 'night sky tonight', 'end the call']) assert.equal(m(ritual, t), false, t);
  for (const e of ritual.examples) assert.equal(m(ritual, e), true, e);
  const d = new Date('2026-10-18T22:00:00Z');
  assert.equal(lineFor(d), lineFor(new Date('2026-10-18T03:00:00Z')), 'one line all day'); assert.ok(LINES.includes(lineFor(d)));
  const mo = moonLine(d); assert.match(mo.text, /\d+% lit/); assert.ok(mo.ph.illumination >= 0 && mo.ph.illumination <= 1);
  assert.match(moonLine(new Date('2026-10-26T12:00:00Z')).ph.name, /full|gibbous/, 'near the 26 Oct 2026 full moon');
  const card = nightCard((s) => esc(s), d, 'n1', 10, 60);
  assert.equal(card.nightRitual, true); assert.equal(card.kind, 'kept'); assert.match(card.html, /% lit/);
  assert.equal(mayPlay('running'), true); assert.equal(mayPlay('suspended'), false); assert.equal(mayPlay(undefined), false);
  assert.match(NIGHT_CSS, /--bg:/); assert.ok(!/pointer-events:(?!none)/.test(NIGHT_CSS), 'the veil lets every tap through');
});

test('archive: the walk ask, what is gathered, stepping, and escaping', () => {
  for (const t of ['walk the archive', 'walk me through the archive', 'open my archive of one']) assert.equal(archiveAsk(t), true, t);
  for (const t of ['internet archive', 'archive this email', 'wayback machine archive', 'archive of our own', 'walk the dog', 'show me everything you made']) assert.equal(m(archive, t), false, t);
  for (const e of archive.examples) assert.equal(m(archive, e), true, e);
  assert.equal(stripHtml('<h2>Hi &amp; bye</h2><style>x{}</style><p>a&nbsp;b <b>c</b></p>'), 'Hi & bye a b c');
  const things = {
    k: { id: 'k', kind: 'kept', name: 'Tip', html: '<h2>Tip</h2><p>Drink water</p>' }, s: { id: 's', kind: 'sticky', text: 'buy milk' },
    e: { id: 'e', kind: 'sticky', text: '' }, l: { id: 'l', kind: 'list', title: 'Todo', items: [{ text: 'a', done: true }, { text: 'b' }] },
    f: { id: 'f', kind: 'figure', title: 'Zed', line: 'hello' }, t: { id: 't', kind: 'timer' }, w: { id: 'w', kind: 'weave', name: 'x' },
  };
  const items = archiveItems(things);
  assert.deepEqual(items.map((i) => i.id), ['k', 's', 'l', 'f'], 'empty notes, timers and weaves are not in the archive');
  assert.match(items[2].text, /✓ a\n• b/);
  assert.deepEqual([stepIndex(0, 3, -1), stepIndex(0, 3, 1), stepIndex(2, 3, 1), stepIndex(1, 3, -1), stepIndex(0, 0, 1)], [0, 1, 2, 0, 0]);
  const h = slideHtml(esc, { label: 'kept card', title: '<script>x</script>', text: 'a & b\n"q"' }, 0, 4);
  assert.ok(!/<script>/.test(h) && /&lt;script&gt;/.test(h) && /&amp;/.test(h) && /1 of 4/.test(h));
});
