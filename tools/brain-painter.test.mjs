// brain-painter: F322's self-mutating shader mind (atomeam/a-to-mind.com drafts/F322) is a real organ of Verse Brain, not a separate demo
// (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). The brain's look is a program it writes and rewrites:
// programs are numbers only and always valid, the interpreter runs them with no eval, evolution beats random search given the same number
// of scored programs (on 40 recorded brains, 3 generations per 45 ticks: 0.85 against 0.82, 26 wins and 7 losses; the older rule, which
// picked the champion from scores taken on older states, tied with random search; on 30 new live brains over 15000 ticks 0.86 against
// 0.81, 22 wins and 7 losses), it runs in the brain's scheduler and marks the
// workspace, and its programs are kept between visits. Run:
// node --test tools/brain-painter.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as P from '../void-live-deploy/lib/brain-painter.js';
import { rng } from '../void-live-deploy/lib/field-kit.js';

/** states like the brain's: blobs of activity that drift, a travelling rhythm phase, an attention point that circles */
function states(seed, n) {
  const r = rng(seed * 7919 + 1), blobs = Array.from({ length: 3 }, () => ({ x: r(), y: r(), vx: (r() - 0.5) * 0.02, vy: (r() - 0.5) * 0.02, w: 0.08 + 0.1 * r() })), out = [];
  for (let k = 0; k < n; k++) {
    const act = new Float32Array(P.PX * P.PY), phase = new Float32Array(P.PX * P.PY);
    for (const b of blobs) { b.x = (b.x + b.vx + 1) % 1; b.y = (b.y + b.vy + 1) % 1; }
    for (let j = 0; j < P.PY; j++) for (let i = 0; i < P.PX; i++) {
      const c = j * P.PX + i, x = (i + 0.5) / P.PX, y = (j + 0.5) / P.PY;
      let a = 0; for (const b of blobs) a += Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.w * b.w));
      act[c] = Math.min(1, a * (0.6 + 0.4 * r())); phase[c] = (((x * 2 + y + k * 0.07) % 1) + 1) % 1;
    }
    out.push({ act, phase, fx: 0.5 + 0.35 * Math.cos(k * 0.4), fy: 0.5 + 0.3 * Math.sin(k * 0.5), t: (k % 13) / 13 });
  }
  return out;
}

test('programs are numbers only, always valid after growth, mutation and crossover, and bad ones are refused', () => {
  const r = rng(7);
  for (let k = 0; k < 2000; k++) {
    let a; do a = P.grow(r, 3); while (!P.valid(a));
    let b; do b = P.grow(r, 3); while (!P.valid(b));
    const m = P.mutateProg(a, r), c = P.cross(a, b, r);
    assert.ok(P.valid(m) && P.valid(c), 'children stay valid');
    assert.ok(m.every((t) => typeof t === 'number') && c.length <= P.MAXLEN);
  }
  const x = P.SYM0 + P.SYMS.indexOf('x'), plus = P.SYM0 + P.SYMS.indexOf('+');
  assert.ok(P.valid([x]) && P.valid([x, 2, plus]));
  for (const bad of [[], [plus], [x, x], ['x'], [x, 99], [x, 2, plus, plus], [999], [NaN], new Array(P.MAXLEN + 1).fill(x), 'alert(1)']) assert.equal(P.valid(bad), false, JSON.stringify(bad));
});

test('the interpreter paints what the program says, the same way each time, with hues in [0, 1)', () => {
  const env = states(1, 1)[0], sym = (s) => P.SYM0 + P.SYMS.indexOf(s);
  const h = P.paint([sym('x')], env);
  for (let i = 0; i < P.PX; i++) assert.ok(Math.abs(h[i] - (i + 0.5) / P.PX) < 1e-6, 'x paints a left-to-right ramp');
  const prog = [sym('a'), 2.5, sym('*'), sym('x'), sym('+'), sym('sin')];
  assert.equal(P.text(prog), 'sin((a * 2.5) + x)');
  assert.equal(P.text([sym('x'), 1, sym('+'), sym('y'), 2, sym('-'), sym('*')]), '(x + 1) * (y - 2)');
  const one = P.paint(prog, env), two = P.paint(prog, env);
  assert.deepEqual(Array.from(one), Array.from(two));
  assert.ok(Array.from(one).every((v) => v >= 0 && v < 1));
  const flat = P.judge([0.5], env), live = P.judge(prog, env);
  assert.ok(live.score > flat.score && flat.variety === 0, 'a flat picture scores below one that follows the tissue');
});

test('evolution beats random search given the same number of scored programs, on states it has not seen', () => {
  const RUNS = 66, diffs = [];
  for (let seed = 1; seed <= 20; seed++) {
    const all = states(seed, RUNS + 10), seq = all.slice(0, RUNS), held = all.slice(RUNS);
    const S = P.makePainter(seed);
    for (const e of seq) { S.envs.push(e); if (S.envs.length > P.ENVS) S.envs.shift(); P.evolve(S); }
    // random search: each run re-scores its best and scores three new programs, the four scorings the painter makes
    const r = rng(seed * 99 + 3), envs = []; let best = null, fit = -1, evals = 0;
    for (const e of seq) {
      envs.push(e); if (envs.length > P.ENVS) envs.shift(); if (best) { fit = P.judge(best, envs).score; evals++; }
      for (let k = 0; k < 3; k++) { let g; do g = P.grow(r, 3); while (!P.valid(g)); const s = P.judge(g, envs).score; evals++; if (s > fit) { fit = s; best = g; } }
    }
    assert.ok(S.evals >= evals, 'the painter used no fewer scorings than random search: ' + S.evals + ' vs ' + evals);
    assert.ok(S.evals <= evals + RUNS, 'and not more than one extra per run');
    diffs.push(P.judge(S.pop[S.champ], held).score - P.judge(best, held).score);
  }
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length, wins = diffs.filter((d) => d > 0.005).length, losses = diffs.filter((d) => d < -0.005).length;
  assert.ok(mean > 0.02 && wins >= 2 * losses, 'evolution ahead by ' + mean.toFixed(3) + ', ' + wins + ' wins, ' + losses + ' losses');
});

test('the painter runs in the brain: one of nineteen organs, it rewrites its look, marks the workspace, and the self says so', () => {
  const b = B.createBrain(5); B.tell(b, 'river stone light');
  for (let t = 0; t < 400; t++) { const a = t * 0.03; B.stepBrain(b, { x: 0.5 + 0.35 * Math.cos(a), y: 0.5 + 0.3 * Math.sin(a * 1.3), over: true }); }
  assert.ok(B.ORGAN_IDS.includes('painter') && B.ORGAN_IDS.length === 19);
  assert.ok(b.painter.gen >= 5, 'the painter ran ' + b.painter.gen + ' generations');
  assert.ok(b.board.paint && b.board.paint.hues.length === P.PX * P.PY);
  assert.ok(b.painter.best >= b.painter.first, 'its look scores no worse than where it started');
  const wrote = b.ws.writes[b.ws.organs.indexOf('painter')]; assert.ok(wrote > 0, 'a new look drew attention in the workspace (' + wrote + ' cell writes)');
  const self = B.selfOf(b).painter; assert.ok(self && self.gen === b.painter.gen && typeof self.program === 'string');
  assert.match(B.selfSays(b).join(' '), /Painter: its look is a program it rewrote \d+ times/);
  const sealed = B.params(b).paint; assert.ok(Array.isArray(sealed) && sealed.every((t) => typeof t === 'number'), 'the seal holds numbers only');
});

test('its programs are kept between visits, and kept knowledge that is not a population of valid programs is refused', () => {
  const b = B.createBrain(9);
  for (let t = 0; t < 200; t++) B.stepBrain(b, { x: 0.3, y: 0.6, over: true });
  const kept = JSON.parse(JSON.stringify(B.knowledgeOf(b)));
  const c = B.createBrain(10); B.loadKnowledge(c, kept);
  assert.deepEqual(c.painter.pop, b.painter.pop); assert.equal(c.painter.champ, b.painter.champ); assert.equal(c.painter.gen, b.painter.gen);
  const P2 = P.makePainter(3), before = JSON.stringify(P2.pop);
  for (const bad of [null, { pop: [] }, { pop: new Array(P.POP).fill(['x']), champ: 0, gen: 1 }, { pop: P2.pop, champ: 99, gen: 1 }, { pop: P2.pop, champ: 0, gen: -1 }]) assert.equal(P.loadPrograms(P2, bad), false);
  assert.equal(JSON.stringify(P2.pop), before);
});
