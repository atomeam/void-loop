// memory-preview inside the memory-graph card (asked by Verse, ask-20261021-1627-2 and its 5 rewordings): a look at what an export holds before it downloads.
// node --test tools/memory-preview.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { empty, noteAsk, exportOf, previewOf, noteFact } from '../void-live-deploy/lib/memory-graph.js';
import { graphAskOf, previewHtml } from '../void-live-deploy/skills/memory-graph.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T0 = Date.parse('2026-10-18T19:30:00Z');

test('the preview wordings reach the memory card, and the old asks keep their meaning', () => {
  for (const a of ['preview my memory', "what's in my memory export", 'peek at my backup', 'preview my memory export before I download it', 'look inside my memory file', 'what is in my memory backup']) assert.equal(graphAskOf(a), 'preview', a);
  assert.equal(graphAskOf('export my memory'), 'export');
  assert.equal(graphAskOf('import my memory'), 'import');
  assert.equal(graphAskOf('what do you know about me'), 'show');
  for (const a of ['preview the report', 'what is in my fridge', 'peek at the stars', 'preview my stage']) assert.equal(graphAskOf(a), '', a);
});

test('previewOf counts what the file holds and samples the biggest labels, never more than asked', () => {
  let g = empty();
  for (let i = 0; i < 4; i++) g = noteAsk(g, { skill: 'timer', text: 'make a 5 minute timer', at: T0 + i * 1000 });
  g = noteAsk(g, { skill: 'clock', text: 'make a clock', at: T0 + 9000 });
  g = noteFact(g, 'I like tea', T0 + 10000);
  const pv = previewOf(exportOf(g, T0 + 20000), 2);
  assert.ok(pv.things >= 3);
  assert.equal(pv.sample.length, 2);
  assert.ok(pv.sample[0].n >= pv.sample[1].n, 'biggest first');
  assert.ok(pv.kB >= 1);
  assert.equal(Object.values(pv.kinds).reduce((a, b) => a + b, 0), pv.things);
  const h = previewHtml(esc, pv);
  assert.match(h, /What my memory export holds/);
  assert.match(h, /data-ask="export my memory"/);
  assert.match(h, /nothing has downloaded/);
});

test('an empty graph previews as empty, and a label is escaped', () => {
  const pv = previewOf(exportOf(empty(), T0));
  assert.equal(pv.things, 0);
  assert.match(previewHtml(esc, pv), /Nothing yet/);
  const h = previewHtml(esc, { things: 1, links: 0, kinds: { topic: 1 }, sample: [{ kind: 'topic', label: '<b>x</b>', n: 1 }], kB: 1, first: null, last: null });
  assert.ok(!h.includes('<b>x</b>'));
  assert.equal(previewOf(null).things, 0);
});
