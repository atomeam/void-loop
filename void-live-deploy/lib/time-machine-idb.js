// IndexedDB storage adapter for the Time Machine (ADR-001 v1).
// Implements the same async interface as memoryStore() in time-machine.js:
//   appendEvent, putSnapshot, putBranch, setMeta/getMeta,
//   getEvents(branchId?), getAllEvents(), getSnapshots(branchId?), getBranches()
// Data lives in DB_NAME with stores: events, snapshots, branches, meta.

import { DB_NAME, EVENT_SCHEMA, SNAPSHOT_SCHEMA, BRANCH_SCHEMA, normalizeEvent, makeBranch } from './time-machine.js';

const DB_VERSION = 1;
const STORES = { events: 'events', snapshots: 'snapshots', branches: 'branches', meta: 'meta' };

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('idb request failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('idb tx failed'));
    tx.onabort = () => reject(tx.error || new Error('idb tx aborted'));
  });
}

export function openTmDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.events)) {
        const ev = db.createObjectStore(STORES.events, { keyPath: 'id' });
        ev.createIndex('by_branch', 'branchId', { unique: false });
        ev.createIndex('by_seq', ['branchId', 'seq'], { unique: false });
        ev.createIndex('by_t', 't', { unique: false });
        ev.createIndex('by_parent', 'parentId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.snapshots)) {
        const sn = db.createObjectStore(STORES.snapshots, { keyPath: 'id' });
        sn.createIndex('by_branch', 'branchId', { unique: false });
        sn.createIndex('by_branch_seq', ['branchId', 'seq'], { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.branches)) {
        db.createObjectStore(STORES.branches, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('failed to open tm db'));
  });
}

export async function createIdbStore(dbOrPromise) {
  const db = await dbOrPromise;
  const rw = (names) => db.transaction(names, 'readwrite');
  const ro = (names) => db.transaction(names, 'readonly');

  async function appendEvent(e) {
    const n = normalizeEvent(e);
    if (!n) throw new Error('invalid event');
    const tx = rw([STORES.events]);
    tx.objectStore(STORES.events).put(n);
    await txDone(tx);
    return n;
  }
  async function putSnapshot(s) {
    if (!s || typeof s !== 'object' || s.schema !== SNAPSHOT_SCHEMA) throw new Error('invalid snapshot');
    const tx = rw([STORES.snapshots]);
    tx.objectStore(STORES.snapshots).put(s);
    await txDone(tx);
    return s;
  }
  async function putBranch(b) {
    const n = makeBranch(b);
    const tx = rw([STORES.branches]);
    tx.objectStore(STORES.branches).put(n);
    await txDone(tx);
    return n;
  }
  async function setMeta(k, v) {
    const tx = rw([STORES.meta]);
    tx.objectStore(STORES.meta).put({ key: String(k), value: v });
    await txDone(tx);
  }
  async function getMeta(k) {
    const tx = ro([STORES.meta]);
    const row = await reqToPromise(tx.objectStore(STORES.meta).get(String(k)));
    return row ? row.value : undefined;
  }
  async function getEvents(branchId) {
    const tx = ro([STORES.events]);
    const store = tx.objectStore(STORES.events);
    let rows;
    if (branchId) rows = await reqToPromise(store.index('by_branch').getAll(String(branchId)));
    else rows = await reqToPromise(store.getAll());
    return (rows || []).sort((a, b) => (a.seq || 0) - (b.seq || 0));
  }
  async function getAllEvents() {
    const tx = ro([STORES.events]);
    const rows = await reqToPromise(tx.objectStore(STORES.events).getAll());
    return (rows || []).sort((a, b) => (a.branchId === b.branchId ? (a.seq || 0) - (b.seq || 0) : String(a.branchId || '').localeCompare(String(b.branchId || ''))));
  }
  async function getSnapshots(branchId) {
    const tx = ro([STORES.snapshots]);
    const store = tx.objectStore(STORES.snapshots);
    let rows;
    if (branchId) rows = await reqToPromise(store.index('by_branch').getAll(String(branchId)));
    else rows = await reqToPromise(store.getAll());
    return (rows || []).sort((a, b) => (a.seq || 0) - (b.seq || 0));
  }
  async function getBranches() {
    const tx = ro([STORES.branches]);
    const rows = await reqToPromise(tx.objectStore(STORES.branches).getAll());
    const out = {};
    for (const b of rows || []) if (b && b.id) out[b.id] = b;
    return out;
  }

  return { db, appendEvent, putSnapshot, putBranch, setMeta, getMeta, getEvents, getAllEvents, getSnapshots, getBranches };
}

// Convenience: open and return a ready store.
export async function openTmStore() {
  return createIdbStore(openTmDb());
}
