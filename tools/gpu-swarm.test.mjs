// gpu-swarm (skills/gpu-swarm.js): Tilt Arena's GPU Swarm mode. Its asks, what run() summons, its 256 agents, the 3-6-2 network checked by
// hand, the step taking the graphics card's forces when they fit, and the card's GPU path (lib/tilt-arena-idea.js): no WebGPU or a failed
// start falls back to the processor and says so; a working device gets one compute pass per frame whose forces land in the state.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/gpu-swarm.js';
import { arenaIdea } from '../void-live-deploy/lib/tilt-arena-idea.js';
import * as T from '../void-live-deploy/lib/tilt-arena.js';

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, m + ': ' + a + ' vs ' + b);
const open = []; after(() => open.forEach((h) => h.dispose())); // the leader board's interval ends with its card
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const mk = (tag = 'div') => ({ tagName: tag, dataset: {}, style: {}, kids: [], isConnected: true, textContent: '', setAttribute() {}, addEventListener() {},
  appendChild(c) { this.kids.push(c); return c; }, insertBefore(c) { this.kids.push(c); return c; }, before(c) { this.prev = c; }, after(c) { this.next = c; } });
const setNav = (v) => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true });
function card() {
  globalThis.document = { createElement: mk };
  const els = {}, q = (s) => (els[s] ||= mk()), el = mk(), idea = arenaIdea('gpu-swarm'), th = { state: idea.create(5) };
  const h = idea.mount({ q, th, el, tick() {} }); open.push(h);
  return { el, th, h, note: els['.ff-why'].next, btns: els['.ff-btns'] };
}

test('the asks: examples, near misses and the wrappers', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const a of ['graphics card swarm', 'swarm on my gpu', 'run the webgpu swarm demo', 'GPU swarm?']) assert.ok(sk.match(a.toLowerCase(), a), a);
  for (const a of ['gpu', 'swarm', 'swarm arena', 'gpu swarm benchmark scores']) assert.equal(sk.match(a.toLowerCase(), a), false, a);
});
test('run summons a GPU Swarm card once', async () => {
  globalThis.innerWidth = 600; const got = [], said = [];
  const api = { stage: { things: () => ({}) }, summon: (k, o) => got.push([k, o]), say: (s) => said.push(s) };
  assert.equal(await sk.run('gpu arena', api), 'gpu-swarm'); assert.deepEqual(got, [['gpu-swarm', { x: 120, y: 50 }]]); assert.match(said[0], /256 agents on your graphics card/);
  assert.equal(await sk.run('gpu prices', api), 'none'); assert.equal(got.length, 1); assert.deepEqual(Object.keys(sk.stageKinds), ['gpu-swarm']);
});
test('256 agents, the names wrap with a number, and the same seed gives the same swarm', () => {
  const idea = arenaIdea('gpu-swarm'), s = idea.create(11); assert.equal(idea.sub, 'GPU Swarm · 256 agents');
  assert.equal(s.n, 256); assert.equal(s.W.length, 256 * 38); assert.equal(T.GENES, 38);
  assert.equal(s.agents[15].name, 'Alder'); assert.equal(s.agents[16].name, 'Ash 2'); assert.equal(s.agents[255].name, 'Alder 16');
  assert.deepEqual(Array.from(idea.create(11).W.subarray(0, 50)), Array.from(s.W.subarray(0, 50)));
});
test('the 3-6-2 tanh network, checked by hand', () => {
  const W = new Float32Array(2 * T.GENES), X = new Float32Array([0.3, -0.2, 0.9, 0.5, 0.5, 0.5]), o = T.IN * T.HID + T.HID; // agent 0's layout: 18 in-weights, 6 biases, 12 out-weights, 2 biases
  W[o + T.HID * T.OUT] = 0.5; W[o + T.HID * T.OUT + 1] = -1; // agent 0: only the output biases
  const g = T.GENES; W[g + 0] = 1; W[g + o + 0] = 2; W[g + o + T.HID + 1] = -3; W[g + T.IN * T.HID + 1] = 0.4; // agent 1: hidden 0 sees input 0; hidden 1 is a bias
  const out = T.forwardAll(W, X, 2);
  near(out[0], Math.tanh(0.5), 'a0 x'); near(out[1], Math.tanh(-1), 'a0 y');
  near(out[2], Math.tanh(2 * Math.tanh(0.5)), 'a1 x: 2·tanh(x0)'); near(out[3], Math.tanh(-3 * Math.tanh(0.4)), 'a1 y: -3·tanh(bias)');
});
test('a step takes the graphics card forces when they fit, and the processor ones when they do not', () => {
  const idea = arenaIdea('gpu-swarm'), a = idea.create(3), b = idea.create(3), c = idea.create(3), d = idea.create(3), F = new Float32Array(256 * 2).fill(0.75), input = { over: true, x: 0.3, y: 0.6 };
  a.gpuOut = F; idea.step(a, 1 / 30, input); T.step(b, 1 / 30, { x: 0.3, y: 0.6 }, F);
  assert.deepEqual(a.agents.map((g) => [g.x, g.y, g.fit]), b.agents.map((g) => [g.x, g.y, g.fit]));
  c.gpuOut = new Float32Array(10).fill(0.75); idea.step(c, 1 / 30, input); T.step(d, 1 / 30, { x: 0.3, y: 0.6 });
  assert.deepEqual(c.agents.map((g) => [g.x, g.y]), d.agents.map((g) => [g.x, g.y])); assert.notDeepEqual(c.agents.map((g) => g.x), a.agents.map((g) => g.x));
});
test('no WebGPU, or a device that will not start: the processor runs the networks and the card says so', async () => {
  setNav({}); let c = card();
  assert.equal(c.el.dataset.gpu, 'cpu'); assert.equal(c.note.textContent, 'No WebGPU in this browser: the networks run on the processor instead, same agents, same rules.'); assert.equal(c.btns, undefined, 'no extra button');
  setNav({ gpu: { requestAdapter: async () => null } }); c = card(); assert.equal(c.el.dataset.gpu, 'starting'); await flush();
  assert.equal(c.el.dataset.gpu, 'cpu'); assert.equal(c.note.textContent, 'The graphics card could not start: the networks run on the processor instead, same agents, same rules.'); assert.equal(c.th.state.gpuOut, null);
});
test('a working device: one compute pass per frame, and its forces land in the state', async () => {
  const calls = { writes: [], dispatch: [], destroyed: 0, sizes: [] }, frames = [];
  globalThis.GPUBufferUsage = { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4, MAP_READ: 8, UNIFORM: 16 }; globalThis.GPUMapMode = { READ: 1 };
  globalThis.requestAnimationFrame = (f) => frames.push(f);
  const forces = new Float32Array(256 * 2).map((_, i) => (i % 2 ? -0.25 : 0.5));
  const dev = { queue: { writeBuffer: (b, off, data) => calls.writes.push([b.size, data.length]), submit() {} },
    createBuffer: ({ size, usage }) => { calls.sizes.push(size); return { size, usage, mapAsync: async () => {}, getMappedRange: () => forces.buffer.slice(0), unmap() {} }; },
    createShaderModule: ({ code }) => { calls.code = code; return {}; }, createComputePipeline: () => ({ getBindGroupLayout: () => ({}) }), createBindGroup: ({ entries }) => { calls.binds = entries.length; return {}; },
    createCommandEncoder: () => ({ beginComputePass: () => ({ setPipeline() {}, setBindGroup() {}, dispatchWorkgroups: (n) => calls.dispatch.push(n), end() {} }), copyBufferToBuffer() {}, finish() {} }),
    destroy: () => { calls.destroyed++; } };
  setNav({ gpu: { requestAdapter: async () => ({ requestDevice: async () => dev }) } });
  const c = card(); await flush();
  assert.equal(c.el.dataset.gpu, 'on'); assert.equal(c.note.textContent, 'Running 256 agent networks on your graphics card.');
  assert.deepEqual(calls.sizes, [256 * 38 * 4, 256 * 3 * 4, 256 * 2 * 4, 256 * 2 * 4, 16]); assert.equal(calls.code, T.WGSL); assert.equal(calls.binds, 4);
  assert.deepEqual(calls.dispatch, [4]); assert.deepEqual(Array.from(c.th.state.gpuOut), Array.from(forces)); assert.equal(c.el.dataset.gpuPasses, '1');
  assert.deepEqual(calls.writes.slice(0, 3), [[16, 4], [256 * 38 * 4, 256 * 38], [256 * 3 * 4, 256 * 3]]);
  frames.shift()(); await flush(); assert.equal(c.el.dataset.gpuPasses, '2'); assert.deepEqual(calls.dispatch, [4, 4]);
  c.h.dispose(); assert.equal(calls.destroyed, 1); frames.shift()(); await flush(); assert.equal(c.el.dataset.gpuPasses, '2', 'no pass after the card is gone'); assert.equal(frames.length, 0);
});
