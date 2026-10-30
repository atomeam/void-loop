// brain-workspace — Verse Brain's one working memory (owner, 2026-10-29: "combine all the builds into one entity"; "Unified working memory
// (the shared workspace)": one addressable field that every part reads and writes on each tick, with provenance tags). Every organ of the
// brain (lib/brain-organs.js) reads and writes this, and nothing else: no organ keeps a canvas or a private copy of the field.
//
//   layers   GW x GH Float32Array grids, all in 0..1:
//              input     where the senses landed (the visitor's pointer, tilt, sound, and the brain's own "hand" when it acts)
//              act/sub   the tissue: Gray-Scott activator and substrate (F021, F043, F187, F317 and the reaction-diffusion cluster)
//              phase     the rhythm: one Kuramoto phase per cell of a coarse RG x RH lattice, kept as 0..1 of a turn (F027, F034, F442)
//              surprise  where the predictor was wrong, decaying (F284, F277, F042 residual drafts)
//              memory    what the Hebbian memory expects to light up next (F297, F303)
//              focus     the attention scheduler's spotlight, the one thing it is thinking about (lib/brain-attention.js)
//   nodes    one table of bodies (struct of arrays, at most MAX_NODES): particles of the swarm, concept nodes, membrane masses.
//            kind 0..2 is a particle species, KIND.concept a word, KIND.membrane a mass of the skin. Each node has an 8-number embedding.
//   owner    per cell, which organ wrote it last (index into ws.organs), and when (the tick): "which skill last wrote this region?"
//
// Pure: no DOM, no clock, no Math.random. Positions are in the unit square; a cell index is y * GW + x.
import { clamp, makeGrid, rng, entropy, sha256Sync, canonical } from './field-kit.js';

export const GW = 64, GH = 48, CELLS = GW * GH;
export const RG = 16, RH = 12; // the rhythm lattice (one oscillator per 4x4 cells)
export const LAYERS = ['input', 'act', 'sub', 'surprise', 'memory', 'focus'];
export const MAX_NODES = 220, EMB = 8;
export const KIND = { concept: 3, membrane: 4 };
export const REGIONS_X = 4, REGIONS_Y = 3; // the coarse regions the attention, the memory and the self talk about

/** an empty workspace: layers, rhythm phases, the node table and the provenance grid. organs: the ids that may write. */
export function createWorkspace(seed = 1, organs = []) {
  const r = rng(seed);
  const ws = { seed, tick: 0, organs: organs.slice(), layers: {}, phase: new Float32Array(RG * RH), omega: new Float32Array(RG * RH),
    owner: new Uint8Array(CELLS).fill(255), wroteAt: new Uint32Array(CELLS), writes: new Uint32Array(Math.max(1, organs.length)),
    regionWrites: new Uint32Array(REGIONS_X * REGIONS_Y * (organs.length + 1)), // per region, per writer (the last column is the visitor): the contention monitor reads it
    nodes: makeNodes(), rand: r };
  for (const k of LAYERS) ws.layers[k] = makeGrid(GW, GH);
  ws.layers.sub.fill(1);
  for (let i = 0; i < RG * RH; i++) { ws.phase[i] = r(); ws.omega[i] = 0.9 + r() * 0.2; }
  return ws;
}
function makeNodes() {
  return { n: 0, x: new Float32Array(MAX_NODES), y: new Float32Array(MAX_NODES), vx: new Float32Array(MAX_NODES), vy: new Float32Array(MAX_NODES),
    kind: new Uint8Array(MAX_NODES), act: new Float32Array(MAX_NODES), emb: new Float32Array(MAX_NODES * EMB), owner: new Uint8Array(MAX_NODES).fill(255),
    label: new Array(MAX_NODES).fill('') };
}

export const ownerIndex = (ws, organ) => { const i = ws.organs.indexOf(organ); return i < 0 ? 254 : i; }; // 254: the visitor ("you")
export const cellOf = (x, y) => clamp(Math.floor(clamp(y, 0, 0.9999) * GH), 0, GH - 1) * GW + clamp(Math.floor(clamp(x, 0, 0.9999) * GW), 0, GW - 1);
export const regionOf = (x, y) => clamp(Math.floor(clamp(y, 0, 0.9999) * REGIONS_Y), 0, REGIONS_Y - 1) * REGIONS_X + clamp(Math.floor(clamp(x, 0, 0.9999) * REGIONS_X), 0, REGIONS_X - 1);
export const regionCenter = (r) => ({ x: ((r % REGIONS_X) + 0.5) / REGIONS_X, y: (Math.floor(r / REGIONS_X) + 0.5) / REGIONS_Y });

/** write one cell of a layer (clamped 0..1) and tag it with its writer. */
export function writeCell(ws, layer, i, v, organ) {
  ws.layers[layer][i] = clamp(v, 0, 1);
  const o = ownerIndex(ws, organ); ws.owner[i] = o; ws.wroteAt[i] = ws.tick; if (o < ws.writes.length) ws.writes[o]++;
  const W = ws.organs.length + 1, r = Math.floor(Math.floor(i / GW) * REGIONS_Y / GH) * REGIONS_X + Math.floor((i % GW) * REGIONS_X / GW);
  ws.regionWrites[r * W + (o < ws.organs.length ? o : W - 1)]++;
}
/** add amt to a layer in a soft disc around (x, y) (radius in cells), tagging each cell it changed. Returns the cells touched. */
export function deposit(ws, layer, x, y, amt, rad = 2, organ = 'you') {
  const g = ws.layers[layer], cx = x * GW, cy = y * GH, R = Math.max(1, Math.ceil(rad)); let n = 0;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const gx = Math.floor(cx) + dx, gy = Math.floor(cy) + dy; if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
    const d2 = (gx + 0.5 - cx) ** 2 + (gy + 0.5 - cy) ** 2; if (d2 > rad * rad) continue;
    const i = gy * GW + gx; writeCell(ws, layer, i, g[i] + amt * Math.exp(-d2 / (rad * rad)), organ); n++;
  }
  return n;
}
/** a region of a layer as numbers: { mean, max, at: {x, y} of the max }. rect = { x0, y0, x1, y1 } in the unit square (default: all). */
export function readRegion(ws, layer, rect = {}) {
  const g = ws.layers[layer], x0 = Math.floor((rect.x0 ?? 0) * GW), y0 = Math.floor((rect.y0 ?? 0) * GH), x1 = Math.ceil((rect.x1 ?? 1) * GW), y1 = Math.ceil((rect.y1 ?? 1) * GH);
  let s = 0, n = 0, mx = -1, mi = 0;
  for (let y = Math.max(0, y0); y < Math.min(GH, y1); y++) for (let x = Math.max(0, x0); x < Math.min(GW, x1); x++) { const i = y * GW + x, v = g[i]; s += v; n++; if (v > mx) { mx = v; mi = i; } }
  return { mean: n ? s / n : 0, max: Math.max(0, mx), at: { x: ((mi % GW) + 0.5) / GW, y: (Math.floor(mi / GW) + 0.5) / GH } };
}
/** the mean of a layer in each of the REGIONS_X x REGIONS_Y regions. */
export function regionMeans(ws, layer) {
  const g = ws.layers[layer], out = new Float32Array(REGIONS_X * REGIONS_Y), cnt = new Float32Array(REGIONS_X * REGIONS_Y);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const r = Math.floor(y * REGIONS_Y / GH) * REGIONS_X + Math.floor(x * REGIONS_X / GW); out[r] += g[y * GW + x]; cnt[r]++; }
  for (let r = 0; r < out.length; r++) out[r] /= cnt[r] || 1;
  return out;
}
/** who wrote a point last: { organ (id, or 'you'), tick } (organ null when nothing has written it). */
export function provenanceAt(ws, x, y) {
  const i = cellOf(x, y), o = ws.owner[i];
  return { organ: o === 255 ? null : o === 254 ? 'you' : ws.organs[o], tick: ws.wroteAt[i] };
}
/** each organ's share of the cells it was the last to write (the workspace's provenance map, for the self region and the ledger). */
export function ownership(ws) {
  const c = new Array(ws.organs.length + 1).fill(0);
  for (let i = 0; i < CELLS; i++) { const o = ws.owner[i]; if (o === 254) c[ws.organs.length]++; else if (o < ws.organs.length) c[o]++; }
  const out = {}; ws.organs.forEach((id, k) => { out[id] = c[k] / CELLS; }); out.you = c[ws.organs.length] / CELLS; return out;
}

// ---- nodes -----------------------------------------------------------------------------------------------------------------------------
/** add a node; returns its index, or -1 when the table is full. */
export function addNode(ws, { x, y, kind = 0, act = 0, emb = null, label = '', organ = 'you' }) {
  const N = ws.nodes; if (N.n >= MAX_NODES) return -1;
  const i = N.n++; N.x[i] = clamp(x, 0, 1); N.y[i] = clamp(y, 0, 1); N.vx[i] = 0; N.vy[i] = 0; N.kind[i] = kind; N.act[i] = act; N.label[i] = label;
  N.owner[i] = ownerIndex(ws, organ);
  for (let k = 0; k < EMB; k++) N.emb[i * EMB + k] = emb ? emb[k] || 0 : 0;
  return i;
}
/** the indices of the nodes of a kind (or kinds). */
export function nodesOf(ws, kinds) { const want = [].concat(kinds), out = []; for (let i = 0; i < ws.nodes.n; i++) if (want.includes(ws.nodes.kind[i])) out.push(i); return out; }

// ---- imagination needs an exact copy -----------------------------------------------------------------------------------------------------
/** a deep copy of everything that changes (layers, rhythm, nodes, provenance, tick); restore(ws, snap) puts it back exactly. */
export function snapshot(ws) {
  const N = ws.nodes;
  return { tick: ws.tick, layers: Object.fromEntries(LAYERS.map((k) => [k, ws.layers[k].slice()])), phase: ws.phase.slice(), omega: ws.omega.slice(),
    owner: ws.owner.slice(), wroteAt: ws.wroteAt.slice(), writes: ws.writes.slice(), regionWrites: ws.regionWrites.slice(),
    nodes: { n: N.n, x: N.x.slice(), y: N.y.slice(), vx: N.vx.slice(), vy: N.vy.slice(), kind: N.kind.slice(), act: N.act.slice(), emb: N.emb.slice(), owner: N.owner.slice(), label: N.label.slice() } };
}
export function restore(ws, s) {
  ws.tick = s.tick; for (const k of LAYERS) ws.layers[k].set(s.layers[k]); ws.phase.set(s.phase); ws.omega.set(s.omega);
  ws.owner.set(s.owner); ws.wroteAt.set(s.wroteAt); ws.writes.set(s.writes); ws.regionWrites.set(s.regionWrites);
  const N = ws.nodes, M = s.nodes; N.n = M.n; for (const k of ['x', 'y', 'vx', 'vy', 'kind', 'act', 'emb', 'owner']) N[k].set(M[k]); N.label = M.label.slice();
  return ws;
}

/** the workspace's own numbers, each 0..1: entropy of the tissue, its activity, the rhythm's order, mean surprise, where focus is. */
export function measure(ws) {
  const L = ws.layers; let act = 0, sur = 0, fx = 0, fy = 0, fw = 0;
  for (let i = 0; i < CELLS; i++) { act += L.act[i]; sur += L.surprise[i]; const f = L.focus[i]; if (f > 0.01) { fx += f * ((i % GW) + 0.5) / GW; fy += f * (Math.floor(i / GW) + 0.5) / GH; fw += f; } }
  let c = 0, s = 0; for (let i = 0; i < ws.phase.length; i++) { c += Math.cos(ws.phase[i] * 6.2832); s += Math.sin(ws.phase[i] * 6.2832); }
  return { entropy: entropy(L.act, 16, 0, 1), activity: clamp(act / CELLS * 4, 0, 1), order: Math.hypot(c, s) / ws.phase.length,
    surprise: clamp(sur / CELLS * 8, 0, 1), cx: fw ? fx / fw : 0.5, cy: fw ? fy / fw : 0.5 };
}

/** a SHA-256 of a slice of the workspace (layers by name, rounded to 2 places, and the node count): numbers only, never the visitor's path. */
export function sealSlice(ws, layers = ['act', 'memory'], extra = {}) {
  const body = { tick: ws.tick, nodes: ws.nodes.n, ...extra };
  for (const k of layers) { const means = regionMeans(ws, k); body[k] = Array.from(means, (v) => Math.round(v * 100) / 100); }
  const text = canonical(body), hash = sha256Sync(text);
  return { hash, short: hash.slice(0, 12), body };
}
