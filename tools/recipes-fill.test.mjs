// recipes-fill (skills/recipes-fill.js): on an empty device (localStorage and a few DOM calls stubbed), what a sentence writes into the Recipes page's
// own store (a2m.void.recipes.v1, its `mine` list) and the card that says so: a typed recipe read into name, servings, ingredients and steps, an
// ingredient added and removed, the servings changed, a step added, a built-in copied, a duplicate and a delete asked first, Undo, and the list.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const node = (tag) => ({ tag, className: '', style: { cssText: '' }, children: [], on: {}, _t: '', get textContent() { return this._t + this.children.map((c) => c.textContent).join(''); }, set textContent(v) { this._t = String(v); this.children = []; },
  append(...cs) { this.children.push(...cs); }, replaceChildren(...cs) { this._t = ''; this.children = cs; }, addEventListener(t, f) { this.on[t] = f; } });
globalThis.document = { createElement: node, createTextNode: (t) => Object.assign(node('#text'), { _t: String(t) }) };
const sk = (await import('../void-live-deploy/skills/recipes-fill.js')).default;

const mine = () => JSON.parse(mem.get('a2m.void.recipes.v1') || '{"mine":[]}').mine;
const cake = () => (mine().find((x) => x.id === 'mine-lemon-cake') || {}).recipe;
const all = (n) => [n, ...n.children.flatMap(all)];
const ask = (text) => { const el = node('div'); const r = sk.run(text, { showPage: () => el }); return { r, lines: () => el.children.map((c) => c.textContent), button: (label) => all(el).find((x) => x.tag === 'button' && x.textContent === label), links: all(el).filter((x) => x.href).map((x) => x.href) }; };
const click = (b) => b.on.click({ stopPropagation() {} });

test('examples taken, near misses refused, on an empty device', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const a of ['add pancakes to my recipes', 'show my recipes', 'keep this recipe: Soup - water, salt']) assert.ok(sk.match(a.toLowerCase(), a), a);
  for (const a of ['add salt to my lemon cake recipe', 'delete my lemon cake recipe', 'make my lemon cake recipe for 6', 'lemon cake']) assert.ok(!sk.match(a.toLowerCase(), a), a); // no lemon cake saved yet
  assert.equal(mem.size, 0);
});

test('a typed recipe: name, servings, ingredients and steps read, saved, linked, and Undo takes it away', () => {
  const c = ask('save this recipe: Lemon cake, serves 8, ingredients: 200 g flour, 3 eggs, 100 g sugar; steps: mix. bake 40 minutes');
  assert.equal(c.r, 'recipes-fill');
  assert.deepEqual(c.lines().slice(0, 3), ['Lemon cake', 'Saved "Lemon cake" to your recipes.', '8 servings · 3 ingredients · 2 steps']);
  assert.deepEqual(cake(), { id: 'mine-lemon-cake', name: 'Lemon cake', aliases: ['lemon cake'], servings: 8, time: 0, tags: ['mine'], ingredients: ['200 g flour', '3 eggs', '100 g sugar'], steps: ['Mix', 'Bake 40 minutes'] });
  assert.deepEqual(c.links, ['/recipes/?q=mine%20lemon%20cake']);
  click(c.button('Undo')); assert.deepEqual(mine(), []); assert.equal(c.lines()[0], 'Undone');
  ask('save this recipe: Lemon cake, serves 8, ingredients: 200 g flour, 3 eggs, 100 g sugar; steps: mix. bake 40 minutes'); assert.equal(cake().servings, 8);
});

test('editing the saved recipe: an ingredient added and removed, the servings, a step', () => {
  assert.equal(ask('add salt to my lemon cake recipe').lines()[1], 'Added Salt to "Lemon cake".'); assert.deepEqual(cake().ingredients, ['200 g flour', '3 eggs', '100 g sugar', 'Salt']);
  assert.equal(ask('add salt to my lemon cake recipe').lines()[1], 'Already in "Lemon cake": salt. Nothing changed.');
  assert.equal(ask('remove eggs from my lemon cake recipe').lines()[1], 'Removed 1 ingredient (eggs) from "Lemon cake".'); assert.deepEqual(cake().ingredients, ['200 g flour', '100 g sugar', 'Salt']);
  ask('make my lemon cake recipe for 6'); assert.equal(cake().servings, 6);
  const s = ask('add a step: cool it to my lemon cake recipe'); assert.deepEqual(cake().steps, ['Mix', 'Bake 40 minutes', 'Cool it']);
  click(s.button('Undo')); assert.deepEqual(cake().steps, ['Mix', 'Bake 40 minutes']); assert.equal(cake().servings, 6); // Undo puts back that one change only
});

test('a built-in copied in, the list, a duplicate and a delete asked first', () => {
  const p = ask('add pancakes to my recipes'); assert.equal(p.lines()[1], 'Copied "Pancakes" into your recipes.');
  assert.ok(mine().some((x) => x.id === 'mine-pancakes' && x.recipe.tags.includes('mine')));
  assert.equal(ask('add pancakes to my recipes').lines()[1], '"Pancakes" is already in your recipes.');
  const l = ask('show my recipes'); assert.equal(l.lines()[0], 'Your recipes'); assert.ok(l.lines().includes('Lemon cake: 6 servings, 3 ingredients'), l.lines().join(' | '));
  const dup = ask('save this recipe: Lemon cake, ingredients: flour, eggs'); assert.equal(dup.lines()[0], 'Write this?'); assert.equal(mine().length, 2);
  click(dup.button('Confirm')); assert.equal(mine().length, 3); assert.ok(mine().some((x) => x.id === 'mine-lemon-cake-2'));
  const d = ask('delete my lemon cake recipe'); assert.equal(d.lines()[0], 'Which one?'); // two now fit
  const one = ask('delete my pancakes recipe'); assert.deepEqual(one.lines().slice(0, 2), ['Write this?', 'Delete your recipe "Pancakes"?']); assert.equal(mine().length, 3);
  click(one.button('Confirm')); assert.ok(!mine().some((x) => x.id === 'mine-pancakes'));
});
