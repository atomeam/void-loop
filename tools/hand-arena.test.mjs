// hand-arena (skills/hand-arena.js): Tilt Arena's Hand Arena mode. Its asks, what run() summons, and its "Enter VR (hands)" button from
// lib/tilt-arena-idea.js: no VR says so, a session asks for hand tracking, and the index fingertip's position becomes the agents' target.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/hand-arena.js';
import { arenaIdea } from '../void-live-deploy/lib/tilt-arena-idea.js';

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, m + ': ' + a + ' vs ' + b);
const open = []; after(() => open.forEach((h) => h.dispose())); // the leader board's interval ends with its card
const flush = () => new Promise((r) => setImmediate(r));
const mk = (tag = 'div') => ({ tagName: tag, dataset: {}, style: {}, kids: [], on: {}, isConnected: true, textContent: '', disabled: false, setAttribute() {},
  addEventListener(t, f) { (this.on[t] ||= []).push(f); }, fire(t) { return Promise.all((this.on[t] || []).map((f) => f({ stopPropagation() {} }))); },
  appendChild(c) { this.kids.push(c); return c; }, insertBefore(c) { this.kids.push(c); return c; }, before(c) { this.prev = c; }, after(c) { this.next = c; },
  getContext: () => ({ makeXRCompatible: async () => {}, bindFramebuffer() {}, clearColor() {}, clear() {}, FRAMEBUFFER: 1, COLOR_BUFFER_BIT: 2 }) });
const setNav = (v) => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true });
function card() {
  globalThis.document = { createElement: mk };
  const els = {}, q = (s) => (els[s] ||= mk()), el = mk(), idea = arenaIdea('hand-arena'), th = { state: idea.create(6) }, ticks = [];
  const h = idea.mount({ q, th, el, tick: (n) => ticks.push(n) }); open.push(h);
  return { el, th, ticks, h, btns: els['.ff-btns'].kids, board: els['.ff-hud'].prev };
}

test('the asks: examples, near misses and the wrappers', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const a of ['steer it with my hands', 'hand chase', 'open the hand arena please', 'Hand tracking arena.']) assert.ok(sk.match(a.toLowerCase(), a), a);
  for (const a of ['hand', 'arena', 'hand arena tickets', 'steer with my feet']) assert.equal(sk.match(a.toLowerCase(), a), false, a);
});
test('run summons a Hand Arena card once, or centres the one already there', async () => {
  globalThis.innerWidth = 1200; const got = [], said = [], centred = [];
  let things = {}; const api = { stage: { things: () => things, center: (id) => centred.push(id) }, summon: (k, o) => got.push([k, o]), say: (s) => said.push(s) };
  assert.equal(await sk.run('hand arena', api), 'hand-arena'); assert.deepEqual(got, [['hand-arena', { x: 420, y: 50 }]]); assert.match(said[0], /^Tilt Arena, Hand Arena: tap Enter VR \(hands\)/);
  things = { h: { id: 'h1', kind: 'hand-arena' } }; assert.equal(await sk.run('steer with my hand', api), 'hand-arena'); assert.deepEqual(centred, ['h1']); assert.equal(got.length, 1);
  assert.equal(await sk.run('hand me the salt', api), 'none');
  assert.deepEqual(Object.keys(sk.stageKinds), ['hand-arena']); assert.equal(arenaIdea('hand-arena').sub, 'Hand Arena · 12 agents learn to chase');
});
test('the card: one VR button for hands next to the leader board; without VR it says the pointer or tilt steers', async () => {
  setNav({}); let c = card();
  assert.equal(c.btns.length, 1); assert.equal(c.board.kids.length, 3); assert.equal(c.btns[0].disabled, true); assert.equal(c.btns[0].textContent, 'VR not available here: pointer or tilt steers'); assert.equal(c.el.dataset.xr, 'none');
  setNav({ xr: { isSessionSupported: async (mode) => mode === 'immersive-vr' } }); c = card(); await flush();
  assert.equal(c.btns[0].textContent, 'Enter VR (hands)'); assert.equal(c.btns[0].title, 'steer with your index fingertip in VR (needs hand tracking)'); assert.equal(c.el.dataset.xr, 'ready');
});
test('in VR the index fingertip leads: 12 cm right of centre and 25 cm above 1.2 m', async () => {
  const frames = [], asked = [];
  const session = { inputSources: [], renderState: { baseLayer: {} }, updateRenderState() {}, requestReferenceSpace: async () => 'ref', requestAnimationFrame: (f) => frames.push(f),
    on: {}, addEventListener(t, f) { this.on[t] = f; }, end() { this.on.end(); } };
  setNav({ xr: { isSessionSupported: async () => true, requestSession: async (...a) => { asked.push(a); return session; } } }); globalThis.XRWebGLLayer = function () {};
  const c = card(); await flush(); await c.btns[0].fire('click');
  assert.deepEqual(asked, [['immersive-vr', { optionalFeatures: ['hand-tracking'] }]]); assert.equal(c.btns[0].textContent, 'Exit VR');
  const tip = { joint: 'tip' }, posed = [];
  const f = (pos) => ({ getJointPose: (j, ref) => { posed.push([j, ref]); return pos && { transform: { position: pos } }; } });
  c.th.state.t = 3; frames[0](0, f({ x: 0.12, y: 1.45 })); assert.equal(c.th.state.ext, undefined, 'no hand in view: nothing steers yet');
  session.inputSources = [{ hand: null }, { hand: new Map([['index-finger-tip', tip]]) }];
  frames[1](0, f({ x: 0.12, y: 1.45 })); near(c.th.state.ext.x, 0.7, 'right'); near(c.th.state.ext.y, 0, 'up'); assert.equal(c.th.state.ext.t, 3); assert.deepEqual(posed, [[tip, 'ref']]);
  frames[2](0, f(null)); near(c.th.state.ext.x, 0.7, 'a lost joint keeps the last target'); assert.deepEqual(c.ticks, [1, 1, 1]);
  arenaIdea('hand-arena').step(c.th.state, 1 / 60, { tilting: true, tiltX: -1, tiltY: 1 }); near(c.th.state.target.x, 0.7, 'the fingertip outranks tilt'); near(c.th.state.target.y, 0, 'y');
  c.h.dispose(); assert.equal(c.th.state.ext, null, 'leaving the card ends the session'); assert.equal(c.btns[0].textContent, 'Enter VR (hands)');
});
