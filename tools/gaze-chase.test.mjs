// gaze-chase (skills/gaze-chase.js): Tilt Arena's Gaze Chase mode. Its asks, what run() summons, and what it gets from lib/tilt-arena-idea.js:
// a fresh VR gaze outranks tilt and the pointer, and its "Enter VR (gaze)" button (no VR, VR refused, a session whose head pose steers the agents).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/gaze-chase.js';
import { arenaIdea, targetOf } from '../void-live-deploy/lib/tilt-arena-idea.js';
import * as T from '../void-live-deploy/lib/tilt-arena.js';

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, m + ': ' + a + ' vs ' + b);
const open = []; after(() => open.forEach((h) => h.dispose())); // the leader board's interval ends with its card
const flush = () => new Promise((r) => setImmediate(r));
const mk = (tag = 'div') => ({ tagName: tag, dataset: {}, style: {}, kids: [], on: {}, isConnected: true, textContent: '', disabled: false, setAttribute() {},
  addEventListener(t, f) { (this.on[t] ||= []).push(f); }, fire(t) { return Promise.all((this.on[t] || []).map((f) => f({ stopPropagation() {} }))); },
  appendChild(c) { this.kids.push(c); return c; }, insertBefore(c) { this.kids.push(c); return c; }, before(c) { this.prev = c; }, after(c) { this.next = c; },
  getContext: () => ({ makeXRCompatible: async () => {}, bindFramebuffer() {}, clearColor() {}, clear() {}, FRAMEBUFFER: 1, COLOR_BUFFER_BIT: 2 }) });
const setNav = (v) => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true });
function card(id = 'gaze-chase') {
  globalThis.document = { createElement: mk };
  const els = {}, q = (s) => (els[s] ||= mk()), el = mk(), idea = arenaIdea(id), th = { state: idea.create(2) }, ticks = [];
  const h = idea.mount({ q, th, el, tick: (n) => ticks.push(n) }); open.push(h);
  return { el, th, ticks, h, btn: els['.ff-btns'].kids[0], idea };
}

test('the asks: examples, near misses and the wrappers', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const a of ['gaze arena', 'steer it with my eyes', 'steer with head', 'show me the gaze chase demo', 'Gaze chase!']) assert.ok(sk.match(a.toLowerCase(), a), a);
  for (const a of ['gaze', 'chase', 'look at me', 'tilt arena']) assert.equal(sk.match(a.toLowerCase(), a), false, a);
});
test('run summons a Gaze Chase card once', async () => {
  globalThis.innerWidth = 800; const got = [], said = [];
  const api = { stage: { things: () => ({}) }, summon: (k, o) => got.push([k, o]), say: (s) => said.push(s) };
  assert.equal(await sk.run('look to steer', api), 'gaze-chase'); assert.deepEqual(got, [['gaze-chase', { x: 220, y: 50 }]]); assert.match(said[0], /Gaze Chase: tap Enter VR \(gaze\)/);
  assert.equal(await sk.run('chase bank hours', api), 'none'); assert.equal(got.length, 1);
  assert.deepEqual(Object.keys(sk.stageKinds), ['gaze-chase']); assert.equal(arenaIdea('gaze-chase').sub, 'Gaze Chase · 12 agents learn to chase');
});
test('steering: a gaze younger than half a second wins over tilt and the pointer, an older one does not', () => {
  const s = T.create(3, 12); s.t = 4;
  assert.deepEqual(targetOf({ ...s, ext: { x: 0.2, y: 0.7, t: 3.6 } }, { tilting: true, tiltX: 1, tiltY: 1, over: true, x: 0, y: 0 }), { x: 0.2, y: 0.7, t: 3.6 });
  const old = targetOf({ ...s, ext: { x: 0.2, y: 0.7, t: 3.5 } }, { tilting: true, tiltX: -1, tiltY: 0 }); near(old.x, 0.05, 'tilt x'); near(old.y, 0.5, 'tilt y');
  const lure = targetOf({ ...s, ext: null }, {}); near(lure.x, 0.5 + 0.32 * Math.cos(4 * 0.37), 'lure x'); near(lure.y, 0.5 + 0.26 * Math.sin(4 * 0.53), 'lure y');
  s.ext = { x: 1.3, y: -0.2, t: 4 }; arenaIdea('gaze-chase').step(s, 1 / 60, {}); assert.deepEqual(s.target, { x: 1, y: 0 }, 'a gaze off the field is clamped to its edge');
});
test('no VR here: the button says so and stays off', async () => {
  setNav({}); let c = card(); assert.equal(c.btn.disabled, true); assert.equal(c.btn.textContent, 'VR not available here: pointer or tilt steers'); assert.equal(c.el.dataset.xr, 'none');
  setNav({ xr: { isSessionSupported: async () => false } }); c = card(); await flush(); assert.equal(c.btn.disabled, true); assert.equal(c.el.dataset.xr, 'none');
  setNav({ xr: { isSessionSupported: async () => { throw new Error('x'); } } }); c = card(); await flush(); assert.equal(c.el.dataset.xr, 'none');
  setNav({ xr: { isSessionSupported: async () => true, requestSession: async () => { throw new Error('denied'); } } }); c = card(); await flush();
  assert.equal(c.el.dataset.xr, 'ready'); assert.equal(c.btn.textContent, 'Enter VR (gaze)'); assert.equal(c.btn.title, 'steer with where you look in VR');
  await c.btn.fire('click'); assert.equal(c.btn.textContent, 'VR could not start: pointer or tilt steers'); c.h.dispose();
});
test('in VR the head pose steers: 30 degrees of yaw is the left edge, 22.5 degrees of pitch the top', async () => {
  const frames = [], ends = [], asked = [];
  const session = { inputSources: [], renderState: { baseLayer: {} }, updateRenderState() {}, requestReferenceSpace: async () => 'ref', requestAnimationFrame: (f) => frames.push(f),
    on: {}, addEventListener(t, f) { this.on[t] = f; }, end() { ends.push(1); this.on.end(); } };
  setNav({ xr: { isSessionSupported: async () => true, requestSession: async (...a) => { asked.push(a); return session; } } }); globalThis.XRWebGLLayer = function () {};
  const c = card(); await flush(); await c.btn.fire('click');
  assert.deepEqual(asked, [['immersive-vr', {}]]); assert.equal(c.btn.textContent, 'Exit VR'); assert.equal(c.el.dataset.xr, 'on');
  const pose = (o) => ({ getViewerPose: () => ({ transform: { orientation: o } }) });
  c.th.state.t = 2; frames[0](0, pose({ x: 0, y: 0, z: 0, w: 1 })); assert.deepEqual(c.th.state.ext, { x: 0.5, y: 0.5, t: 2 }); assert.deepEqual(c.ticks, [1]);
  const yaw = Math.PI / 6; frames[1](0, pose({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })); near(c.th.state.ext.x, 0, 'yaw'); near(c.th.state.ext.y, 0.5, 'no pitch');
  const pitch = Math.PI / 8; frames[2](0, pose({ x: Math.sin(pitch / 2), y: 0, z: 0, w: Math.cos(pitch / 2) })); near(c.th.state.ext.x, 0.5, 'no yaw'); near(c.th.state.ext.y, 0, 'pitch');
  await c.btn.fire('click'); assert.equal(ends.length, 1); assert.equal(c.th.state.ext, null); assert.equal(c.btn.textContent, 'Enter VR (gaze)'); assert.equal(c.el.dataset.xr, 'ready');
  c.h.dispose();
});
