// term-orbits (skills/term-orbits.js): which asks open the term orbits card, and the card on a stub page with reduced motion: the sample's eight terms,
// Watch on overused text collapsing the overused terms into one mush node while rare terms keep their orbit, a tap anchoring a node, push apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../void-live-deploy/lib/term-orbits-law.js';

globalThis.matchMedia = (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' }); // reduced motion: no animation loop, Watch runs 600 steps at once
let rafs = 0; globalThis.requestAnimationFrame = () => ++rafs;
const sk = (await import('../void-live-deploy/skills/term-orbits.js')).default;

function card() {
  const nodes = {}, el = { innerHTML: '', dataset: {}, isConnected: true, cls: [], classList: { add: (c) => el.cls.push(c) } };
  el.querySelector = (sel) => nodes[sel] || (nodes[sel] = { textContent: '', value: '', on: {}, addEventListener(t, f) { (this.on[t] ||= []).push(f); },
    ...(sel === 'canvas' ? { width: +/<canvas[^>]*width="(\d+)"/.exec(el.innerHTML)[1], height: +/<canvas[^>]*height="(\d+)"/.exec(el.innerHTML)[1], getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 300 }) } : {}) });
  assert.equal(sk.run('watch my words drift', { showPage: (f) => f(el), esc: String }), 'term-orbits');
  const fire = (sel, ev = {}) => nodes[sel].on.click.forEach((f) => f(ev));
  return { el, nodes, fire, note: () => nodes['.to-note'].textContent };
}

test('examples in, near misses out, and the asks the pattern names', () => {
  const m = (t) => sk.match(t.toLowerCase(), t);
  for (const e of sk.examples) assert.ok(m(e), e);
  for (const n of sk.nearMisses) assert.ok(!m(n), n);
  for (const a of ['Watch our vocabulary collapse', 'watch the terms orbit', 'watch my language drift over time']) assert.ok(m(a), a);
  for (const a of ['watch my weight', 'watch the words', 'my words drift', 'watch my words drifting', 'watch the language channel']) assert.ok(!m(a), a);
});
test('the terms of a text', () => {
  assert.deepEqual(T.termsOf('The clarity, the clarity and the quartz: what about synergy?'), [['clarity', 2], ['quartz', 1], ['synergy', 1]]);
});
test('the sample: eight terms in orbit, nothing collapsed yet', () => {
  const c = card();
  assert.deepEqual(c.el.cls, ['term-orbits']);
  assert.match(c.nodes.textarea.value, /^clarity clarity .* meadow$/);
  assert.equal(c.el.dataset.terms, '8'); assert.equal(c.el.dataset.merges, '0'); assert.equal(c.el.dataset.mush, '0'); assert.equal(c.el.dataset.anchored, '0');
  assert.equal(c.note(), '8 terms · 0 collapsed · 40% motion');
  assert.equal(rafs, 0);
});
test('Watch: overused terms collapse into one mush node; rare words keep their orbit', () => {
  const c = card(); c.fire('.to-go');
  assert.equal(c.el.dataset.mush, '1'); assert.equal(c.el.dataset.terms, '5');
  assert.match(c.note(), /^5 terms · 3 collapsed \(alignment \+ clarity\+synergy, alignment\+clarity\+synergy \+ meadow\) · \d+% motion$/);
  c.nodes.textarea.value = 'quartz nebula lantern harbor'; c.fire('.to-go');
  assert.equal(c.el.dataset.terms, '4'); assert.equal(c.el.dataset.merges, '0'); assert.equal(c.el.dataset.mush, '0');
});
test('a tap on a node anchors it, a second tap frees it; push apart only moves free nodes', () => {
  const c = card(), n = T.create(c.nodes.textarea.value, 1).nodes.find((q) => q.name === 'quartz');
  const tap = () => c.fire('canvas', { clientX: n.x * 360, clientY: n.y * 300 });
  tap(); assert.equal(c.el.dataset.anchored, '1');
  c.fire('.to-push'); assert.equal(c.el.dataset.anchored, '1');
  tap(); assert.equal(c.el.dataset.anchored, '0');
  c.fire('canvas', { clientX: 180, clientY: 150 }); assert.equal(c.el.dataset.anchored, '0'); // the centre holds no node
  const s = T.create('quartz nebula', 1), [ne, qu] = s.nodes; assert.deepEqual([ne.name, qu.name], ['nebula', 'quartz']); // ties go alphabetical
  ne.x = qu.x = 0.5; ne.y = 0.6; qu.y = 0.5; assert.equal(T.toggleAnchor(s, 'quartz'), true);
  const v = ne.vy; T.pushApart(s, 0.2, 0.4); assert.equal(qu.vy, 0); assert.equal(qu.vx, 0); assert.ok(Math.abs(ne.vy - (v + 0.2)) < 1e-9, String(ne.vy));
});
