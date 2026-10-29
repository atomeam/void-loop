// generators-fill (skills/generators-fill.js): on an empty device (localStorage and a few DOM calls stubbed), what a sentence writes into the
// Generators page's own store (a2m.void.generators.v1: `own`, the make-your-own list, and `favs`, the kept names) and the card that says so: a
// generator made, added to, rolled, a name kept by name and "keep that name" from the last roll, kept once only, Undo, and a replace or delete asked first.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const node = (tag) => ({ tag, className: '', style: { cssText: '' }, children: [], on: {}, _t: '', get textContent() { return this._t + this.children.map((c) => c.textContent).join(''); }, set textContent(v) { this._t = String(v); this.children = []; },
  append(...cs) { this.children.push(...cs); }, replaceChildren(...cs) { this._t = ''; this.children = cs; }, addEventListener(t, f) { this.on[t] = f; } });
globalThis.document = { createElement: node, createTextNode: (t) => Object.assign(node('#text'), { _t: String(t) }) };
const sk = (await import('../void-live-deploy/skills/generators-fill.js')).default;

const store = () => JSON.parse(mem.get('a2m.void.generators.v1') || '{}');
const all = (n) => [n, ...n.children.flatMap(all)];
const ask = (text) => { const el = node('div'); const r = sk.run(text, { showPage: () => el }); return { r, lines: () => el.children.map((c) => c.textContent), buttons: () => all(el).filter((x) => x.tag === 'button').map((x) => x.textContent), button: (label) => all(el).find((x) => x.tag === 'button' && x.textContent === label), links: all(el).filter((x) => x.href).map((x) => x.href) }; };
const click = (b) => b.on.click({ stopPropagation() {} });
const SHIPS = ['Black Pearl', 'Sea Wolf', 'Revenge'];

test('examples taken, near misses refused, on an empty device', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const a of ['make a dragon name generator: Smaug, Ancalagon', 'list my generators']) assert.ok(sk.match(a.toLowerCase(), a), a);
  for (const a of ['roll my pirate ship names generator', 'keep that name', 'add Dread Maiden to my pirate ship names generator', 'random name generator', 'make a generator']) assert.ok(!sk.match(a.toLowerCase(), a), a); // nothing made or rolled yet
  assert.equal(mem.size, 0);
});

test('made from a list: the generator, its first rolls with Keep buttons, the link; Undo empties the slot', () => {
  const c = ask('make a generator of pirate ship names: Black Pearl, Sea Wolf, Revenge');
  assert.equal(c.r, 'generators-fill');
  assert.deepEqual(store().own, { name: 'Pirate ship names', text: 'Black Pearl\nSea Wolf\nRevenge' });
  assert.deepEqual(c.lines().slice(0, 2), ['Pirate ship names', 'Made the generator "Pirate ship names" with 3 entries.']);
  assert.deepEqual(c.lines()[2].replace('First rolls: ', '').split(', ').sort(), [...SHIPS].sort());
  assert.deepEqual(c.buttons().filter((b) => b.startsWith('Keep ')).map((b) => b.slice(5)).sort(), [...SHIPS].sort());
  assert.deepEqual(c.links, ['/generators/?g=own']);
  click(c.button('Undo')); assert.equal(store().own, undefined); assert.equal(c.lines()[0], 'Undone');
  ask('make a generator of pirate ship names: Black Pearl, Sea Wolf, Revenge, Sea Wolf'); assert.equal(store().own.text, 'Black Pearl\nSea Wolf\nRevenge'); // the repeat dropped
});

test('added to, rolled, and "keep that name" keeps the first of the last roll', () => {
  assert.equal(ask('add Dread Maiden to my pirate ship names generator').lines()[1], 'Added Dread Maiden to "Pirate ship names".');
  assert.equal(store().own.text, 'Black Pearl\nSea Wolf\nRevenge\nDread Maiden');
  assert.equal(ask('add sea wolf to my pirate ship names generator').lines()[1], 'Already in "Pirate ship names". Nothing changed.');
  const roll = ask('roll my pirate ship names generator'); const picks = roll.lines().slice(1, 5);
  assert.deepEqual([...picks].sort(), ['Black Pearl', 'Dread Maiden', 'Revenge', 'Sea Wolf']); assert.deepEqual(store().favs || [], []); // a roll keeps nothing
  assert.deepEqual(JSON.parse(mem.get('a2m.void.chatfill.last.v1')), picks);
  assert.ok(sk.match('keep that name', 'keep that name'));
  assert.equal(ask('keep that name').lines()[1], 'Kept the name "' + picks[0] + '".'); assert.deepEqual(store().favs, [{ g: 'own', text: picks[0] }]);
});

test('a name kept by name once only, Undo of a keep, a removal; replacing and deleting the generator are asked first', () => {
  mem.set('a2m.void.generators.v1', JSON.stringify({ ...store(), favs: [] }));
  const k = ask('keep the name Sea Wolf'); assert.deepEqual(store().favs, [{ g: 'own', text: 'Sea Wolf' }]);
  assert.equal(ask('keep the name Sea Wolf').lines()[1], '"Sea Wolf" is already kept.'); assert.equal(store().favs.length, 1);
  click(k.button('Undo')); assert.deepEqual(store().favs, []);
  ask('remove Revenge from my pirate ship names generator'); assert.equal(store().own.text, 'Black Pearl\nSea Wolf\nDread Maiden');
  const rep = ask('make a dragon name generator: Smaug, Ancalagon');
  assert.deepEqual(rep.lines().slice(0, 2), ['Write this?', 'Your own-generator slot holds "Pirate ship names" (3 entries). Replace it with "Dragon name"?']);
  assert.equal(store().own.name, 'Pirate ship names'); // nothing replaced unseen
  click(rep.button('Confirm')); assert.deepEqual(store().own, { name: 'Dragon name', text: 'Smaug\nAncalagon' });
  const del = ask('delete my dragon name generator'); assert.equal(del.lines()[0], 'Write this?'); assert.ok(store().own);
  click(del.button('Confirm')); assert.equal(store().own, undefined);
  assert.deepEqual(ask('list my generators').lines().slice(1, 3), ['No own generator yet.', 'No kept names yet.']);
});
