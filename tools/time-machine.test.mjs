// Deterministic State-Replay Time Machine (ADR-001 v1) — core engine.
// node --test tools/time-machine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_SCHEMA, STATE_SCHEMA, SNAPSHOT_SCHEMA, REPLAY_SCHEMA, DB_NAME, SNAPSHOT_EVERY,
  EVENT_TYPES, emptyState, reduce, fold, snapshotOf, restoreSnapshot, stateAt,
  validateEvent, normalizeEvent, makeBranch, effectiveEvents, exportReplay, importReplay,
  memoryStore, stateAtCursor,
} from '../void-live-deploy/lib/time-machine.js';
import { STORES } from '../void-live-deploy/lib/state.js';

const T0 = 1731364800000;
const ev = (over = {}) => ({
  schema: EVENT_SCHEMA, id: over.id || 'evt_1', seq: over.seq ?? 0, branchId: over.branchId || 'br_main',
  parentId: over.parentId ?? null, t: over.t ?? T0, actor: over.actor || 'user', type: over.type || 'ASK_SUBMITTED',
  payload: over.payload ?? {}, refs: over.refs ?? {}, ...over,
});

test('constants and tmMeta store are registered', () => {
  assert.equal(EVENT_SCHEMA, 'verse.tm.event.v1');
  assert.equal(STATE_SCHEMA, 'verse.tm.state.v1');
  assert.equal(SNAPSHOT_SCHEMA, 'verse.tm.snapshot.v1');
  assert.equal(REPLAY_SCHEMA, 'verse.tm.replay.v1');
  assert.equal(DB_NAME, 'a2m.void.time-machine.v1');
  assert.equal(SNAPSHOT_EVERY, 50);
  assert.ok(EVENT_TYPES.has('ASK_SUBMITTED') && EVENT_TYPES.has('CARD_CREATED') && EVENT_TYPES.has('BRANCH_CREATED'));
  assert.equal(STORES.tmMeta.key, 'a2m.void.tm.meta.v1');
  assert.ok(!STORES.tmMeta.secret);
});

test('emptyState and baseline projection', () => {
  const s0 = emptyState();
  assert.equal(s0.schema, STATE_SCHEMA);
  assert.deepEqual(s0.cards, {});
  assert.deepEqual(s0.order, []);
  assert.equal(s0.meta.seq, -1);
  const b = emptyState({ cards: { c1: { id: 'c1', kind: 'note', rect: { x: 1, y: 2, w: 3, h: 4 }, pinned: true, data: { t: 'hi' } } }, order: ['c1'], meta: { seq: 2, t: T0 } });
  assert.equal(b.cards.c1.kind, 'note');
  assert.equal(b.cards.c1.rect.x, 1);
  assert.equal(b.cards.c1.pinned, true);
  assert.deepEqual(b.order, ['c1']);
});

test('reduce is pure and deterministic for card lifecycle', () => {
  const s0 = emptyState();
  const eCreate = ev({ id: 'e1', seq: 0, type: 'CARD_CREATED', payload: { cardId: 'c1', kind: 'clock', rect: { x: 10, y: 20, w: 100, h: 80 }, data: { a: 1 } } });
  const s1 = reduce(s0, eCreate);
  const s1b = reduce(s0, eCreate);
  assert.deepEqual(s1, s1b);
  assert.notEqual(s1, s0);
  assert.deepEqual(Object.keys(s0.cards), [], 'original untouched');
  assert.equal(s1.cards.c1.kind, 'clock');
  assert.deepEqual(s1.order, ['c1']);

  const s2 = reduce(s1, ev({ id: 'e2', seq: 1, type: 'CARD_MOVED', payload: { cardId: 'c1', to: { x: 50, y: 60 } } }));
  assert.equal(s2.cards.c1.rect.x, 50);
  assert.equal(s2.cards.c1.rect.w, 100, 'width preserved when not provided');

  const s3 = reduce(s2, ev({ id: 'e3', seq: 2, type: 'CARD_PINNED', payload: { cardId: 'c1' } }));
  assert.equal(s3.cards.c1.pinned, true);
  const s4 = reduce(s3, ev({ id: 'e4', seq: 3, type: 'CARD_KEPT', payload: { cardId: 'c1' } }));
  assert.equal(s4.cards.c1.kept, true);
  const s5 = reduce(s4, ev({ id: 'e5', seq: 4, type: 'CARD_UPDATED', payload: { cardId: 'c1', data: { b: 2 } } }));
  assert.deepEqual(s5.cards.c1.data, { b: 2 });
  const s6 = reduce(s5, ev({ id: 'e6', seq: 5, type: 'CARD_REMOVED', payload: { cardId: 'c1' } }));
  assert.deepEqual(s6.cards, {});
  assert.deepEqual(s6.order, []);
});

test('unknown event types are ignored (forward-compatible)', () => {
  const s0 = emptyState();
  const s1 = reduce(s0, { schema: EVENT_SCHEMA, id: 'x', seq: 0, branchId: 'br_main', parentId: null, t: T0, actor: 'system', type: 'FUTURE_TYPE', payload: {} });
  assert.deepEqual(s1.cards, s0.cards);
  assert.equal(s1.meta.lastEventId, s0.meta.lastEventId);
});

test('recorded-fact events do not mutate geometry', () => {
  const s0 = emptyState();
  const s1 = reduce(s0, ev({ type: 'ASK_SUBMITTED', payload: { text: 'make a clock' } }));
  assert.deepEqual(s1.cards, {});
  const s2 = reduce(s1, ev({ id: 'e2', seq: 1, type: 'SKILL_RESOLVED', payload: { skill: 'clock', ok: true } }));
  assert.deepEqual(s2.cards, {});
});

test('SESSION_STARTED with baseState projects baseline', () => {
  const base = { cards: { a: { id: 'a', kind: 'note', rect: { x: 0, y: 0, w: 1, h: 1 } } }, order: ['a'] };
  const s = fold(emptyState(), [ev({ type: 'SESSION_STARTED', payload: { baseState: base } })]);
  assert.equal(s.cards.a.kind, 'note');
  assert.deepEqual(s.order, ['a']);
});

test('fold and stateAt: full replay equals snapshot+fold', () => {
  const events = [];
  events.push(ev({ id: 'e0', seq: 0, type: 'SESSION_STARTED', payload: {} }));
  events.push(ev({ id: 'e1', seq: 1, type: 'CARD_CREATED', payload: { cardId: 'c1', kind: 'clock', rect: { x: 0, y: 0, w: 10, h: 10 } } }));
  for (let i = 2; i < 60; i++) events.push(ev({ id: 'e' + i, seq: i, type: 'CARD_MOVED', payload: { cardId: 'c1', to: { x: i, y: i } } }));
  const full = fold(emptyState(), events);
  assert.equal(full.cards.c1.rect.x, 59);

  const snap = snapshotOf(fold(emptyState(), events.slice(0, 51)), { id: 's50', branchId: 'br_main', seq: 50, eventId: 'e50', t: T0 + 50 });
  const viaSnap = stateAt({ state0: emptyState(), events, snapshots: [snap], branchId: 'br_main', targetSeq: 59 });
  assert.deepEqual(viaSnap.cards.c1.rect, full.cards.c1.rect);
  assert.equal(viaSnap.meta.seq, full.meta.seq);

  const at10 = stateAt({ state0: emptyState(), events, snapshots: [snap], branchId: 'br_main', targetSeq: 10 });
  assert.equal(at10.cards.c1.rect.x, 10);
});

test('snapshotOf / restoreSnapshot round-trip', () => {
  const s = fold(emptyState(), [ev({ type: 'CARD_CREATED', payload: { cardId: 'c1', kind: 'note', rect: { x: 1, y: 2, w: 3, h: 4 }, data: { v: 1 } } })]);
  const snap = snapshotOf(s, { id: 's1', branchId: 'br_main', seq: 0, eventId: 'e0', t: T0 });
  assert.equal(snap.schema, SNAPSHOT_SCHEMA);
  const r = restoreSnapshot(snap);
  assert.deepEqual(r, s);
  r.cards.c1.rect.x = 999;
  assert.equal(s.cards.c1.rect.x, 1, 'restore returns copy');
  assert.equal(restoreSnapshot(null), null);
});

test('validateEvent / normalizeEvent', () => {
  const good = ev({ id: 'a', seq: 0, branchId: 'br_main' });
  assert.equal(validateEvent(good).ok, true);
  assert.equal(validateEvent({}).ok, false);
  assert.equal(validateEvent({ ...good, schema: 'nope' }).ok, false);
  assert.equal(validateEvent({ ...good, type: 'NOPE' }).ok, false);
  assert.equal(validateEvent({ ...good, seq: -1 }).ok, false);
  assert.equal(validateEvent({ ...good, actor: 'alien' }).ok, false);
  const n = normalizeEvent(good);
  assert.equal(n.id, 'a');
  assert.equal(normalizeEvent({ bad: true }), null);
});

test('branching: effectiveEvents assembles DAG lineage', () => {
  const brMain = makeBranch({ id: 'br_main', name: 'main', headSeq: 2 });
  const brAlt = makeBranch({ id: 'br_alt', name: 'alt', parent: { branchId: 'br_main', eventId: 'e1', seq: 1 }, headSeq: 3 });
  const eventsByBranch = {
    br_main: [
      ev({ id: 'e0', seq: 0, branchId: 'br_main', type: 'SESSION_STARTED' }),
      ev({ id: 'e1', seq: 1, branchId: 'br_main', type: 'ASK_SUBMITTED', payload: { text: 'a' } }),
      ev({ id: 'e2', seq: 2, branchId: 'br_main', type: 'ASK_SUBMITTED', payload: { text: 'b' } }),
    ],
    br_alt: [
      ev({ id: 'e1', seq: 1, branchId: 'br_alt', type: 'ASK_SUBMITTED', payload: { text: 'a' } }), // shared up to fork
      ev({ id: 'e3', seq: 2, branchId: 'br_alt', type: 'ASK_SUBMITTED', payload: { text: 'c' } }),
      ev({ id: 'e4', seq: 3, branchId: 'br_alt', type: 'ASK_SUBMITTED', payload: { text: 'd' } }),
    ],
  };
  const eff = effectiveEvents({ branches: [brMain, brAlt], eventsByBranch, branchId: 'br_alt' });
  assert.deepEqual(eff.map((e) => e.id), ['e0', 'e1', 'e3', 'e4']);
  const effMain = effectiveEvents({ branches: [brMain, brAlt], eventsByBranch, branchId: 'br_main' });
  assert.deepEqual(effMain.map((e) => e.id), ['e0', 'e1', 'e2']);
});

test('export/import replay round-trip', () => {
  const events = [
    ev({ id: 'e0', seq: 0, type: 'SESSION_STARTED' }),
    ev({ id: 'e1', seq: 1, type: 'CARD_CREATED', payload: { cardId: 'c1', kind: 'note', rect: { x: 1, y: 1, w: 2, h: 2 } } }),
  ];
  const snap = snapshotOf(fold(emptyState(), events), { id: 's1', branchId: 'br_main', seq: 1, eventId: 'e1', t: T0 });
  const replay = exportReplay({ branches: [makeBranch({ id: 'br_main' })], events, snapshots: [snap], active: { branchId: 'br_main', cursorSeq: 1 } }, T0);
  assert.equal(replay.schema, REPLAY_SCHEMA);
  const text = JSON.stringify(replay);
  const imported = importReplay(text);
  assert.equal(imported.ok, true);
  assert.equal(imported.replay.events.length, 2);
  assert.equal(imported.replay.branches[0].id, 'br_main');
  assert.deepEqual(imported.replay.snapshots[0].state.cards.c1.rect, { x: 1, y: 1, w: 2, h: 2 });

  assert.equal(importReplay('not json').ok, false);
  assert.equal(importReplay(JSON.stringify({ schema: 'nope' })).ok, false);
  assert.equal(importReplay('x'.repeat(21 * 1024 * 1024)).ok, false);
});

test('memoryStore and stateAtCursor', async () => {
  const store = memoryStore();
  await store.putBranch(makeBranch({ id: 'br_main', name: 'main' }));
  await store.appendEvent(ev({ id: 'e0', seq: 0, type: 'SESSION_STARTED' }));
  await store.appendEvent(ev({ id: 'e1', seq: 1, type: 'CARD_CREATED', payload: { cardId: 'c1', kind: 'note', rect: { x: 5, y: 5, w: 9, h: 9 } } }));
  await store.appendEvent(ev({ id: 'e2', seq: 2, type: 'CARD_MOVED', payload: { cardId: 'c1', to: { x: 7, y: 8 } } }));
  const s1 = await stateAtCursor(store, { branchId: 'br_main', targetSeq: 1 });
  assert.equal(s1.cards.c1.rect.x, 5);
  const s2 = await stateAtCursor(store, { branchId: 'br_main', targetSeq: 2 });
  assert.equal(s2.cards.c1.rect.x, 7);
  const snap = snapshotOf(s2, { id: 's2', branchId: 'br_main', seq: 2, eventId: 'e2', t: T0 });
  await store.putSnapshot(snap);
  await store.appendEvent(ev({ id: 'e3', seq: 3, type: 'CARD_MOVED', payload: { cardId: 'c1', to: { x: 11, y: 12 } } }));
  const s3 = await stateAtCursor(store, { branchId: 'br_main', targetSeq: 3 });
  assert.equal(s3.cards.c1.rect.x, 11);
});

test('STAGE_CLEARED empties stage', () => {
  let s = emptyState();
  s = reduce(s, ev({ id: 'e1', seq: 0, type: 'CARD_CREATED', payload: { cardId: 'a', kind: 'x', rect: { x: 0, y: 0, w: 1, h: 1 } } }));
  s = reduce(s, ev({ id: 'e2', seq: 1, type: 'CARD_CREATED', payload: { cardId: 'b', kind: 'x', rect: { x: 0, y: 0, w: 1, h: 1 } } }));
  s = reduce(s, ev({ id: 'e3', seq: 2, type: 'STAGE_CLEARED', payload: { cardIds: ['a', 'b'] } }));
  assert.deepEqual(s.cards, {});
  assert.deepEqual(s.order, []);
});
