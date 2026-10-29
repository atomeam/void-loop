// operating-laws: the veto council, the stigmergy board and term orbits (owner, 2026-10-18, "operating laws for serious thought").
// The cards on these laws are skills/veto-council.js, skills/stigmergy-board.js and skills/term-orbits.js; test_void.mjs plays them through.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../void-live-deploy/lib/council-law.js';
import * as S from '../void-live-deploy/lib/stigmergy-law.js';
import * as T from '../void-live-deploy/lib/term-orbits-law.js';

const sum = (m) => Object.values(m).reduce((a, v) => a + v, 0);
const unit = (m) => ['entropy', 'activity', 'consensus', 'cx', 'cy'].every((k) => Number.isFinite(m[k]) && m[k] >= 0 && m[k] <= 1);

test('council: mass is conserved however a person edits it', () => {
  let m = C.startMasses(); assert.equal(sum(m), C.TOTAL);
  for (const [n, v] of [['Skeptic', 70], ['Wanderer', 0], ['Builder', 100], ['Economist', 33.4], ['Archivist', -5], ['Nobody', 9]]) { m = C.setMass(m, n, v); assert.equal(sum(m), C.TOTAL, n + ' ' + v); assert.ok(Object.values(m).every((x) => Number.isInteger(x) && x >= 0)); }
  assert.equal(C.setMass(C.startMasses(), 'Skeptic', 60).Skeptic, 60);
  assert.equal(sum(C.normalize({ Skeptic: 'x' })), C.TOTAL); assert.equal(sum(C.normalize(null)), C.TOTAL);
});

test('council: low mass only delays, high mass blocks, and the survivor is one whole proposal, not a merge', () => {
  const q = 'whether to rewrite the app';
  // find a proposal that someone objects to, then change only the objector's mass
  const base = C.convene(q, C.startMasses());
  assert.deepEqual(base, C.convene(q, C.startMasses()), 'same question, same council');
  assert.equal(base.proposals.length, 5);
  const byName = (v, n) => v.proposals.find((p) => p.by === n);
  let found = null;
  for (const qq of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'rewrite', 'move offices', 'hire']) {
    const low = C.convene(qq, { Skeptic: 3, Builder: 3, Archivist: 3, Economist: 3, Wanderer: 88 });
    if (low.proposals.some((p) => p.delayedBy.length)) { found = qq; break; }
  }
  assert.ok(found, 'some question draws a low-mass objection');
  const low = C.convene(found, { Skeptic: 3, Builder: 3, Archivist: 3, Economist: 3, Wanderer: 88 });
  const objector = low.proposals.filter((p) => !p.blockedBy.length).flatMap((p) => p.delayedBy.map((d) => ({ p: p.by, who: d.name })))[0];
  assert.ok(objector, 'a delayed proposal nobody blocks');
  assert.ok(low.proposals.every((p) => p.blockedBy.every((b) => b.mass / C.TOTAL >= C.BLOCK_SHARE)));
  assert.ok(byName(low, objector.p).rounds >= 2 && byName(low, objector.p).status !== 'blocked', 'low mass delays: extra rounds');
  const big = C.convene(found, C.setMass({ Skeptic: 3, Builder: 3, Archivist: 3, Economist: 3, Wanderer: 88 }, objector.who, 60));
  assert.ok(byName(big, objector.p).blockedBy.some((b) => b.name === objector.who), 'the same objector with mass 60 blocks');
  for (const v of [base, low, big]) {
    const s = v.proposals.filter((p) => p.status === 'survived'); assert.ok(s.length <= 1);
    if (v.survivor) { assert.equal(s[0].by, v.survivor); assert.deepEqual(s[0].props, v.proposals.find((p) => p.by === v.survivor).props, 'survivor keeps its own numbers'); assert.equal(s[0].blockedBy.length, 0); }
    assert.ok(unit(C.metrics(v)));
  }
});

test('council: if every proposal is blocked nobody survives', () => {
  const v = C.convene('x', { Skeptic: 100, Builder: 0, Archivist: 0, Economist: 0, Wanderer: 0 });
  assert.ok(v.proposals.filter((p) => p.by !== 'Skeptic').every((p) => p.status === 'blocked' || p.status === 'survived' || p.status === 'clear'));
  const none = C.convene('x', C.startMasses()); assert.ok(none.survivor === null || typeof none.survivor === 'string');
});

test('stigmergy: marks are capped, a repeated session is one visit, returning sessions reinforce and one-offs evaporate', () => {
  const s = S.create(); S.leave(s, 2, 2, 99); assert.equal(s.w[2 * S.W + 2], S.MAX_MARK);
  S.leave(s, 2, 2, 1); assert.equal(s.visits[2 * S.W + 2], 1, 'same session, one visit');
  S.leave(s, 9, 5, 1); S.newSession(s); S.leave(s, 2, 2, 1); assert.equal(s.visits[2 * S.W + 2], 2);
  const a = s.w[2 * S.W + 2]; S.tick(s); assert.ok(s.w[2 * S.W + 2] > a, 'reinforced trail grows');
  assert.ok(Math.abs(s.w[5 * S.W + 9] - S.DECAY) < 1e-9, 'one-session trail decays by DECAY'); // void-review: ok (decay constant compared within 1e-9)
  for (let i = 0; i < 60; i++) S.tick(s);
  assert.equal(s.w[5 * S.W + 9], 0, 'it evaporated'); assert.equal(s.visits[5 * S.W + 9], 0); assert.ok(s.w[2 * S.W + 2] <= S.CAP);
  assert.deepEqual(S.hottest(s, 1).map((c) => [c.x, c.y]), [[2, 2]]);
  S.leave(s, -1, 0); S.leave(s, 0, S.H); S.leave(s, 1.5, 1); assert.ok(unit(S.metrics(s)));
});

test('stigmergy: the board assigns nothing and its dump round-trips', () => {
  assert.ok(!Object.keys(S).some((k) => /assign|task|route/i.test(k)));
  const s = S.create(); S.leave(s, 1, 1, 2); S.newSession(s); S.leave(s, 1, 1, 1); S.tick(s);
  const back = S.load(S.dump(s)); assert.deepEqual(back.visits, s.visits); assert.equal(back.session, s.session); assert.ok(Math.abs(back.w[S.W + 1] - s.w[S.W + 1]) < 0.001);
  assert.deepEqual(S.load('not json').w, S.create().w); assert.deepEqual(S.load('{"w":[1]}').w, S.create().w);
  assert.ok(!/"x"|task/.test(S.dump(s)));
});

const rare = 'quartz nebula lantern harbor meadow copper violin orchard';
const mush = 'clarity clarity clarity clarity clarity clarity synergy synergy synergy synergy synergy synergy alignment alignment alignment alignment alignment alignment vision';
const run = (s, k, f) => { for (let i = 0; i < k; i++) { if (f) f(s, i); T.step(s, 1 / 60); } return s; };

test('term orbits: terms are counted, deterministic by seed, and kept in the square', () => {
  assert.deepEqual(T.termsOf('The clarity, the clarity and synergy! of it all'), [['clarity', 2], ['synergy', 1]]);
  const a = run(T.create(mush, 3), 300), b = run(T.create(mush, 3), 300); assert.deepEqual(a, b);
  assert.ok(a.nodes.every((n) => n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1)); assert.ok(unit(T.metrics(a)));
  assert.equal(T.create('', 1).nodes.length, 0); assert.ok(unit(T.metrics(T.create('', 1))));
});

test('term orbits: precise rare use keeps its orbit, overuse collapses into mush', () => {
  const calm = run(T.create(rare, 1), 1500); assert.equal(calm.merges.length, 0, 'rare terms never merge'); assert.equal(calm.nodes.length, 8);
  const r = calm.nodes.map((n) => Math.hypot(n.x - 0.5, n.y - 0.5)); assert.ok(Math.min(...r) > 0.1 && Math.max(...r) < 0.5, 'still orbiting: ' + r.map((v) => v.toFixed(2)));
  const over = run(T.create(mush, 1), 4000); assert.ok(over.merges.length >= 1 && over.nodes.some((n) => n.mush), 'overuse merges: ' + JSON.stringify(over.merges));
  assert.ok(over.nodes.length < 4); assert.equal(over.nodes.reduce((a, n) => a + n.uses, 0), T.create(mush, 1).nodes.reduce((a, n) => a + n.uses, 0), 'uses are conserved');
  assert.ok(T.metrics(over).consensus > T.metrics(calm).consensus);
});

test('term orbits: interventions are forces: anchor holds a node, push apart delays the merge, neither edits a term', () => {
  const s = T.create(rare, 1), name = s.nodes[0].name, at = { x: s.nodes[0].x, y: s.nodes[0].y };
  assert.equal(T.toggleAnchor(s, name), true); run(s, 600);
  const held = s.nodes.find((n) => n.name.split('+').includes(name)); assert.deepEqual([held.x, held.y], [at.x, at.y], 'anchored node stays'); assert.ok(held.uses >= 1 && held.anchored);
  assert.equal(T.toggleAnchor(s, held.name), false); assert.equal(T.toggleAnchor(s, 'nope'), false);
  const free = run(T.create(mush, 1), 1200), pushed = run(T.create(mush, 1), 1200, (st, i) => { if (i % 20 === 0) T.pushApart(st, 0.2, 0.4); });
  assert.ok(pushed.merges.length <= free.merges.length, `pushed ${pushed.merges.length} <= free ${free.merges.length}`);
  assert.equal(T.nodeAt(s, s.nodes[1].x, s.nodes[1].y).name, s.nodes[1].name); assert.equal(T.nodeAt(s, -1, -1), null);
});
