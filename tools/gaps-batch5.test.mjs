// docs/GAPS.md batch 5 (2026-11-06): a grocery list of its own, big block letters, an event countdown with no date named, and a tournament bracket.
//   node --test tools/gaps-batch5.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ask, kindOf } from '../void-live-deploy/skills/list.js';
import { bigLetters, runTextTool } from '../void-live-deploy/lib/text-tools.js';
import { textToolByName } from '../void-live-deploy/skills/text-tools.js';
import countdown, { pickOf, partsUntil, partsLine, countdownOf } from '../void-live-deploy/skills/countdown.js';
import groups, { groupsOf, firstRound, rounds, roundName } from '../void-live-deploy/skills/groups.js';

// a stage with the parts of stageApi that the list's ask() uses
const stage = (things = {}) => {
  let sel = null;
  return { things, api: { stage: { clientWidth: 800, clientHeight: 600 }, things: () => things, select: (id) => { sel = id; }, selected: () => sel, save() {}, render() {}, say() {}, targetKind: () => '' } };
};
// a card whose parts run() wires up: querySelector hands out one stub per class
const card = () => {
  const parts = {}, part = (sel) => { const k = sel.replace(/^[.#]/, ''); return (parts[k] = parts[k] || { value: '', innerHTML: '', textContent: '', style: {}, dataset: {}, on: {}, focus() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener(ev, f) { this.on[ev] = f; } }); };
  const el = { innerHTML: '', querySelector: part };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return { parts, el, api: { showPage: (f) => { f(el); return el; }, esc } };
};

test('grocery list: a list of its own with that title, never the list of garden steps already on the stage', () => {
  assert.equal(kindOf('grocery list'), 'Grocery list');
  assert.equal(kindOf('make a shopping list with eggs, milk'), 'Shopping list');
  assert.equal(kindOf('list groceries'), 'Grocery list');
  assert.equal(kindOf('a packing list: socks'), 'Packing list');
  for (const a of ['todo list', 'make a list', 'list: eggs, milk', 'a list with grocery bags']) assert.equal(kindOf(a), '', a);
  const s = stage({ g: { id: 'g', kind: 'list', x: 0, y: 0, title: 'Garden steps', items: [{ id: 'i1', text: 'dig', done: false }] } });
  s.api.select('g');
  assert.equal(ask('grocery list', 'grocery list', s.api), 'list');
  const lists = () => Object.values(s.things).filter((t) => t.kind === 'list');
  assert.equal(lists().length, 2);
  const grocery = lists().find((t) => t.title === 'Grocery list');
  assert.ok(grocery && grocery.items.length === 0 && s.api.selected() === grocery.id);
  assert.equal(s.things.g.items.length, 1, 'the garden steps are as they were');
  ask('grocery list with eggs, milk', 'grocery list with eggs, milk', s.api);
  assert.equal(lists().length, 2, 'asked again, the same grocery list');
  assert.deepEqual(grocery.items.map((i) => i.text), ['eggs', 'milk']);
  ask('add bread', 'add bread', s.api);
  assert.deepEqual(grocery.items.map((i) => i.text), ['eggs', 'milk', 'bread'], 'a plain add goes on the picked list');
  s.api.select('g');
  ask('todo list', 'todo list', s.api);
  assert.equal(lists().length, 2, 'a plain list ask keeps the picked list');
  // an empty untitled list takes the title instead of a second card
  const e = stage({ u: { id: 'u', kind: 'list', x: 0, y: 0, items: [] } });
  ask('shopping list', 'shopping list', e.api);
  assert.equal(Object.keys(e.things).length, 1);
  assert.equal(e.things.u.title, 'Shopping list');
  // "list groceries" (the verb) fills the open untitled list that has milk on it: one list, not two (browser suite: top misses)
  const m = stage({ u: { id: 'u', kind: 'list', x: 0, y: 0, title: '', items: [{ id: 'i1', text: 'milk', done: false }] } });
  m.api.select('u');
  ask('list groceries', 'list groceries', m.api);
  assert.equal(Object.keys(m.things).length, 1, 'list groceries keeps one list');
  assert.equal(m.things.u.title, 'Grocery list');
  assert.deepEqual(m.things.u.items.map((i) => i.text), ['milk']);
  // the noun form still makes a list of its own beside the open one (GAPS row 53)
  const n = stage({ u: { id: 'u', kind: 'list', x: 0, y: 0, title: '', items: [{ id: 'i1', text: 'dig', done: false }] } });
  n.api.select('u');
  ask('grocery list', 'grocery list', n.api);
  assert.equal(Object.values(n.things).filter((t) => t.kind === 'list').length, 2, 'a grocery list is never the open list of garden steps');
  assert.equal(n.things.u.title, '');
});

test('big block letters: 5 rows of full blocks, the words from the ask, ready to copy', () => {
  assert.equal(bigLetters('hi').text, ['█   █ ███', '█   █  █', '█████  █', '█   █  █', '█   █ ███'].join('\n'));
  const r = bigLetters('ab~c');
  assert.deepEqual(r.missing, ['~']);
  assert.equal(r.text.split('\n').length, 5);
  assert.equal(bigLetters('hello wonderful world').text.split('\n').length, 5 * 3 + 2, 'past 12 characters a banner wraps at a space');
  for (const a of ['text art big letters hello', 'big letters hello', 'block letters hello', 'hello in big letters', 'text art hello', 'ascii art text hello']) {
    const t = runTextTool(a);
    assert.equal(t && t.id, 'big-letters', a);
    assert.equal(t.text, bigLetters('hello').text, a);
  }
  for (const a of ['big letters', 'block letters', 'big text generator', 'text art generator', 'text art big letters', 'ascii text generator']) {
    assert.equal(runTextTool(a), null, a + ' names the tool alone');
    assert.equal(textToolByName(a)?.id, 'big-letters', a);
  }
  for (const a of ['what are block letters', 'ascii art', 'ascii for hello']) assert.equal(textToolByName(a)?.id === 'big-letters' || runTextTool(a)?.id === 'big-letters', false, a);
});

test('event countdown: the ask with no date opens a card with a name and a date that counts days to seconds', () => {
  for (const [a, label] of [['event countdown', ''], ['countdown clock', ''], ['countdown to a date', ''], ['make an event countdown timer', ''], ['wedding countdown', 'Wedding'], ['countdown to my wedding', 'Wedding'], ['birthday countdown', 'Birthday']]) assert.deepEqual(pickOf(a), { kind: 'pick', label }, a);
  for (const a of ['countdown', 'countdown timer', 'countdown to the olympics', 'what is a countdown', 'make a countdown']) assert.equal(pickOf(a), null, a);
  assert.equal(countdownOf('countdown to christmas').kind, 'named', 'a named date keeps its own card');
  assert.deepEqual(partsUntil(Date.UTC(2026, 0, 2, 3, 4, 5), Date.UTC(2026, 0, 1)), { past: false, days: 1, hours: 3, minutes: 4, seconds: 5 });
  assert.equal(partsLine(partsUntil(10 * 86400000 + 61000, 0)), '10 days, 00:01:01');
  assert.equal(partsLine(partsUntil(0, 86400000)), '1 day, 00:00:00 ago');
  assert.ok(countdown.match('event countdown', 'event countdown'));
  const ticks = [], real = globalThis.setInterval;
  globalThis.setInterval = (f) => { ticks.push(f); return 1; };
  try {
    const c = card();
    assert.equal(countdown.run('wedding countdown', c.api) instanceof Promise, true);
    assert.match(c.el.innerHTML, /Event countdown/);
    assert.match(c.el.innerHTML, /value="Wedding"/);
    assert.equal(c.parts['ec-big'].textContent, '', 'no count until a date is picked');
    const t = new Date(Date.now() + 3 * 86400000 + 3600000);
    c.parts['ec-name'].value = 'Wedding'; // what the browser hands back from value="Wedding"
    c.parts['ec-when'].value = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0') + 'T' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    c.parts['ec-when'].on.input();
    assert.match(c.parts['ec-big'].textContent, /^3 days, 0[01]:\d\d:\d\d$/, c.parts['ec-big'].textContent);
    assert.match(c.parts['ec-say'].textContent, /^Until Wedding, /);
    assert.equal(ticks.length, 1, 'it ticks once a second');
  } finally { globalThis.setInterval = real; }
});

test('tournament bracket: names in, single elimination with byes, winners picked by pressing a name', () => {
  assert.deepEqual(groupsOf('tournament bracket'), { kind: 'bracket', names: [] });
  assert.deepEqual(groupsOf('bracket generator').kind, 'bracket');
  assert.deepEqual(groupsOf('bracket for ann, ben, cal, dee, eve').names, ['ann', 'ben', 'cal', 'dee', 'eve']);
  assert.deepEqual(groupsOf('make a bracket with: a, b, c').names, ['a', 'b', 'c']);
  assert.equal(groupsOf('tournament bracket for 8 players').names.length, 8);
  for (const a of groups.nearMisses) assert.equal(groupsOf(a), null, a);
  let seed = 11; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let n = 2; n <= 33; n++) {
    const names = Array.from({ length: n }, (_, i) => 'p' + i), f = firstRound(names, rng);
    let size = 2; while (size < n) size *= 2;
    assert.equal(f.length, size / 2, 'n=' + n);
    assert.ok(f.every(([a]) => a !== null), 'no match is two byes, n=' + n);
    assert.deepEqual(f.flat().filter((x) => x !== null).sort(), names.slice().sort(), 'each name once, n=' + n);
    assert.equal(rounds(f).length, Math.log2(size), 'n=' + n);
  }
  assert.equal(firstRound(['solo']), null);
  // 6 names: 2 byes, one in each half
  const six = firstRound(['a', 'b', 'c', 'd', 'e', 'f'], rng).map(([, b]) => b === null);
  assert.ok(six.slice(0, 2).includes(true) && six.slice(2).includes(true), JSON.stringify(six));
  // picks send a name through; changing an early pick clears what hung on it
  const f = [['a', 'b'], ['c', null]];
  let rs = rounds(f, {});
  assert.equal(rs[0][1].w, 'c', 'a bye goes through');
  assert.equal(rs[1][0].a, '');
  rs = rounds(f, { '0-0': 'a', '1-0': 'a' });
  assert.equal(rs[1][0].w, 'a');
  rs = rounds(f, { '0-0': 'b', '1-0': 'a' });
  assert.deepEqual([rs[1][0].a, rs[1][0].w], ['b', ''], 'the final pick no longer names one of the two');
  assert.deepEqual([0, 1, 2, 3].map((r) => roundName(r, 4)), ['Round of 16', 'Quarterfinals', 'Semifinals', 'Final']);
});

test('the bracket card: every name in round 1, pressing names through to a champion', () => {
  const c = card();
  assert.equal(groups.run('bracket for ann, ben, <cal>', c.api), 'groups');
  const box = /<textarea class="gr-names"[^>]*>([^<]*)<\/textarea>/.exec(c.el.innerHTML);
  c.parts['gr-names'].value = box[1].replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  c.parts['gr-go'].on.click();
  assert.match(c.parts['gr-say'].textContent, /^3 names, 2 rounds, 1 bye\./);
  const out = () => c.parts['gr-out'].innerHTML;
  assert.ok(out().includes('&lt;cal>') && !out().includes('<cal>'), 'names are escaped');
  assert.match(out(), /Semifinals[\s\S]*Final/);
  const press = (k, n) => c.parts['gr-out'].on.click({ target: { closest: () => ({ dataset: { k, n } }) } });
  const pairs = [...out().matchAll(/data-k="0-(\d)" data-n="([^"]+)"/g)].map((m) => [m[1], m[2].replace(/&lt;/g, '<').replace(/&amp;/g, '&')]);
  const played = pairs.find(([i], j) => pairs.findIndex(([x]) => x === i) !== j) || pairs.find(([i]) => pairs.filter(([x]) => x === i).length === 2);
  press('0-' + played[0], played[1]);
  assert.ok(out().includes('data-k="1-0"'), 'the final has both names now');
  const unesc = (x) => x.replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const fin = [...out().matchAll(/data-k="1-0" data-n="([^"]+)"/g)].map((m) => unesc(m[1]));
  assert.equal(fin.length, 2);
  press('1-0', fin[0]);
  assert.ok(out().includes('Champion: ' + c.api.esc(fin[0])), out());
});
