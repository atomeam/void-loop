// shared-field — Verse's one shared field, the slot memory every mind skill on a page writes into (owner's spec, 2026-10-29: "one shared
// field with readRegion/writeRegion/step/sealSlice", "combine all the builds into one entity"). skills/field.js re-exports this module,
// so the memory orbs (lib/orb-field.js) and Verse Brain (skills/verse-brain.js, lib/brain-field.js) hold the same buffer: an orb a
// visitor makes becomes a memory the brain feels, and the brain's ideas show up as other skills' slots on the orbs card.
//
// One flat Float32Array of N slots: positions N x 3, velocities N x 3, embeddings N x D, activation N, provenance N (the layout
// lib/orb-field.js layoutOf names). Positions are 0..1 on the stage. Provenance is a writer's code (provenanceOf), 0 when the slot is free.
// It runs on the CPU (init answers backend 'cpu'); no GPU is asked for. Nothing here is sent anywhere. Seals are hashes of numbers kept for
// this page only, never words or the pointer's path.
// Kept on this device (asked 2026-10-29 through the coordinator: the brain's working memory and attention must survive a full reload): a
// skill that holds a part (hold) gives the field its own record of what it is thinking; persist() keeps the field's slots of those skills
// and their parts as one IndexedDB record ('verse-field'), recall() reads it after a reload and gives each part back to its skill. A part is
// its owner's record (Verse Brain's holds its ideas' words, as lib/brain-store.js keeps its moments), the slots stay numbers only, and
// forgetKept() deletes the record. A part is given back only to a skill that holds one, and only what that skill kept: nothing is made up.
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

// ---- kept on this device --------------------------------------------------------------------------------------------------------------------
export const KEPT = { db: 'verse-field', store: 'kept', key: 'field', v: 1 };
const parts = new Map(); // skill id -> { save(), load(part) }
let latest = null, recalled = null; // the last record read or written on this page, and the one read of the device per page

/** IndexedDB on this device: get, put, del, each resolving (null or false) where IndexedDB is missing or refused. */
function deviceStore() {
  const open = () => new Promise((res) => {
    try {
      if (typeof indexedDB === 'undefined') return res(null);
      const q = indexedDB.open(KEPT.db, 1), done = setTimeout(() => res(null), 4000);
      q.onupgradeneeded = () => { try { q.result.createObjectStore(KEPT.store); } catch (_) { /* there */ } };
      q.onsuccess = () => { clearTimeout(done); res(q.result); }; q.onerror = q.onblocked = () => { clearTimeout(done); res(null); };
    } catch (_) { res(null); }
  });
  const run = async (mode, fn) => { const db = await open(); if (!db) return null; return new Promise((res) => { try { const tx = db.transaction(KEPT.store, mode), r = fn(tx.objectStore(KEPT.store)); tx.oncomplete = () => { db.close(); res(r && 'result' in r ? r.result : true); }; tx.onerror = tx.onabort = () => { db.close(); res(null); }; } catch (_) { db.close(); res(null); } }); };
  return { get: () => run('readonly', (s) => s.get(KEPT.key)), put: async (m) => !!(await run('readwrite', (s) => s.put(m, KEPT.key))), del: async () => !!(await run('readwrite', (s) => s.delete(KEPT.key))) };
}
let store = deviceStore();
/** where the record is kept: { get, put(record), del } (for tests); no argument goes back to IndexedDB. */
export function useStore(s) { store = s || deviceStore(); recalled = null; }

/** the slots a skill holds, as numbers: [[slot, pos x3, vel x3, emb xD, act]]. */
function rowsOf(code) {
  const out = [];
  for (let i = 0; i < N; i++) if (buf[layout.prov + i] === code) out.push([i, ...buf.slice(layout.pos + 3 * i, layout.pos + 3 * i + 3), ...buf.slice(layout.vel + 3 * i, layout.vel + 3 * i + 3), ...buf.slice(layout.emb + D * i, layout.emb + D * (i + 1)), buf[layout.act + i]]);
  return out;
}
/** put a skill's kept slots back where they were, each only where the slot is free or already the skill's own. Returns how many. */
function putRows(id, rows) {
  if (!Array.isArray(rows)) return 0; const code = provenanceOf(id); let n = 0;
  for (const r of rows) {
    if (!Array.isArray(r) || r.length !== 8 + D || !r.every(Number.isFinite)) continue; const i = r[0];
    if (!Number.isInteger(i) || i < 0 || i >= N || (buf[layout.prov + i] !== 0 && buf[layout.prov + i] !== code)) continue;
    buf.set(r.slice(1, 4), layout.pos + 3 * i); buf.set(r.slice(4, 7), layout.vel + 3 * i); buf.set(r.slice(7, 7 + D), layout.emb + D * i); buf[layout.act + i] = r[7 + D]; buf[layout.prov + i] = code; n++;
    for (const f of fns) { try { f(id, layout.prov + i, 1); } catch (_) { /* a listener's own problem */ } }
  }
  if (n) writes.set(id, (writes.get(id) || 0) + n);
  return n;
}
/** give one kept part back to its skill: its slots, then its own record. Returns true when the skill took it. */
function giveBack(id, part, rec) {
  if (!rec || !rec.parts || rec.parts[id] === undefined) return false;
  let took = false; try { took = part.load(rec.parts[id]) !== false; } catch (_) { took = false; }
  if (took) putRows(id, rec.slots && rec.slots[id]);
  return took;
}

/** a skill holds a part of the field's working memory: part = { save() -> its record, load(record) -> false to refuse }. If this page
 *  already read or wrote a record with a part for it, it is given back now. Returns a release. */
export function hold(id, part) {
  const k = String(id); if (!part || typeof part.save !== 'function' || typeof part.load !== 'function') return () => {};
  parts.set(k, part); giveBack(k, part, latest);
  return () => { if (parts.get(k) === part) parts.delete(k); };
}
/** the record: the slots of every skill that holds a part, numbers only, and each part's own record. */
export function memoryOf() {
  const m = { v: KEPT.v, at: Date.now(), slots: {}, parts: {} };
  for (const [id, part] of parts) { let p; try { p = part.save(); } catch (_) { p = undefined; } if (p === undefined || p === null) continue; m.parts[id] = p; m.slots[id] = rowsOf(provenanceOf(id)); }
  return m;
}
/** give a record back to the skills that hold parts now (the rest wait for their skill to hold one). Returns the ids that took theirs. */
export function revive(rec) {
  if (!rec || rec.v !== KEPT.v || !rec.parts || typeof rec.parts !== 'object') return [];
  latest = rec; const took = [];
  for (const [id, part] of parts) if (giveBack(id, part, rec)) took.push(id);
  return took;
}
/** keep the record on this device. Resolves true when kept, false when no skill holds a part or the device refused. */
export async function persist() {
  const m = memoryOf(); if (!Object.keys(m.parts).length) return false;
  latest = m; try { return !!(await store.put(m)); } catch (_) { return false; }
}
/** read the record kept on this device, once a page, and give it back (revive). Resolves the ids that took their part. */
export function recall() {
  if (!recalled) recalled = Promise.resolve().then(() => store.get()).then((rec) => revive(rec)).catch(() => []);
  return recalled;
}
/** delete the record from this device, and from this page. */
export async function forgetKept() { latest = null; try { return !!(await store.del()); } catch (_) { return false; } }

/** for tests: everything back to empty (a page's first moment after a reload). */
export function reset() { buf.fill(0); names.clear(); writes.clear(); seals.clear(); fns.clear(); parts.clear(); latest = null; recalled = null; ticks = 0; ready = false; }
