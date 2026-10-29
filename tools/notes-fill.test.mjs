// notes-fill (skills/notes-fill.js): on an empty device (localStorage and a few DOM calls stubbed), what a sentence writes into the Notes page's own
// store (a2m.void.notes.v1) and the card that says so: a new note, a shopping list made then added to then ticked, a note found by a word, Undo that
// puts the store back, "undo that note", and the asks it only takes once a note fits.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const node = (tag) => ({ tag, className: '', style: { cssText: '' }, children: [], on: {}, _t: '', get textContent() { return this._t + this.children.map((c) => c.textContent).join(''); }, set textContent(v) { this._t = String(v); this.children = []; },
  append(...cs) { this.children.push(...cs); }, replaceChildren(...cs) { this._t = ''; this.children = cs; }, addEventListener(t, f) { this.on[t] = f; } });
globalThis.document = { createElement: node, createTextNode: (t) => Object.assign(node('#text'), { _t: String(t) }) };
const sk = (await import('../void-live-deploy/skills/notes-fill.js')).default;

const KEY = 'a2m.void.notes.v1';
const docs = () => JSON.parse(mem.get(KEY) || '{"docs":[]}').docs;
const all = (n) => [n, ...n.children.flatMap(all)];
const ask = (text) => { const el = node('div'); const r = sk.run(text, { showPage: () => el }); return { r, el, lines: el.children.map((c) => c.textContent), find: (label) => all(el).find((x) => x.tag === 'button' && x.textContent === label), links: all(el).filter((x) => x.href).map((x) => x.href) }; };
const click = (b) => b.on.click({ stopPropagation() {} });

test('examples taken, near misses refused, on an empty device', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const a of ['make a note about my trip to Lisbon: flights Friday, hotel Alfama', 'add a note: call the plumber']) assert.ok(sk.match(a.toLowerCase(), a), a);
  for (const a of ['tick milk', 'rename my shopping note to groceries', 'write a note that says hello', 'undo']) assert.ok(!sk.match(a.toLowerCase(), a), a); // nothing to tick or rename yet
  assert.equal(mem.size, 0); // matching writes nothing
});

test('"add a note: buy milk" makes the note, says so, links it, and Undo takes it away', () => {
  const c = ask('add a note: buy milk');
  assert.equal(c.r, 'notes-fill'); assert.deepEqual(c.lines.slice(0, 2), ['Buy milk', 'Made the note "Buy milk".']);
  const d = docs(); assert.equal(d.length, 1); assert.equal(d[0].title, 'Buy milk');
  assert.deepEqual(c.links, ['/notes/?id=' + d[0].id]);
  click(c.find('Undo'));
  assert.equal(docs().length, 0); assert.deepEqual(c.el.children.map((x) => x.textContent), ['Undone', 'Made the note "Buy milk": put back as it was.', 'Earlier versions stay in the note\'s history.']);
});

test('a shopping list: made with eggs, then milk and bread added, then eggs ticked', () => {
  assert.equal(ask('add eggs to my shopping list').lines[1], 'No note called "Shopping list" yet, so I made it with eggs.');
  assert.equal(ask('add milk and bread to my shopping list').lines[1], 'Added Milk, Bread to Shopping list.');
  assert.ok(sk.match('tick eggs', 'tick eggs')); // now there is something to tick
  assert.equal(ask('tick eggs').lines[1], 'Ticked "Eggs" in Shopping list.');
  const list = docs().find((x) => x.title === 'Shopping list');
  assert.equal(list.html, '<ul class="todo"><li class="chk done">Eggs</li><li class="chk">Milk</li><li class="chk">Bread</li></ul>');
  assert.ok(!sk.match('tick cheese', 'tick cheese'));
});

test('a note found by a word it holds; "undo that note" puts back the last change', () => {
  const made = ask('make a note about my trip to Lisbon: flights Friday, hotel Alfama');
  assert.equal(made.lines[0], 'My trip to Lisbon');
  const id = docs().find((x) => x.title === 'My trip to Lisbon').id;
  const found = ask('what did I write about Lisbon');
  assert.equal(found.lines[0], 'Notes about Lisbon'); assert.ok(found.lines[1].startsWith('My trip to Lisbon: '), found.lines[1]); assert.ok(found.links.includes('/notes/?id=' + id));
  assert.deepEqual(ask('what did I write about Kyoto').lines, ['Notes about Kyoto', 'No note mentions "Kyoto".']);
  const u = ask('undo that note');
  assert.deepEqual(u.lines, ['Undone', 'Made the note "My trip to Lisbon" with 2 sections: put back as it was.']);
  assert.ok(!docs().some((x) => x.title === 'My trip to Lisbon')); assert.ok(docs().some((x) => x.title === 'Shopping list'));
});

test('"start a meeting note" makes a dated note from the meeting template', () => {
  const c = ask('start a meeting note'); const today = new Date(), ymd = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  assert.equal(c.lines[0], 'Meeting ' + ymd); assert.equal(c.lines[1], 'Started "Meeting ' + ymd + '" from the meeting template.');
  const d = docs().find((x) => x.title === 'Meeting ' + ymd); assert.ok(d.html.includes('<h2>Agenda</h2>') && d.html.includes('<h2>Actions</h2>'), d.html);
});
