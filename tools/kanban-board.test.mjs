// kanban-board (skills/kanban-board.js): which asks open the kanban card (lib/tool-sites.js KANBAN_ASK, "free " allowed in front), and the card it builds:
// the heading, the link to /kanban/ (with ?lang=de when the ask is German) and the source line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/kanban-board.js';

// a tiny document: elements keep their props, children and style; text() reads them back
const doc = { createElement: (tag) => ({ tag, children: [], style: {}, append(...k) { this.children.push(...k); }, replaceChildren(...k) { this.children = k; } }) };
const text = (e) => (typeof e === 'string' ? e : e.children.map(text).join(''));
const all = (e, tag, out = []) => { if (typeof e !== 'string') { if (e.tag === tag) out.push(e); e.children.forEach((c) => all(c, tag, out)); } return out; };
const card = (ask) => { const el = { ownerDocument: doc, children: [], replaceChildren(...k) { this.children = k; } }; assert.equal(sk.run(ask, { showPage: (f) => f(el) }), 'kanban-board'); return el; };
const m = (t) => sk.match(t.toLowerCase(), t);

test('examples in, near misses out, and the asks the pattern names', () => {
  for (const e of sk.examples) assert.ok(m(e), e);
  for (const n of sk.nearMisses) assert.ok(!m(n), n);
  for (const a of ['make me a kanban board', 'please open my kanban', 'kanban boards online', 'build a kanban app please', 'trello style board', 'a trello like board', 'free online kanban board', 'new kanban']) assert.ok(m(a), a);
  for (const a of ['free task board', 'kanban method', 'kanban card', 'kanban vs scrum', 'trello', 'make a board game']) assert.ok(!m(a), a);
});
test('the card: heading, the /kanban/ link, what it keeps and where', () => {
  const el = card('kanban board'), [h2, p, a, src] = el.children;
  assert.equal(el.children.length, 4);
  assert.equal(h2.tag, 'h2'); assert.equal(text(h2), 'Kanban board');
  assert.match(text(p), /WIP limits, swimlanes/); assert.match(text(p), /Kept on this device: no account, works offline, English and German\./);
  assert.equal(a.tag, 'a'); assert.equal(a.href, '/kanban/'); assert.equal(a.className, 'vc-page'); assert.equal(text(a), 'Open the kanban board →');
  assert.match(a.style.cssText, /border-radius:999px/);
  assert.equal(src.className, 'src'); assert.equal(text(src), 'Source: the kanban page on this site · as of 2026-10');
  assert.equal(all(el, 'a').length, 1);
});
test('a German ask opens the German board', () => {
  assert.equal(all(card('kanban board auf deutsch'), 'a')[0].href, '/kanban/?lang=de');
  assert.equal(all(card('German kanban board'), 'a')[0].href, '/kanban/?lang=de');
  assert.equal(all(card('kanban board for germany'), 'a')[0].href, '/kanban/');
});
