// orb-field: the memory orbs' bridge to Verse's shared field (lib/orb-field.js). With no skills/field.js the bridge answers null and
// the orbs behave as before; with a field it writes live orbs into their own slots, never over another skill's, and seals there too.
// Run: node --test tools/orb-field.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as B from '../void-live-deploy/lib/orb-field.js';
import * as F from '../void-live-deploy/lib/field-fluid-orbs.js';

/** a field that keeps the API as specified, in a Float32Array; async: every call answers a promise, as a WebGPU buffer would. */
function fakeField(N = 16, D = 8, { async = false, size = 'init' } = {}) {
  const L = B.layoutOf(N, D), buf = new Float32Array(L.total), calls = [], seals = [];
  const out = (v) => (async ? Promise.resolve(v) : v);
  const f = {
    buf, calls, seals, L,
    init: (dev) => { calls.push(['init', dev]); return out(size === 'init' ? { N, D } : {}); },
    readRegion: (start, count) => out(buf.slice(start, start + count)),
    writeRegion: (start, count, data, skillId) => { calls.push(['write', start, count, skillId]); for (let k = 0; k < count; k++) buf[start + k] = data[k]; return out(undefined); },
    step: () => out(undefined),
    sealSlice: (start, count) => { seals.push([start, count]); return out('g' + start + ':' + count); }
  };
  if (size === 'module') { f.N = N; f.D = D; }
  return f;
}
const withOrbs = (seed = 3) => { const s = F.create(seed); s.d.fill(0); F.splat(s, 12, 18, 0, 0, 3, 2); F.splat(s, 36, 18, 0, 0, 3, 2); F.spawnOrbs(s); return s; }; // two peaks, two orbs

test('no field: a missing or broken field answers null, and the orbs seal and recall exactly as before', async () => {
  assert.equal(await B.connectField({ load: () => Promise.reject(new Error('404')) }), null);
  assert.equal(await B.connectField({ load: () => ({ init() {}, readRegion() {} }) }), null, 'a module without the whole API is not a field');
  assert.equal(await B.connectField({ load: () => ({ ...fakeField(), init: () => { throw new Error('no GPU, no fallback'); } }) }), null, 'a field that fails to start');
  assert.equal(await B.connectField({ load: () => fakeField(16, 8, { size: 'none' }) }), null, 'a field that never says its size is not written blind');
  const s = withOrbs(), o = s.orbs[0]; assert.ok(o, 'orbs grow with no field');
  const a = await F.sealOrb(s, o), t = F.create(9), back = F.loadOrb(t, a.snap, a.hash);
  assert.equal(F.sealOrbSync(t, back).hash, a.hash, 'the SHA-256 seal stands on its own');
});

test('the layout is the specified one: positions N x 3, velocities N x 3, embeddings N x D, activation N, provenance N', () => {
  assert.deepEqual(B.layoutOf(10, 4), { N: 10, D: 4, pos: 0, vel: 30, emb: 60, act: 100, prov: 110, total: 120 });
  assert.deepEqual(B.sizeOf({}, { N: 5, D: 3 }), { N: 5, D: 3 }); assert.deepEqual(B.sizeOf({ N: 7, D: 2 }, undefined), { N: 7, D: 2 });
  assert.equal(B.sizeOf({}, { N: 0, D: 3 }), null);
  const c = B.codeOf({}); assert.ok(c > 0 && c <= 65535 && c === B.codeOf({}), 'a stable non-zero code'); assert.equal(B.codeOf({ provenanceOf: () => 42 }), 42, 'the field\'s own code when it has one');
  const e = B.embed({ bytes: Array.from({ length: 64 }, (_, i) => i * 4) }, 8); assert.equal(e.length, 8); assert.ok(e.every((v) => v >= 0 && v <= 1)); assert.equal(e[1], Math.fround(32 / 255));
});

for (const async of [false, true]) test('with a field (' + (async ? 'async' : 'sync') + '): live orbs go into free slots, another skill\'s slot is never written, a seal is sealed in the field, a gone orb frees its slot', async () => {
  const f = fakeField(16, 8, { async }), other = 999; f.buf[f.L.prov + 0] = other; f.buf[f.L.act + 0] = 0.7; // slot 0 belongs to another skill
  const a = await B.connectField({ load: () => f });
  assert.ok(a, 'connected'); assert.deepEqual(f.calls[0], ['init', null], 'init once, letting the field pick its device or fallback');
  const s = withOrbs(); await a.sync(s);
  assert.equal(a.held, s.orbs.length); assert.equal(f.buf[f.L.prov + 0], other, 'the other skill\'s provenance stands'); assert.equal(f.buf[f.L.act + 0], Math.fround(0.7), 'and its activation');
  assert.ok(f.calls.filter((c) => c[0] === 'write').every((c) => c[3] === B.SKILL && !(c[1] >= f.L.prov && c[1] < f.L.prov + 1)), 'every write names the skill and none lands on slot 0');
  const o = s.orbs[0], slot = 1; // the first free slot
  assert.ok(Math.abs(f.buf[f.L.pos + 3 * slot] - o.x / F.GW) < 1e-6 && Math.abs(f.buf[f.L.pos + 3 * slot + 1] - o.y / F.GH) < 1e-6, 'its place, 0..1');
  assert.ok(f.buf[f.L.act + slot] > 0 && f.buf[f.L.prov + slot] === a.code, 'active, and marked as this skill\'s');
  assert.deepEqual(Array.from(f.buf.slice(f.L.emb + 8 * slot, f.L.emb + 8 * slot + 8)), Array.from(B.embed(F.orbSnapshot(s, o), 8)), 'its embedding is its density patch');
  assert.deepEqual(await a.stats(), { own: s.orbs.length, others: 1 });
  const g = await a.seal(s, o); assert.deepEqual(g, { genomeId: 'g' + (f.L.emb + 8 * slot) + ':8', slot }); assert.deepEqual(f.seals.at(-1), [f.L.emb + 8 * slot, 8], 'the field seals the orb\'s embedding slice');
  s.orbs = s.orbs.slice(1); await a.sync(s); assert.equal(f.buf[f.L.act + slot], 0); assert.equal(f.buf[f.L.prov + slot], 0, 'a gone orb gives its slot back');
  await a.close(); assert.equal(a.held, 0); assert.deepEqual(await a.stats(), { own: 0, others: 1 }, 'closing the card leaves only the other skill\'s memory');
});

test('a full field: an orb with no free slot stays on the card only, and seal answers null', async () => {
  const f = fakeField(2, 4); f.buf.fill(5, f.L.prov, f.L.prov + 2);
  const a = await B.connectField({ load: () => f }), s = withOrbs();
  await a.sync(s); assert.equal(a.held, 0); assert.equal(await a.seal(s, s.orbs[0]), null);
});

test('the bridge turns itself on: once skills/field.js serves the API, the default loader finds it, with no change here', async () => {
  const lib = join(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy/lib'), root = mkdtempSync(join(tmpdir(), 'orb-field-'));
  try {
    mkdirSync(join(root, 'lib')); mkdirSync(join(root, 'skills'));
    for (const f of ['orb-field.js', 'field-fluid-orbs.js', 'field-kit.js']) copyFileSync(join(lib, f), join(root, 'lib', f)); // this file as it ships
    writeFileSync(join(root, 'skills', 'field.js'), [ // a field.js with the API as specified, where the Verse Brain will put the real one
      'const N = 8, D = 4, buf = new Float32Array(6 * N + N * D + 2 * N);',
      'export const init = () => ({ N, D });',
      'export const readRegion = (start, count) => buf.slice(start, start + count);',
      'export const writeRegion = (start, count, data) => { for (let k = 0; k < count; k++) buf[start + k] = data[k]; };',
      'export const step = () => {}; export const sealSlice = (start, count) => \'g\' + start + \':\' + count;'].join('\n'));
    const C = await import(pathToFileURL(join(root, 'lib', 'orb-field.js')).href);
    const a = await C.connectField(); assert.ok(a, 'the default loader connects'); assert.deepEqual([a.layout.N, a.layout.D], [8, 4]);
    const s = withOrbs(); await a.sync(s); assert.equal(a.held, s.orbs.length, 'and the live orbs go into it');
    assert.ok(await C.fieldLink(), 'the page link connects too');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the real field: skills/field.js (lib/shared-field.js) is found, the orbs take their own slots in it, and Verse Brain sees them', async () => {
  const Shared = await import('../void-live-deploy/skills/field.js'); Shared.reset();
  const a = await B.connectField(); assert.ok(a, 'the real loader finds skills/field.js');
  const link = await B.fieldLink(); assert.ok(link, 'the page link connects'); assert.equal(await B.fieldLink(), link, 'the page asks once and keeps the answer');
  const s = withOrbs(); await a.sync(s);
  assert.equal(a.held, s.orbs.length); assert.equal(Shared.census().held['agent-fluid-memory-orbs'], s.orbs.length, 'the field names the orbs as the writer');
  const sealed = await a.seal(s, s.orbs[0]); assert.match(sealed.genomeId, /^f[0-9a-f]{8}$/); assert.ok(Shared.sealed(sealed.genomeId), 'the field kept the sealed slice');
  await a.close(); assert.equal(Shared.slots().length, 0, 'closing frees every slot');
});
