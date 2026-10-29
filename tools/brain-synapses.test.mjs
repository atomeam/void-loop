// brain-synapses: F217's spiking learner (atomeam/a-to-mind.com drafts/F217-audible-synapse-forager) is a real organ of Verse Brain, not a
// separate demo (owner, 2026-10-29: "combine all the builds into one entity", "dont fake it"). Its eye learns by reward-modulated STDP to
// look where the tissue is alive, it runs in the brain's scheduler, it writes what it sees into the one workspace, its learned wiring is
// kept between visits, and a working memory kept before it joined still loads. Run: node --test tools/brain-synapses.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as Y from '../void-live-deploy/lib/brain-synapses.js';

/** a tissue with five living patches (wraps at the edges, like the workspace) */
function tissue(seed) {
  const g = new Float32Array(B.GW * B.GH); let a = seed * 7919 + 1;
  const r = () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
  const blobs = [...Array(5)].map(() => ({ x: r() * B.GW, y: r() * B.GH, s: 3 + r() * 4 }));
  for (let y = 0; y < B.GH; y++) for (let x = 0; x < B.GW; x++) {
    let v = 0; for (const b of blobs) { let dx = Math.abs(x - b.x), dy = Math.abs(y - b.y); dx = Math.min(dx, B.GW - dx); dy = Math.min(dy, B.GH - dy); v += Math.exp(-(dx * dx + dy * dy) / (2 * b.s * b.s)); }
    g[y * B.GW + x] = Math.min(1, v);
  }
  return g;
}
/** one minute of the eye in a tissue: its wiring at the end and how much living tissue it saw in the last fifth */
function live(seed, learn, ms = 60000) {
  const g = tissue(seed), S = Y.makeSynapses(seed); S.learn = learn; let late = 0;
  for (let k = 0; k < ms; k++) { Y.stepMs(S, g); if (k >= ms * 0.8) late += S.seen; }
  return { wiring: Y.wiring(S.W), late: late / (ms * 0.2), spikes: S.spikes };
}

test('dopamine teaches the eye: same-side wiring grows only with learning on, and the learned eye finds more living tissue', () => {
  for (const seed of [1, 2, 3]) {
    const on = live(seed, true), off = live(seed, false);
    assert.ok(on.spikes > 1000 && off.spikes > 1000, 'its motor neurons spike');
    assert.ok(on.wiring > 0.04, `seed ${seed}: learned wiring ${on.wiring.toFixed(3)} grew`);
    assert.ok(Math.abs(off.wiring) < 0.03, `seed ${seed}: with no learning the wiring stays near 0 (${off.wiring.toFixed(3)})`);
    assert.ok(on.late > off.late * 1.2, `seed ${seed}: the learned eye sees more living tissue (${on.late.toFixed(3)} against ${off.late.toFixed(3)})`);
  }
});

test('it is an organ of the one brain: scheduled with the others, it writes into the shared input layer, and attention can see it', () => {
  assert.ok(B.ORGAN_IDS.includes('synapses'));
  const b = B.createBrain(11); B.ask(b, 'lighthouse harbor fog');
  for (let t = 0; t < 240; t++) B.stepBrain(b, { x: 0.3 + 0.001 * t, y: 0.6, over: t < 120 });
  assert.ok(b.runs.synapses > 0, 'the scheduler ran it');
  const k = b.ws.organs.indexOf('synapses');
  assert.ok(k >= 0 && b.ws.writes[k] > 0, 'it wrote into the workspace under its own name');
  assert.ok(b.board.eye && Number.isFinite(b.board.eye.x) && Number.isFinite(b.board.eye.wiring));
  assert.ok(B.embodiment(b).some((e) => e.key === 'eye' && e.organ === 'synapses'), 'it has a body on the card');
  assert.ok(B.selfSays(b).some((l) => /^Eye: \d+ spikes/.test(l)), 'it says what it is doing');
  const eye = B.embodiment(b).find((e) => e.key === 'eye'); B.dragTo(b, eye, 0.9, 0.1);
  assert.ok(Math.abs(b.synapses.x - 0.9) < 1e-9 && Math.abs(b.synapses.y - 0.1) < 1e-9, 'the eye goes where it is dragged');
});

test('what the eye learned is kept between visits, and a bad record leaves it as it is', () => {
  const a = B.createBrain(4); a.synapses.W.forEach((_, i) => { a.synapses.W[i] = (i % 7) * 0.5; });
  const kept = structuredClone(B.knowledgeOf(a));
  assert.ok(Array.isArray(kept.synapses) && kept.synapses.every(Number.isFinite), 'kept as numbers only');
  const b = B.createBrain(5); assert.ok(B.loadKnowledge(b, kept).includes('synapses'));
  assert.deepEqual(Array.from(b.synapses.W), Array.from(a.synapses.W));
  const c = B.createBrain(6), before = Array.from(c.synapses.W);
  for (const bad of [[1, 2], kept.synapses.map(() => 99), kept.synapses.map(() => -1)]) {
    assert.ok(!B.loadKnowledge(c, { ...kept, synapses: bad }).includes('synapses')); assert.deepEqual(Array.from(c.synapses.W), before);
  }
});

test('a working memory kept before the eye joined still loads, each cell still owned by the organ that wrote it', () => {
  const OLD = ['senses', 'predictor', 'gestures', 'memory', 'concepts', 'tissue', 'rhythm', 'swarm', 'membrane', 'will', 'arena', 'attention'];
  const a = B.createBrain(7); B.ask(a, 'harbor bells'); for (let t = 0; t < 150; t++) B.stepBrain(a, { x: 0.7, y: 0.3, over: true });
  const w = structuredClone(B.workingOf(a)); delete w.organs;
  w.ws = B.byName(w.ws, a.ws.organs, OLD); // as an old page wrote it: owner indices in the old order, no 'synapses'
  for (let i = 0; i < w.ws.owner.length; i++) if (a.ws.owner[i] === a.ws.organs.indexOf('synapses')) w.ws.owner[i] = 255;
  const b = B.createBrain(8); assert.deepEqual(B.loadWorking(b, w), ['workspace', 'ideas', 'attention', 'goals']);
  const name = (ws, o) => (o < ws.organs.length ? ws.organs[o] : o);
  let same = 0, owned = 0;
  for (let i = 0; i < b.ws.owner.length; i++) { const o = w.ws.owner[i]; if (o === 255) continue; owned++; if (name(b.ws, b.ws.owner[i]) === (o < OLD.length ? OLD[o] : o)) same++; }
  assert.ok(owned > 50 && same === owned, `${same} of ${owned} owned cells kept their writer`);
  for (const id of OLD) assert.equal(b.ws.writes[b.ws.organs.indexOf(id)], a.ws.writes[a.ws.organs.indexOf(id)], id + ' keeps its write count');
});
