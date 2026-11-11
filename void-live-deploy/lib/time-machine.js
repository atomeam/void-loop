// time-machine — Deterministic State-Replay Time Machine (ADR-001 v1).
// A local-first, append-only event log and pure reducer for the stage workspace: state at cursor k is
//   State_k = fold(State_0, Events[0..k])
// so a session can be scrubbed, branched, and exported as a replay artifact. Bulk log/snapshots live in
// IndexedDB (DB_NAME); a tiny awareness pointer may live in localStorage via lib/state.js (tmMeta).
// Pure over the data handed in: no DOM, no clock reads, no Math.random, no network. External/LLM results
// are recorded in SKILL_RESOLVED (and card) payloads at execution time; replay rehydrates them, never re-invokes.
//
// Patterns: memory-graph.js (schema/versioned export-import, caps, local-only), brain-workspace.js
// (snapshot/restore discipline), placement.js & card-tidy.js (pure layout decisions recorded as facts).

export const EVENT_SCHEMA = 'verse.tm.event.v1';
export const STATE_SCHEMA = 'verse.tm.state.v1';
export const SNAPSHOT_SCHEMA = 'verse.tm.snapshot.v1';
export const BRANCH_SCHEMA = 'verse.tm.branch.v1';
export const REPLAY_SCHEMA = 'verse.tm.replay.v1';
export const DB_NAME = 'a2m.void.time-machine.v1';
export const SNAPSHOT_EVERY = 50;
export const IMPORT_MAX = 20 * 1024 * 1024; // 20 MB; refuse larger text before parse

export const EVENT_TYPES = new Set([
  'SESSION_STARTED',
  'ASK_SUBMITTED',
  'ASK_SPLIT',
  'SKILL_RESOLVED',
  'CARD_CREATED',
  'CARD_UPDATED',
  'CARD_MOVED',
  'CARD_PINNED',
  'CARD_UNPINNED',
  'CARD_KEPT',
  'CARD_REMOVED',
  'STAGE_CLEARED',
  'BRANCH_CREATED',
  'CHECKPOINT',
]);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const asStr = (v, max = 256) => (typeof v === 'string' ? v.slice(0, max) : '');
const asNum = (v, d = 0) => (Number.isFinite(v) ? v : d);
const asSeq = (v) => (Number.isInteger(v) && v >= 0 ? v : -1);
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

export function emptyState(baseline) {
  const b = isObj(baseline) ? baseline : {};
  const cards = {};
  if (isObj(b.cards)) {
    for (const [id, c] of Object.entries(b.cards)) {
      if (!isObj(c)) continue;
      cards[String(id)] = normalizeCard(String(id), c);
    }
  }
  const order = Array.isArray(b.order) ? b.order.map(String).filter((id) => cards[id]) : Object.keys(cards);
  return {
    schema: STATE_SCHEMA,
    cards,
    order,
    focus: isObj(b.focus) ? { cardId: b.focus.cardId ? String(b.focus.cardId) : null } : { cardId: null },
    camera: isObj(b.camera) ? clone(b.camera) : null,
    meta: { lastEventId: asStr(b.meta?.lastEventId, 128) || null, seq: Math.max(-1, asSeq(b.meta?.seq)), t: asNum(b.meta?.t, 0) },
  };
}

function normalizeRect(r) {
  const o = isObj(r) ? r : {};
  const rect = { x: asNum(o.x, 0), y: asNum(o.y, 0), w: Math.max(0, asNum(o.w, 0)), h: Math.max(0, asNum(o.h, 0)) };
  if (Number.isFinite(o.scale)) rect.scale = o.scale;
  return rect;
}

function normalizeCard(id, c) {
  const o = isObj(c) ? c : {};
  return {
    id: String(id || o.id || ''),
    kind: asStr(o.kind, 64) || 'card',
    rect: normalizeRect(o.rect),
    pinned: !!o.pinned,
    kept: !!o.kept,
    data: Object.prototype.hasOwnProperty.call(o, 'data') ? clone(o.data) : null,
    vpage: o.vpage ? clone(o.vpage) : null,
    visible: o.visible !== false,
  };
}

function copyState(state) {
  const s = state && state.schema === STATE_SCHEMA ? state : emptyState();
  const cards = {};
  for (const [id, c] of Object.entries(s.cards || {})) cards[id] = normalizeCard(id, c);
  const order = Array.isArray(s.order) ? s.order.map(String).filter((id) => cards[id]) : Object.keys(cards);
  for (const id of Object.keys(cards)) if (!order.includes(id)) order.push(id);
  return {
    schema: STATE_SCHEMA,
    cards,
    order,
    focus: isObj(s.focus) ? { cardId: s.focus.cardId ? String(s.focus.cardId) : null } : { cardId: null },
    camera: isObj(s.camera) ? clone(s.camera) : null,
    meta: { lastEventId: s.meta?.lastEventId || null, seq: asSeq(s.meta?.seq), t: asNum(s.meta?.t, 0) },
  };
}

function ensureCard(s, id) {
  if (!s.cards[id]) {
    s.cards[id] = normalizeCard(id, { id, kind: 'card', rect: { x: 0, y: 0, w: 0, h: 0 }, pinned: false, kept: false, data: null, visible: true });
    if (!s.order.includes(id)) s.order.push(id);
  }
  return s.cards[id];
}

// Pure, total reducer for known event types. Unknown types are ignored (forward-compatible).
export function reduce(state, event) {
  const s = copyState(state);
  if (!isObj(event) || !EVENT_TYPES.has(event.type)) return s;
  const t = event.type;
  const p = isObj(event.payload) ? event.payload : {};

  if (t === 'SESSION_STARTED') {
    const base = isObj(p.baseState) ? p.baseState : isObj(p.baseline) ? p.baseline : null;
    if (base) {
      const b = emptyState(base);
      s.cards = b.cards; s.order = b.order; s.focus = b.focus; s.camera = b.camera;
    }
  } else if (t === 'CARD_CREATED') {
    const id = asStr(p.cardId || event.refs?.cardId, 128);
    if (id) {
      const c = normalizeCard(id, {
        id, kind: p.kind, rect: p.rect, pinned: p.pinned, kept: p.kept, data: p.data, vpage: p.vpage, visible: p.visible !== false,
      });
      s.cards[id] = c;
      if (!s.order.includes(id)) s.order.push(id);
    }
  } else if (t === 'CARD_UPDATED') {
    const id = asStr(p.cardId || event.refs?.cardId, 128);
    if (id) {
      const c = ensureCard(s, id);
      if (Object.prototype.hasOwnProperty.call(p, 'data')) c.data = clone(p.data);
      else if (isObj(p.patch) && isObj(c.data)) c.data = { ...c.data, ...clone(p.patch) };
      else if (isObj(p.patch)) c.data = clone(p.patch);
      if (p.kind) c.kind = asStr(p.kind, 64);
      if (isObj(p.rect)) c.rect = normalizeRect(p.rect);
      if (p.vpage) c.vpage = clone(p.vpage);
    }
  } else if (t === 'CARD_MOVED') {
    const id = asStr(p.cardId || event.refs?.cardId, 128);
    if (id && s.cards[id]) {
      const c = s.cards[id];
      const to = isObj(p.to) ? p.to : p;
      if (to && (Number.isFinite(to.x) || Number.isFinite(to.y) || Number.isFinite(to.w) || Number.isFinite(to.h) || Number.isFinite(to.scale))) {
        c.rect = {
          x: Number.isFinite(to.x) ? to.x : c.rect.x,
          y: Number.isFinite(to.y) ? to.y : c.rect.y,
          w: Number.isFinite(to.w) ? Math.max(0, to.w) : c.rect.w,
          h: Number.isFinite(to.h) ? Math.max(0, to.h) : c.rect.h,
        };
        if (Number.isFinite(to.scale)) c.rect.scale = to.scale;
        else if ('scale' in to) delete c.rect.scale;
      }
    }
  } else if (t === 'CARD_PINNED') {
    const id = asStr(p.cardId || event.refs?.cardId, 128); if (id && s.cards[id]) s.cards[id].pinned = true;
  } else if (t === 'CARD_UNPINNED') {
    const id = asStr(p.cardId || event.refs?.cardId, 128); if (id && s.cards[id]) s.cards[id].pinned = false;
  } else if (t === 'CARD_KEPT') {
    const id = asStr(p.cardId || event.refs?.cardId, 128); if (id && s.cards[id]) s.cards[id].kept = true;
  } else if (t === 'CARD_REMOVED') {
    const id = asStr(p.cardId || event.refs?.cardId, 128);
    if (id && s.cards[id]) { delete s.cards[id]; s.order = s.order.filter((x) => x !== id); if (s.focus.cardId === id) s.focus.cardId = null; }
  } else if (t === 'STAGE_CLEARED') {
    s.cards = {}; s.order = []; s.focus = { cardId: null };
  } else if (t === 'ASK_SUBMITTED' || t === 'ASK_SPLIT' || t === 'SKILL_RESOLVED' || t === 'BRANCH_CREATED' || t === 'CHECKPOINT') {
    // recorded facts; no direct stage-geometry mutation in v1 reducer
  }

  s.meta.lastEventId = asStr(event.id, 128) || s.meta.lastEventId;
  if (asSeq(event.seq) >= 0) s.meta.seq = asSeq(event.seq);
  if (Number.isFinite(event.t)) s.meta.t = asNum(event.t, s.meta.t);
  return s;
}

export function fold(state0, events) {
  let s = copyState(state0);
  for (const e of Array.isArray(events) ? events : []) s = reduce(s, e);
  return s;
}

export function snapshotOf(state, { id, branchId, seq, eventId, t, hash } = {}) {
  return {
    schema: SNAPSHOT_SCHEMA,
    id: asStr(id, 128) || `snap_${branchId || 'br'}_${Number.isInteger(seq) ? seq : -1}`,
    branchId: asStr(branchId, 128) || 'br_main',
    seq: asSeq(seq),
    eventId: asStr(eventId, 128) || null,
    t: asNum(t, 0),
    state: copyState(state),
    ...(hash ? { hash: asStr(hash, 128) } : {}),
  };
}

export function restoreSnapshot(snap) {
  if (!isObj(snap) || !isObj(snap.state)) return null;
  return copyState(snap.state);
}

// events: array of events in effective order for the branch up to target (or filterable). snapshots: array.
// Returns reconstructed state at targetSeq (inclusive) on branchId.
export function stateAt({ state0, events = [], snapshots = [], branchId = 'br_main', targetSeq = Infinity } = {}) {
  const limit = Number.isFinite(targetSeq) ? targetSeq : Infinity;
  const snaps = (Array.isArray(snapshots) ? snapshots : [])
    .filter((s) => s && s.branchId === branchId && asSeq(s.seq) >= 0 && asSeq(s.seq) <= limit)
    .sort((a, b) => asSeq(a.seq) - asSeq(b.seq));
  const baseSnap = snaps.length ? snaps[snaps.length - 1] : null;
  let base = baseSnap ? restoreSnapshot(baseSnap) : copyState(state0 || emptyState());
  const fromSeq = baseSnap ? asSeq(baseSnap.seq) : -1;
  const evs = (Array.isArray(events) ? events : [])
    .filter((e) => e && e.branchId === branchId && asSeq(e.seq) > fromSeq && asSeq(e.seq) <= limit)
    .sort((a, b) => asSeq(a.seq) - asSeq(b.seq));
  return fold(base, evs);
}

export function validateEvent(e) {
  if (!isObj(e)) return { ok: false, why: 'event must be an object' };
  if (e.schema !== EVENT_SCHEMA) return { ok: false, why: `schema must be ${EVENT_SCHEMA}` };
  if (!asStr(e.id, 128)) return { ok: false, why: 'id required' };
  if (!asStr(e.branchId, 128)) return { ok: false, why: 'branchId required' };
  if (!EVENT_TYPES.has(e.type)) return { ok: false, why: 'unknown type' };
  if (asSeq(e.seq) < 0) return { ok: false, why: 'seq must be a non-negative integer' };
  if (!Number.isFinite(e.t)) return { ok: false, why: 't must be a number' };
  if (!['user', 'system', 'agent', 'skill'].includes(e.actor)) return { ok: false, why: 'invalid actor' };
  return { ok: true };
}

export function normalizeEvent(e) {
  if (!isObj(e)) return null;
  const out = {
    schema: EVENT_SCHEMA,
    id: asStr(e.id, 128),
    seq: asSeq(e.seq),
    branchId: asStr(e.branchId, 128),
    parentId: e.parentId == null ? null : asStr(e.parentId, 128),
    t: asNum(e.t, 0),
    actor: ['user', 'system', 'agent', 'skill'].includes(e.actor) ? e.actor : 'system',
    type: asStr(e.type, 64),
    payload: Object.prototype.hasOwnProperty.call(e, 'payload') ? clone(e.payload) : {},
    refs: isObj(e.refs) ? clone(e.refs) : {},
  };
  return validateEvent(out).ok ? out : null;
}

export function makeBranch({ id, name, headEventId = null, headSeq = -1, parent = null, createdAt = 0, forkedFromAskEventId = null } = {}) {
  return {
    schema: BRANCH_SCHEMA,
    id: asStr(id, 128) || 'br_main',
    name: asStr(name, 80) || asStr(id, 80) || 'main',
    headEventId: headEventId ? asStr(headEventId, 128) : null,
    headSeq: asSeq(headSeq),
    parent: parent && isObj(parent) ? { branchId: asStr(parent.branchId, 128), eventId: asStr(parent.eventId, 128), seq: asSeq(parent.seq) } : null,
    createdAt: asNum(createdAt, 0),
    forkedFromAskEventId: forkedFromAskEventId ? asStr(forkedFromAskEventId, 128) : null,
  };
}

// Assemble effective ordered event list for a branch by following parent links (DAG lineage).
// branches: { [id]: Branch } or array; eventsByBranch: { [branchId]: Event[] } (each sorted by seq).
// For each ancestor, only events up to the fork point recorded on its child are included; the leaf includes all its events.
export function effectiveEvents({ branches, eventsByBranch, branchId } = {}) {
  const byId = Array.isArray(branches)
    ? Object.fromEntries(branches.map((b) => [b.id, b]))
    : (isObj(branches) ? branches : {});
  const chain = []; // root -> ... -> leaf
  let cur = byId[branchId];
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(cur);
    cur = cur.parent ? byId[cur.parent.branchId] : null;
  }
  chain.reverse();
  const out = [];
  for (let i = 0; i < chain.length; i++) {
    const b = chain[i];
    const child = chain[i + 1] || null;
    const list = (eventsByBranch && eventsByBranch[b.id]) ? eventsByBranch[b.id] : [];
    const sorted = list.slice().sort((a, c) => asSeq(a.seq) - asSeq(c.seq));
    if (child && child.parent && child.parent.branchId === b.id && Number.isInteger(child.parent.seq)) {
      for (const e of sorted) if (asSeq(e.seq) <= child.parent.seq) out.push(e);
    } else {
      out.push(...sorted);
    }
  }
  // de-dupe by id preserving order
  const seenId = new Set();
  return out.filter((e) => e && e.id && !seenId.has(e.id) && seenId.add(e.id));
}

export function exportReplay({ branches = [], events = [], snapshots = [], active = null, app = { product: 'Verse' } } = {}, at = Date.now()) {
  const normBranches = (Array.isArray(branches) ? branches : Object.values(branches || {})).map((b) => makeBranch(b));
  const normEvents = (Array.isArray(events) ? events : []).map(normalizeEvent).filter(Boolean);
  const normSnaps = (Array.isArray(snapshots) ? snapshots : [])
    .filter((s) => isObj(s) && s.schema === SNAPSHOT_SCHEMA && isObj(s.state))
    .map((s) => ({ ...s, state: copyState(s.state) }));
  return {
    schema: REPLAY_SCHEMA,
    exportedAt: new Date(asNum(at, Date.now())).toISOString(),
    app: isObj(app) ? { ...app } : { product: 'Verse' },
    active: isObj(active) ? { branchId: asStr(active.branchId, 128), cursorSeq: asSeq(active.cursorSeq) } : null,
    branches: normBranches,
    events: normEvents,
    snapshots: normSnaps,
  };
}

export function importReplay(input) {
  let j = input;
  if (typeof input === 'string') {
    if (input.length > IMPORT_MAX) return { ok: false, why: 'replay is too large' };
    try { j = JSON.parse(input); } catch { return { ok: false, why: 'not valid JSON' }; }
  }
  if (!isObj(j) || j.schema !== REPLAY_SCHEMA) return { ok: false, why: `schema must be ${REPLAY_SCHEMA}` };
  const branches = Array.isArray(j.branches) ? j.branches.map(makeBranch) : [];
  const events = Array.isArray(j.events) ? j.events.map(normalizeEvent).filter(Boolean) : [];
  const snapshots = Array.isArray(j.snapshots)
    ? j.snapshots.filter((s) => isObj(s) && s.schema === SNAPSHOT_SCHEMA && isObj(s.state)).map((s) => ({ ...s, id: asStr(s.id, 128), branchId: asStr(s.branchId, 128), seq: asSeq(s.seq), eventId: s.eventId ? asStr(s.eventId, 128) : null, t: asNum(s.t, 0), state: copyState(s.state) }))
    : [];
  const active = isObj(j.active) ? { branchId: asStr(j.active.branchId, 128) || (branches[0]?.id || 'br_main'), cursorSeq: asSeq(j.active.cursorSeq) } : null;
  return { ok: true, replay: { schema: REPLAY_SCHEMA, exportedAt: j.exportedAt || null, app: isObj(j.app) ? j.app : { product: 'Verse' }, active, branches, events, snapshots } };
}

// In-memory store for tests / non-IDB environments.
export function memoryStore() {
  const db = { events: [], snapshots: [], branches: {}, meta: {} };
  return {
    db,
    async appendEvent(e) { const n = normalizeEvent(e); if (!n) throw new Error('invalid event'); db.events.push(n); return n; },
    async putSnapshot(s) { if (!isObj(s)) return null; const i = db.snapshots.findIndex((x) => x.id === s.id); if (i >= 0) db.snapshots[i] = s; else db.snapshots.push(s); return s; },
    async putBranch(b) { const n = makeBranch(b); db.branches[n.id] = n; return n; },
    async setMeta(k, v) { db.meta[k] = v; },
    async getMeta(k) { return db.meta[k]; },
    async getEvents(branchId) { return db.events.filter((e) => !branchId || e.branchId === branchId).sort((a, b) => a.seq - b.seq); },
    async getAllEvents() { return db.events.slice().sort((a, b) => (a.branchId === b.branchId ? a.seq - b.seq : String(a.branchId).localeCompare(String(b.branchId)))); },
    async getSnapshots(branchId) { return db.snapshots.filter((s) => !branchId || s.branchId === branchId).sort((a, b) => a.seq - b.seq); },
    async getBranches() { return { ...db.branches }; },
  };
}

// Compute state at cursor using a store-like object (sync arrays accepted via {events,snapshots}).
export async function stateAtCursor(storeOrData, { branchId = 'br_main', targetSeq = Infinity, state0 } = {}) {
  const events = storeOrData.events ? storeOrData.events : await storeOrData.getAllEvents();
  const snapshots = storeOrData.snapshots ? storeOrData.snapshots : await storeOrData.getSnapshots(branchId);
  return stateAt({ state0, events, snapshots, branchId, targetSeq });
}
