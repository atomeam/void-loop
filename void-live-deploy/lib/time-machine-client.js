// Time Machine runtime (ADR-001 v1, MVP): records stage events, maintains head/snapshots,
// projects head to legacy state, and supports scrub/branch/export.
// Loaded by the stage (void.html). Uses time-machine.js (pure) + time-machine-idb.js (persistence).

import {
  EVENT_SCHEMA, STATE_SCHEMA, REPLAY_SCHEMA, SNAPSHOT_EVERY,
  emptyState, reduce, fold, snapshotOf, restoreSnapshot, stateAt, effectiveEvents,
  makeBranch, normalizeEvent, exportReplay, memoryStore,
} from './time-machine.js';
import { openTmStore } from './time-machine-idb.js';

const now = () => Date.now();
const uid = (p = 'evt') => p + '_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

function canIdb() { try { return typeof indexedDB !== 'undefined'; } catch { return false; } }

export async function createTmRuntime({ getStageState, applyStageState, onChange } = {}) {
  const store = canIdb() ? await openTmStore().catch(() => memoryStore()) : memoryStore();
  let branches = await store.getBranches();
  if (!branches || !Object.keys(branches).length) {
    const root = makeBranch({ id: 'br_main', name: 'main', headSeq: -1, createdAt: now() });
    await store.putBranch(root);
    branches = await store.getBranches();
  }
  let active = await store.getMeta('active');
  if (!active || !branches[active.branchId]) {
    const b = branches.br_main || Object.values(branches)[0];
    active = { branchId: b.id, cursorSeq: b.headSeq };
  }
  let seq = (branches[active.branchId]?.headSeq ?? -1);
  let scrubbing = false;

  async function persistActive() { await store.setMeta('active', active); }

  async function allData() {
    const events = await store.getAllEvents();
    const snapshots = await store.getSnapshots();
    const br = await store.getBranches();
    return { events, snapshots, branches: br };
  }

  async function headState() {
    const { events, snapshots } = await allData();
    const base = getStageState ? getStageState() : emptyState();
    // reconstruct from recorded history on active branch lineage
    const bmap = await store.getBranches();
    const byBranch = {};
    for (const e of events) { (byBranch[e.branchId] ||= []).push(e); }
    const eff = effectiveEvents({ branches: bmap, eventsByBranch: byBranch, branchId: active.branchId });
    if (!eff.length) return typeof base === 'object' ? base : emptyState();
    // use snapshots on active branch; fold effective up to head
    const headSeq = bmap[active.branchId]?.headSeq ?? -1;
    return stateAt({ state0: emptyState(), events: eff, snapshots: snapshots.filter(s => s.branchId === active.branchId), branchId: active.branchId, targetSeq: headSeq });
  }

  async function maybeSnapshot(event) {
    const b = (await store.getBranches())[active.branchId];
    if (!b) return;
    if (b.headSeq < 0 || (b.headSeq % SNAPSHOT_EVERY !== 0 && event.type !== 'CHECKPOINT')) return;
    const st = await headState();
    const snap = snapshotOf(st, { id: uid('snap'), branchId: active.branchId, seq: b.headSeq, eventId: event.id, t: event.t });
    await store.putSnapshot(snap);
  }

  async function record(type, payload = {}, { actor = 'user', refs = {}, t = now(), parentId = null } = {}) {
    if (scrubbing) return null; // view-only while scrubbed; mutations fork explicitly
    seq += 1;
    const e = normalizeEvent({
      schema: EVENT_SCHEMA, id: uid('evt'), seq, branchId: active.branchId,
      parentId, t, actor, type, payload, refs,
    });
    if (!e) { seq -= 1; return null; }
    await store.appendEvent(e);
    const b = (await store.getBranches())[active.branchId] || makeBranch({ id: active.branchId });
    b.headEventId = e.id; b.headSeq = e.seq; await store.putBranch(b);
    active.cursorSeq = e.seq; await persistActive();
    await maybeSnapshot(e);
    if (onChange) try { onChange({ kind: 'record', event: e, active: { ...active } }); } catch {}
    return e;
  }

  async function scrubTo(targetSeq) {
    const b = (await store.getBranches())[active.branchId];
    const head = b?.headSeq ?? -1;
    const clamped = Math.max(-1, Math.min(Number.isInteger(targetSeq) ? targetSeq : head, head));
    active.cursorSeq = clamped;
    scrubbing = clamped < head;
    await persistActive();
    const st = await stateAtCursor(store, { branchId: active.branchId, targetSeq: clamped, state0: emptyState() });
    if (scrubbing && applyStageState) try { applyStageState(st, { scrubbing: true, seq: clamped }); } catch {}
    if (!scrubbing && applyStageState) try { applyStageState(st, { scrubbing: false, seq: clamped }); } catch {}
    if (onChange) try { onChange({ kind: 'scrub', state: st, active: { ...active }, scrubbing }); } catch {}
    return st;
  }

  async function forkFrom(cursorSeq, name) {
    const bmap = await store.getBranches();
    const fromB = bmap[active.branchId];
    const at = Math.max(-1, Math.min(Number.isInteger(cursorSeq) ? cursorSeq : active.cursorSeq, fromB?.headSeq ?? -1));
    const events = await store.getEvents(active.branchId);
    const atEvent = events.find((e) => e.seq === at) || null;
    const id = 'br_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 5);
    const nb = makeBranch({ id, name: name || id, parent: { branchId: active.branchId, eventId: atEvent?.id || null, seq: at }, headSeq: at, createdAt: now() });
    await store.putBranch(nb);
    // seed snapshot at fork point for fast reconstruction
    const st = await stateAtCursor(store, { branchId: active.branchId, targetSeq: at, state0: emptyState() });
    await store.putSnapshot(snapshotOf(st, { id: uid('snap'), branchId: id, seq: at, eventId: atEvent?.id || null, t: now() }));
    active = { branchId: id, cursorSeq: at };
    seq = at; scrubbing = false;
    await persistActive();
    await record('BRANCH_CREATED', { from: { branchId: fromB?.id, seq: at, eventId: atEvent?.id || null }, newBranchId: id, name: nb.name }, { actor: 'system' });
    if (onChange) try { onChange({ kind: 'branch', active: { ...active } }); } catch {}
    return nb;
  }

  async function exportBundle() {
    const data = await allData();
    return exportReplay({ branches: Object.values(data.branches), events: data.events, snapshots: data.snapshots, active }, now());
  }

  function isScrubbing() { return scrubbing; }
  function getActive() { return { ...active }; }

  // project head state to legacy stage key (caller provides writer) - only at head
  async function projectHead(writeLegacy) {
    if (scrubbing) return null;
    const st = await headState();
    if (writeLegacy) try { writeLegacy(st); } catch {}
    return st;
  }

  return { store, record, scrubTo, forkFrom, exportBundle, headState, stateAtCursor: (targetSeq) => stateAtCursor(store, { branchId: active.branchId, targetSeq, state0: emptyState() }), projectHead, isScrubbing, getActive, allData };
}
