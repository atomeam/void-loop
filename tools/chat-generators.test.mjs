// Chat-fill for Generators (lib/chat-generators.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../void-live-deploy/lib/chat-generators.js';

const run = (s, t, last) => G.plan(s, G.parseIntent(t), 1_800_000_000_000, last);
const w = (s, t, last) => { const r = run(s, t, last); assert.equal(r.kind, 'write', t + ' -> ' + JSON.stringify(r).slice(0, 300)); return r; };
const MAKE = 'make a generator of pirate ship names: Black Pearl, Sea Wolf, Revenge';

test('sentences are read', () => {
  const ops = { [MAKE]: 'make', 'make a pirate ship names generator: A, B, C': 'make', 'add Dread Maiden to my pirate ship names generator': 'add', 'roll my pirate ship names generator': 'roll', 'keep that name': 'keep', 'keep the name Sea Wolf': 'keep',
    'remove Revenge from my pirate ship names generator': 'remove', 'delete my pirate ship names generator': 'delete', 'keep calm': null, 'fantasy name generator': null, 'make a note: x': null };
  for (const [t, op] of Object.entries(ops)) assert.equal((G.parseIntent(t) || {}).op || null, op, t);
});
test('make, add, remove, roll, keep, undo', () => {
  let s = w({ favs: [] }, MAKE); assert.equal(s.store.own.name, 'Pirate ship names'); assert.deepEqual(G.linesOf(s.store.own.text), ['Black Pearl', 'Sea Wolf', 'Revenge']); assert.equal(G.undoOf(s.store, s.changes).own, undefined);
  s = w(s.store, 'add Dread Maiden to my pirate ship names generator'); assert.equal(G.linesOf(s.store.own.text).length, 4); assert.equal(G.linesOf(G.undoOf(s.store, s.changes).own.text).length, 3);
  assert.equal(run(s.store, 'add dread maiden to my pirate ship names generator').kind, 'show');
  s = w(s.store, 'remove Revenge from my pirate ship names generator'); assert.equal(G.linesOf(s.store.own.text).length, 3);
  const roll = run(s.store, 'roll my pirate ship names generator'); assert.equal(roll.kind, 'show'); assert.equal(roll.picks.length, 3); assert.ok(roll.offers[0].label.startsWith('Keep '));
  const k = w(s.store, 'keep that name', ['Sea Wolf']); assert.deepEqual(k.store.favs, [{ g: 'own', text: 'Sea Wolf' }]); assert.deepEqual(G.undoOf(k.store, k.changes).favs, []);
  assert.equal(run(k.store, 'keep that name', []).kind, 'none'); assert.equal(run(k.store, 'keep the name Sea Wolf').kind, 'show');
  assert.equal(run({ favs: [] }, 'add x to my moon generator').kind, 'none');
  assert.equal(run(s.store, MAKE.replace('pirate ship', 'dragon')).kind, 'confirm', 'a second list asks before it replaces the first');
  const d = G.plan(s.store, { ...G.parseIntent('delete my pirate ship names generator'), sure: true }); assert.equal(d.store.own, undefined); assert.equal(G.undoOf(d.store, d.changes).own.name, 'Pirate ship names');
});
