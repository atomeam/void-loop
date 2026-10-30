// orb-field, the memory orbs' bridge to Verse's shared field (skills/field.js; the Verse Brain work owns that file, this one only
// reads it). Asked by Owner through the team, 2026-10-29: sealed orbs are the field's episodic memory layer, so the orbs write into
// the one shared buffer instead of keeping private state, and they keep working exactly as before when the field is not there.
// The field's API as specified: init(deviceOrFallback), readRegion(start, count), writeRegion(start, count, data, skillId), step(),
// sealSlice(start, count) -> genomeId, over one flat buffer laid out as positions N x 3, velocities N x 3, embeddings N x D,
// activation N, provenance N (layoutOf). Any call may be sync or return a promise (a WebGPU buffer reads back async).
//   connectField({ load, device }) -> adapter | null    null when field.js is missing, lacks a call, fails to init, or has no size
//   adapter.sync(s)        every live orb in its own slot (position, flow, embedding, activation, provenance); a gone orb's slot freed
//   adapter.seal(s, o)     the orb written, then its embedding slice sealed by the field -> { genomeId, slot }
//   adapter.stats()        { own, others }: the slots active in the field that are this skill's, and other skills'
//   adapter.slots()        every live slot in the field, with its owner (the field's own slots()), or [] where the field has none
//   adapter.close()        every slot this card holds freed
// A slot is claimed only where provenance reads 0 (free) or this skill's own code, so another skill's memories are never written over.
import * as F from './field-fluid-orbs.js';

export const SKILL = 'agent-fluid-memory-orbs';
export const NEEDS = ['init', 'readRegion', 'writeRegion', 'step', 'sealSlice'];

/** where each part of an N-cell field with D-wide embeddings starts in the flat buffer. Pure. */
export function layoutOf(N, D) {
  const pos = 0, vel = 3 * N, emb = 6 * N, act = emb + N * D, prov = act + N;
  return { N, D, pos, vel, emb, act, prov, total: prov + N };
}

/** true when a module has every call the field API names. Pure. */
export const isField = (m) => !!m && NEEDS.every((k) => typeof m[k] === 'function');

const whole = (v) => Number.isInteger(+v) && +v > 0 ? +v : 0;
/** the field's N and D, from what init answered or what the module exports; null when neither says. Pure. */
export function sizeOf(mod, info) {
  for (const o of [info, info && info.layout, mod, mod && mod.layout]) {
    if (!o || typeof o !== 'object') continue;
    const N = whole(o.N ?? o.n ?? o.cells), D = whole(o.D ?? o.d ?? o.dim);
    if (N && D) return { N, D };
  }
  return null;
}

/** this skill's provenance code: the field's own, if it names one, else a stable non-zero 16-bit hash of the skill id. */
export function codeOf(mod, id = SKILL) {
  try { const c = typeof mod.provenanceOf === 'function' ? +mod.provenanceOf(id) : NaN; if (Number.isFinite(c) && c !== 0) return c; } catch (_) { /* its own way failed: hash */ }
  let h = 0x811c9dc5; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % 65535) + 1;
}

/** an orb's embedding: its sealed 8 x 8 density bytes resampled to D values in 0..1. Pure. */
export function embed(snap, D) {
  const b = snap.bytes, out = new Float32Array(D);
  for (let j = 0; j < D; j++) out[j] = (+b[Math.floor(j * b.length / D)] || 0) / 255;
  return out;
}

export function makeAdapter(field, { N, D }) {
  const L = layoutOf(N, D), code = codeOf(field), held = new Map(); // orb id -> slot
  const write = (start, data) => field.writeRegion(start, data.length, data, SKILL);
  const read = async (start, count) => Array.from(await field.readRegion(start, count) || []);
  let queue = Promise.resolve(); // one write pass at a time, in order, so a slow field never gets two passes interleaved
  const serial = (fn) => (queue = queue.then(fn, fn));

  async function claim(id) {
    if (held.has(id)) return held.get(id);
    const prov = await read(L.prov, N), taken = new Set(held.values());
    for (let i = 0; i < N; i++) if (!taken.has(i) && (prov[i] === 0 || prov[i] === code)) { held.set(id, i); return i; }
    return -1; // the field is full of other skills' memories: this orb stays on the card only
  }
  async function free(id) {
    const i = held.get(id); if (i == null) return; held.delete(id);
    await write(L.act + i, [0]); await write(L.prov + i, [0]);
  }
  async function put(s, o) {
    const i = await claim(o.id); if (i < 0) return -1;
    await write(L.pos + 3 * i, [o.x / F.GW, o.y / F.GH, 0]);
    await write(L.vel + 3 * i, [F.sample(s.u, o.x, o.y), F.sample(s.v, o.x, o.y), 0]);
    await write(L.emb + D * i, embed(F.orbSnapshot(s, o), D));
    await write(L.act + i, [Math.max(0, Math.min(1, o.mass / F.DMAX))]);
    await write(L.prov + i, [code]);
    return i;
  }
  return {
    layout: L, code,
    get held() { return held.size; },
    sync: (s) => serial(async () => { const live = new Set(s.orbs.map((o) => o.id)); for (const id of [...held.keys()]) if (!live.has(id)) await free(id); for (const o of s.orbs) await put(s, o); }),
    seal: (s, o) => serial(async () => { const slot = await put(s, o); if (slot < 0) return null; return { genomeId: String(await field.sealSlice(L.emb + D * slot, D)), slot }; }),
    slots: () => { try { return typeof field.slots === 'function' ? field.slots() : []; } catch (_) { return []; } }, // every live slot, others' too
    stats: async () => { const act = await read(L.act, N), prov = await read(L.prov, N); let own = 0, others = 0; for (let i = 0; i < N; i++) if (act[i] > 0) prov[i] === code ? own++ : prov[i] !== 0 && others++; return { own, others }; },
    close: () => serial(async () => { for (const id of [...held.keys()]) await free(id); })
  };
}

/** the shared field, when Verse has one: feature-detects skills/field.js and answers null (never throws) when it is not there. */
const FIELD_URL = new URL('../skills/field.js', import.meta.url).href; // looked up when asked, so a page without the file never breaks
export async function connectField({ load = () => import(FIELD_URL), device = null } = {}) {
  let mod;
  try { mod = await load(); } catch (_) { return null; } // no field.js yet: the orbs keep their own state, as they always have
  if (mod && !isField(mod) && isField(mod.default)) mod = mod.default;
  if (!isField(mod)) return null;
  let info; try { info = await mod.init(device); } catch (_) { return null; }
  const size = sizeOf(mod, info); if (!size) return null;
  return makeAdapter(mod, size);
}

let shared = null; // one connect per page, shared by every memory orbs card on it
export const fieldLink = () => shared || (shared = connectField().catch(() => null));
