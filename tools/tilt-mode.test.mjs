// tilt-mode (skills/tilt-mode.js): Tilt Arena's Tilt mode. Its asks, what run() summons, and the law it gets from lib/tilt-arena-idea.js
// and lib/tilt-arena.js: steering from tilt or the pointer, one physics step with exact numbers, the wall bounce, the genome swap, the leader board.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/tilt-mode.js';
import { arenaIdea } from '../void-live-deploy/lib/tilt-arena-idea.js';
import * as T from '../void-live-deploy/lib/tilt-arena.js';

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, m + ': ' + a + ' vs ' + b);
const apiOf = (things = {}, center) => { const log = { summoned: [], said: [], centered: [], renders: 0 };
  return { log, api: { stage: { things: () => things, render: () => { log.renders++; }, ...(center ? { center: (id) => log.centered.push(id) } : {}) }, summon: (k, o) => log.summoned.push([k, o]), say: (s) => log.said.push(s) } }; };

test('the asks: examples, near misses, the wrappers and the degree form', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const a of ['open the tilt arena card', 'start a tilt game please', 'Tilt Arena?', 'tilt to 30deg', 'give me an orientation genome arena', 'tilt to steer']) assert.ok(sk.match(a.toLowerCase(), a), a);
  for (const a of ['tilt', 'arena', 'tilt arena modes', 'the tilt arena is fun', 'tilt the table']) assert.equal(sk.match(a.toLowerCase(), a), false, a);
});
test('run summons one Tilt Arena card in the middle, or brings back the one already there', async () => {
  globalThis.innerWidth = 1000;
  let { log, api } = apiOf();
  assert.equal(await sk.run('tilt arena', api), 'tilt-mode'); assert.deepEqual(log.summoned, [['tilt-mode', { x: 320, y: 50 }]]); assert.match(log.said[0], /^Tilt Arena: tilt your phone/);
  globalThis.innerWidth = 200; ({ log, api } = apiOf()); await sk.run('genome arena', api); assert.deepEqual(log.summoned[0][1], { x: 10, y: 50 });
  ({ log, api } = apiOf({ a: { id: 'a7', kind: 'tilt-mode' } }, true)); assert.equal(await sk.run('tilt game', api), 'tilt-mode'); assert.deepEqual(log.centered, ['a7']); assert.equal(log.summoned.length, 0);
  ({ log, api } = apiOf({ a: { id: 'a7', kind: 'tilt-mode' } })); await sk.run('tilt game', api); assert.equal(log.renders, 1); assert.equal(log.summoned.length, 0);
  ({ log, api } = apiOf()); assert.equal(await sk.run('what is the tilt of the earth', api), 'none'); assert.equal(log.summoned.length + log.said.length, 0);
  assert.deepEqual(Object.keys(sk.stageKinds), ['tilt-mode']);
});
test('its idea: twelve agents from a seed, steered by tilt first, then the pointer (clamped to the field)', () => {
  const idea = arenaIdea('tilt-mode'); assert.equal(idea.sub, 'Tilt · 12 agents learn to chase'); assert.match(idea.how, /^Tilt your phone or move the pointer/);
  const s = idea.create(5); assert.equal(s.n, 12); assert.equal(s.W.length, 12 * T.GENES); assert.deepEqual(Array.from(idea.create(5).W), Array.from(s.W));
  assert.deepEqual(s.agents.map((a) => a.name).slice(0, 3), ['Ash', 'Birch', 'Cedar']); assert.equal(idea.status(s), 'generation 0 · leader Ash');
  idea.step(s, 1 / 60, { tilting: true, tiltX: 1, tiltY: -1, over: true, x: 0.1, y: 0.1 }); near(s.target.x, 0.95, 'tilt x'); near(s.target.y, 0.05, 'tilt y');
  idea.step(s, 1 / 60, { over: true, x: 1.4, y: -0.2 }); assert.deepEqual(s.target, { x: 1, y: 0 });
});
test('one step with no network force: the light pull, damping, closeness, and the bounce off a wall', () => {
  const s = T.create(1, 2), zero = new Float32Array(4), [a, b] = s.agents;
  Object.assign(a, { x: 0.5, y: 0.5, vx: 0, vy: 0, fit: 0 }); Object.assign(b, { x: 0.999, y: 0.5, vx: 1, vy: 0, fit: 0 });
  T.step(s, 0.1, { x: 1, y: 0.5 }, zero);
  near(a.vx, 0.0384, 'pull'); near(a.x, 0.50384, 'moved'); near(a.vy, 0, 'no pull on y'); near(a.fit, (1 - 0.49616 * 1.6) * 0.015, 'closeness');
  near(b.x, 1, 'held at the wall'); near(b.vx, -0.5 * (1 + 0.001 * 0.8 * 0.1) * 0.96, 'bounced back at half speed');
  near(s.t, 0.1, 'time'); assert.equal(s.gen, 0);
});
test('every ROUND the weakest takes a mutated copy of the leader', () => {
  const s = T.create(9, 12); s.agents.forEach((a) => { a.fit = 0.1; }); s.agents[3].fit = 0.9; s.agents[7].fit = 0;
  const lead = Array.from(s.W.subarray(3 * T.GENES, 4 * T.GENES)), others = Array.from(s.W.subarray(0, 3 * T.GENES));
  T.evolve(s);
  assert.equal(s.lastSwap, "Larch took Elm's genome"); assert.equal(s.gen, 1); assert.equal(s.agents[3].wins, 1); near(s.agents[7].fit, 0.72, 'the copy starts at 80%');
  const copy = Array.from(s.W.subarray(7 * T.GENES, 8 * T.GENES)); copy.forEach((v, i) => assert.ok(Math.abs(v - lead[i]) <= 0.2500001, 'gene ' + i));
  assert.ok(copy.filter((v, i) => v === lead[i]).length >= 10, 'most genes copied as they are'); assert.deepEqual(Array.from(s.W.subarray(0, 3 * T.GENES)), others);
  const r = T.create(9, 12); r.round = T.ROUND - 0.01; T.step(r, 0.02, { x: 0.5, y: 0.5 }); assert.equal(r.gen, 1); assert.equal(r.round, 0);
  assert.equal(arenaIdea('tilt-mode').status(s), 'generation 1 · leader Elm · ' + "Larch took Elm's genome");
});
test('the card leader board: the top three, their closeness and wins, refreshed every 300 ms', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const mk = () => ({ dataset: {}, style: {}, kids: [], isConnected: true, setAttribute() {}, appendChild(c) { this.kids.push(c); return c; }, insertBefore(c) { this.kids.push(c); return c; }, before(c) { this.prev = c; }, after(c) { this.next = c; } });
    globalThis.document = { createElement: mk };
    const els = {}, q = (s) => (els[s] ||= mk()), el = mk(), idea = arenaIdea('tilt-mode'), th = { state: idea.create(4) };
    th.state.agents[2].fit = 0.5; th.state.agents[0].fit = 0.25; th.state.agents[4].fit = 0.125; th.state.agents[4].wins = 2; th.state.gen = 3;
    const h = idea.mount({ q, th, el, tick() {} }), ol = els['.ff-hud'].prev;
    assert.equal(ol.kids.length, 3); assert.equal(els['.ff-btns'], undefined, 'Tilt mode adds no VR or GPU button');
    mock.timers.tick(300);
    assert.deepEqual(ol.kids.map((li) => li.textContent), ['1st Cedar · 50% close · 0 wins', '2nd Ash · 25% close · 0 wins', '3rd Fir · 13% close · 2 wins']); assert.equal(el.dataset.gen, '3');
    h.dispose(); th.state.agents[1].fit = 1; mock.timers.tick(300); assert.equal(ol.kids[0].textContent, '1st Cedar · 50% close · 0 wins', 'stopped after dispose');
  } finally { mock.timers.reset(); }
});
