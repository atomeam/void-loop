// Frontier #13, the first piece: "call this my morning" saves the last few asks as a routine in this browser; "my morning"
// runs it. lib/routines.js is the pure half (the ask, the pick, the store). Run: node --test tools/routines.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routineAsk, pick, load, save, remove, MAX_ASKS } from '../void-live-deploy/lib/routines.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('routines: saving is asked in plain words, with a name and an optional count', () => {
  assert.deepEqual(routineAsk('call this my morning'), { kind: 'save', name: 'morning', count: null });
  assert.deepEqual(routineAsk('save that as my evening wind down'), { kind: 'save', name: 'evening wind down', count: null });
  assert.deepEqual(routineAsk('save the last 2 asks as my study'), { kind: 'save', name: 'study', count: 2 });
  assert.deepEqual(routineAsk('call these my morning routine'), { kind: 'save', name: 'morning', count: null });
  assert.deepEqual(routineAsk('my routines'), { kind: 'list' });
  assert.deepEqual(routineAsk('forget my morning', { morning: { asks: [] } }), { kind: 'forget', name: 'morning' });
  assert.equal(routineAsk('forget my password', { morning: { asks: [] } }), null, 'forgetting is only for a routine that exists');
  for (const q of ['call my mom', 'what is a morning routine', 'save the whales', 'call this number']) assert.equal(routineAsk(q), null, q);
});

test('routines: "my morning" runs only a routine that exists, so other asks that start with "my" are left alone', () => {
  const saved = { morning: { asks: ['flip a coin'] } };
  assert.deepEqual(routineAsk('my morning', saved), { kind: 'run', name: 'morning' });
  assert.deepEqual(routineAsk('run my morning', saved), { kind: 'run', name: 'morning' });
  assert.deepEqual(routineAsk('do my morning routine', saved), { kind: 'run', name: 'morning' });
  assert.equal(routineAsk('my morning', {}), null);
  assert.equal(routineAsk('my calendar', saved), null);
});

test('routines: the pick is the asks before the save, oldest first, never a routine ask, at most a few', () => {
  const recent = ['call this my morning', 'convert 5 km to miles', 'flip a coin', 'my evening', '15% tip on 80', 'unlock'];
  assert.deepEqual(pick(recent, null), ['15% tip on 80', 'flip a coin', 'convert 5 km to miles']);
  assert.deepEqual(pick(recent, 1), ['convert 5 km to miles']);
  assert.ok(pick(Array(20).fill(0).map((_, i) => 'ask ' + i), 99).length <= MAX_ASKS);
  assert.deepEqual(pick(['call this my morning'], null), []);
});

test('routines: kept in this browser, saved, listed and forgotten; a broken store reads as empty', () => {
  const ls = mem();
  assert.deepEqual(load(ls), {});
  save(ls, 'morning', ['flip a coin', '15% tip on 80'], '2026-10-11');
  assert.deepEqual(load(ls).morning, { asks: ['flip a coin', '15% tip on 80'], saved: '2026-10-11' });
  remove(ls, 'morning'); assert.deepEqual(load(ls), {});
  ls.setItem('a2m.void.routines.v1', '{not json'); assert.deepEqual(load(ls), {});
  assert.deepEqual(load(null), {});
});
