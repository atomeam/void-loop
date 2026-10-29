// shared-field — Verse's one shared field, the slot memory every mind skill on a page writes into (owner's spec, 2026-10-29: "one shared
// field with readRegion/writeRegion/step/sealSlice", "combine all the builds into one entity"). skills/field.js re-exports this module,
// so the memory orbs (lib/orb-field.js) and Verse Brain (skills/verse-brain.js, lib/brain-field.js) hold the same buffer: an orb a
// visitor makes becomes a memory the brain feels, and the brain's ideas show up as other skills' slots on the orbs card.
//
// One flat Float32Array of N slots: positions N x 3, velocities N x 3, embeddings N x D, activation N, provenance N (the layout
// lib/orb-field.js layoutOf names). Positions are 0..1 on the stage. Provenance is a writer's code (provenanceOf), 0 when the slot is free.
// It runs on the CPU (init answers backend 'cpu'); no GPU is asked for. Nothing here is sent anywhere or stored: seals are hashes of
// numbers kept for this page only, never words or the pointer's path.
export const N = 256, D = 16;
export const layout = (() => { const pos = 0, vel = 3 * N, emb = 6 * N, act = emb + N * D, prov = act + N; return { N, D, pos, vel, emb, act, prov, total: prov + N }; })();

const buf = new Float32Array(layout.total);
const names = new Map(), writes = new Map(), seals = new Map(), fns = new Set(); // code -> skill id, skill id -> writes, genome id -> numbers
let ready = false, ticks = 0;

/** a writer's provenance code: a stable non-zero 16-bit hash of its id (the same one lib/orb-field.js falls back to). Pure. */
export function provenanceOf(id) {
  const s = String(id || ''); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  const c = (h % 65535) + 1; names.set(c, s); return c;
}

/** start the field (idempotent). The device is ignored: this field lives on the CPU. */
export function init(device = null) { void device; ready = true; return { N, D, layout, backend: 'cpu' }; }

const span = (start, count) => { const s = Math.max(0, Math.min(layout.total, Math.floor(+start) || 0)); return [s, Math.max(0, Math.min(layout.total - s, Math.floor(+count) || 0))]; };

/** a copy of count numbers from start (never a view: a reader cannot write through it). */
export function readRegion(start, count) { const [s, n] = span(start, count); return buf.slice(s, s + n); }

/** write count numbers from data at start, as skillId. Returns how many were written. Non-numbers become 0. */
export function writeRegion(start, count, data, skillId = 'unknown') {
  const [s, n] = span(start, Math.min(+count || 0, data ? data.length : 0)); if (!n) return 0;
  for (let i = 0; i < n; i++) { const v = +data[i]; buf[s + i] = Number.isFinite(v) ? v : 0; }
  const id = String(skillId); provenanceOf(id); writes.set(id, (writes.get(id) || 0) + n);
  for (const f of fns) { try { f(id, s, n); } catch (_) { /* a listener's own problem */ } }
  return n;
}

/** one step: positions move with their velocity (wrapping on the stage), velocity and activation fade; a slot whose activation fades
 *  out keeps its owner until the owner frees it, so no skill's memory is taken by another while it is away. */
export function step(dt = 1 / 60) {
  ticks++;
  for (let i = 0; i < N; i++) {
    if (buf[layout.prov + i] === 0) continue;
    for (let k = 0; k < 2; k++) { const p = layout.pos + 3 * i + k, v = layout.vel + 3 * i + k; let x = buf[p] + buf[v] * dt * 0.05; x -= Math.floor(x); buf[p] = x; buf[v] *= 0.995; }
    buf[layout.act + i] *= 0.999;
  }
  return ticks;
}

/** seal count numbers from start: an id (FNV-1a of their bytes, hex) kept with a copy of the numbers for this page. */
export function sealSlice(start, count) {
  const nums = readRegion(start, count), bytes = new Uint8Array(nums.buffer); let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  const id = 'f' + h.toString(16).padStart(8, '0'); seals.set(id, nums); return id;
}
export const sealed = (id) => (seals.has(id) ? seals.get(id).slice() : null);

/** the live slots: { slot, x, y, act, code, owner } for every slot with an owner and activation above a floor. */
export function slots(floor = 0.01) {
  const out = [];
  for (let i = 0; i < N; i++) { const c = buf[layout.prov + i], a = buf[layout.act + i]; if (c !== 0 && a > floor) out.push({ slot: i, x: buf[layout.pos + 3 * i], y: buf[layout.pos + 3 * i + 1], act: a, code: c, owner: names.get(c) || 'unknown' }); }
  return out;
}

/** who holds the field: { owner: active slots } and every writer's write count. */
export function census() {
  const held = {}; for (const s of slots()) held[s.owner] = (held[s.owner] || 0) + 1;
  return { ready, ticks, held, writes: Object.fromEntries(writes), seals: seals.size };
}

/** hear every write: fn(skillId, start, count). Returns an unsubscribe. */
export function onWrite(fn) { fns.add(fn); return () => fns.delete(fn); }

/** for tests: everything back to empty. */
export function reset() { buf.fill(0); names.clear(); writes.clear(); seals.clear(); fns.clear(); ticks = 0; ready = false; }
