// swarm (F-020 salvage): the agents' sim is pure and fast enough for a frame, the mood moves the card, reduced motion is still.
import assert from 'node:assert/strict';
import { makeField, stepField, moodOf, MAX_AGENTS } from '../void-live-deploy/skills/mini/swarm.js';
import build from '../void-live-deploy/skills/mini/swarm.js';
import skill from '../void-live-deploy/skills/swarm.js';
import { PHONE_FRAME_MS } from '../void-live-deploy/skills/scene3d.js';

for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), 'takes: ' + a);
for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), 'leaves: ' + a);

const f = makeField(9999); assert.equal(f.n, MAX_AGENTS, 'the field is capped');
// pointing at the middle gathers them: the mood turns to clustering
const g = makeField(160, 3); let m; for (let i = 0; i < 240; i++) m = stepField(g, 0, 0);
assert.equal(m.name, 'clustering', 'pointer pulls a cluster: ' + JSON.stringify(m));
assert.ok(m.hue >= 0 && m.hue < 360 && m.intensity >= 0 && m.intensity <= 1);
for (let i = 0; i < g.n; i++) assert.ok(Math.abs(g.x[i]) <= 1 && Math.abs(g.y[i]) <= 1 && Number.isFinite(g.vx[i]), 'agents stay in the field');
assert.equal(moodOf(0.025, 0.1, {}).name, 'dispersing'); assert.equal(moodOf(0.001, 0.1, {}).name, 'idle');

// frame budget: a full step of the largest field is a small slice of the phone frame (PHONE_FRAME_MS)
const big = makeField(MAX_AGENTS, 5); for (let i = 0; i < 30; i++) stepField(big, 0.3, -0.2);
const t0 = performance.now(), N = 200; for (let i = 0; i < N; i++) stepField(big, Math.sin(i / 9), Math.cos(i / 7));
const per = (performance.now() - t0) / N;
assert.ok(per < PHONE_FRAME_MS / 6, 'a step of ' + MAX_AGENTS + ' agents takes ' + per.toFixed(3) + ' ms, inside the frame budget');

// reduced motion: one settled frame, tick never animates, the mood is still told
function fakeCtx(still) {
  class BA { constructor(a) { this.array = a; } } class Geo { setAttribute(k, v) { (this.attributes ||= {})[k] = v; } dispose() {} rotateX() { return this; } }
  const THREE = { BufferGeometry: Geo, BufferAttribute: BA, PointsMaterial: class { dispose() {} }, Points: class {}, CircleGeometry: Geo, MeshStandardMaterial: class { dispose() {} }, Mesh: class { constructor(g, m) { this.geometry = g; this.material = m; this.position = {}; } }, AdditiveBlending: 2, Color: class { setHSL() { this.r = this.g = this.b = 0.5; return this; } } };
  return { THREE, root: { add() {} }, still, phone: false, canvas: { addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 0 }) }, frame() {} };
}
let told = null; const s = build(fakeCtx(true), { onMood: (x) => { told = x; } });
assert.equal(s.tick(0.016, 0), false, 'reduced motion: no animation'); assert.ok(told && told.name, 'reduced motion still reports a mood');
const live = build(fakeCtx(false), {}); assert.equal(live.tick(0.016, 0), 'view', 'animates otherwise');
console.log('swarm: ok (' + per.toFixed(3) + ' ms per ' + MAX_AGENTS + '-agent step)');
