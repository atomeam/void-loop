// lib/toolkit.js: the tools that go together, one accent colour for all of them, and text that reads on it
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, PAGES, RELATED, relatedOf, partnersOf, hexOf, inkOn, accent, setAccent, ACCENT_KEY, routeAsk } from '../void-live-deploy/lib/toolkit.js';
import fs from 'node:fs';

test('every tool page is linked to at least one other, only to tools that exist, never to itself, and the page carries the row', () => {
  for (const [p, rel] of Object.entries(RELATED)) {
    assert.ok(TOOLS[p] || PAGES[p] || p === '/is-it/', p); assert.ok(rel.length >= 1, p); assert.ok(!rel.includes(p), p);
    for (const r of rel) assert.ok(TOOLS[r] || PAGES[r], p + ' -> ' + r);
    if (p === '/is-it/') { assert.match(fs.readFileSync(new URL('../void-live-deploy/functions/is-it/[what].js', import.meta.url), 'utf8'), /<nav id="related"[\s\S]{0,200}relatedOf\('\/is-it\/'\)/); continue; } // rendered by the function, links with scripts off
    let html = fs.readFileSync(new URL('../void-live-deploy' + p + 'index.html', import.meta.url), 'utf8');
    // a page whose code is in files of its own: a module script, an import() after load, or a plain script file (an external start file, no inline script, so the page needs no content-security rule) that imports the page's code; followed two files deep
    const seen = new Set(); let scan = html; for (let depth = 0; depth < 2; depth++) { let more = ''; for (const m of scan.matchAll(/<script (?:type="module" )?src="(\/[^"]+)"|\bimport\('(\/[a-z0-9-]+\/[a-z0-9-]+\.js)'\)|\bimport '(\/[a-z0-9-]+\/[a-z0-9-]+\.js)'/g)) { const f = m[1] || m[2] || m[3]; if (seen.has(f)) continue; seen.add(f); more += fs.readFileSync(new URL('../void-live-deploy' + f, import.meta.url), 'utf8'); } html += more; scan = more; }
    assert.match(html, /<nav id="related"/, p); assert.match(html, /mountRelated\([^,]+, '(?:\/[a-z0-9-]+)+\/'/, p);
  }
  for (const p of Object.keys(TOOLS)) assert.ok(RELATED[p], p + ' has related tools');
  assert.deepEqual(relatedOf('/random-user/')[0], { href: '/wheel/', label: 'Wheel of names' }); assert.deepEqual(relatedOf('/nope/'), []);
  // by kind of data (lib/handoff.js): the calendar reaches the trip that sends it flights, the PDF tools the photo tools; a page never itself
  assert.ok(partnersOf('/calendar/').includes('/flights/trip/')); assert.ok(relatedOf('/pdf/').some((r) => r.href === '/photos/')); assert.ok(!partnersOf('/pdf/').includes('/calendar/'));
  for (const p of Object.keys(RELATED)) assert.ok(!relatedOf(p).some((r) => r.href === p), p);
});
test('colours: hex in any short form, and the text that reads on it', () => {
  assert.equal(hexOf('#F53'), '#ff5533'); assert.equal(hexOf('6d4aff'), '#6d4aff'); assert.equal(hexOf('red'), null); assert.equal(hexOf('#12345'), null);
  assert.equal(inkOn('#ffff00'), '#111111'); assert.equal(inkOn('#1a1a40'), '#ffffff'); assert.equal(inkOn('#6d4aff'), '#ffffff');
});
test('the accent is kept on this device and put on the page; a bad colour is refused; null takes it away', () => {
  const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const props = new Map(), root = { style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) } };
  assert.equal(accent(root), null); assert.equal(setAccent('nope', root), false);
  assert.equal(setAccent('#ff0', root), true); assert.equal(mem.get(ACCENT_KEY), '#ffff00'); assert.equal(props.get('--accent'), '#ffff00'); assert.equal(props.get('--on-accent'), '#111111');
  assert.equal(accent(root), '#ffff00'); assert.equal(setAccent(null, root), true); assert.equal(accent(root), null); assert.equal(props.has('--accent'), false);
  delete globalThis.localStorage;
});

test('the ask bar routes an ask to the tool that does it, with the ask in the link, and anything else to the stage', () => {
  const to = (a) => routeAsk(a);
  assert.equal(to('100 c to f'), '/convert/?q=100%20c%20to%20f'); assert.equal(to('flip a coin'), '/flip/'); assert.equal(to('weather in boston'), '/weather/?q=boston');
  assert.equal(to('time in tokyo'), '/time/?q=tokyo'); assert.equal(to('is it christmas?'), '/is-it/christmas'); assert.equal(to('a password of 20'), '/password/?len=20');
  assert.equal(to('how strong is Tr0ub4dor&3'), '/password-strength/#p=Tr0ub4dor%263'); assert.equal(to('decode aGVsbG8='), '/base64/?mode=decode&t=aGVsbG8%3D'); assert.equal(to('encode hello'), '/base64/?t=hello');
  assert.equal(to('255 in hex'), '/base-converter/?v=255&b=16'); assert.equal(to('#ff5733'), '/color/?c=ff5733'); assert.equal(to('17% of 240'), '/calculator/?q=17%25%20of%20240');
  assert.equal(to('5 min timer'), '/stopwatch/?t=5%20min'); assert.equal(to('3 fake people'), '/random-user/?n=3'); assert.equal(to('count the words in a b c'), '/word-count/?t=a%20b%20c');
  assert.equal(to('who is the mayor of boston'), '/?q=who%20is%20the%20mayor%20of%20boston'); assert.equal(to('  '), '');
});

test('every tool page links to its own card on the stage, and every page has a card that links back (owner, 2026-10-25: "and vice versa")', async () => {
  const { CARD_ASK, cardLinkOf } = await import('../void-live-deploy/lib/toolkit.js');
  const { PAGE_PATHS, pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  for (const p of Object.keys(TOOLS)) {
    assert.ok(CARD_ASK[p], p + ' has a stage ask'); assert.equal(cardLinkOf(p), '/?q=' + encodeURIComponent(CARD_ASK[p]));
    assert.ok(PAGE_PATHS[p], p + ' is linked from a card (PAGE_OF)');
  }
  assert.equal(cardLinkOf('/nope/'), '');
  assert.deepEqual(pageOfCard('', '/color/'), ['/color/', 'Colour codes']);
  assert.equal(pageOfCard('', 'https://evil.example/'), null, 'only a known page is linked');
  assert.deepEqual(pageOfCard('calendar', ''), ['/calendar/', 'Calendar']);
  // the row puts the card link first
  const { mountRelated } = await import('../void-live-deploy/lib/toolkit.js');
  const made = []; const mk = (tag) => { const n = { tag, children: [], className: '', href: '', textContent: '', style: {}, append(...c) { this.children.push(...c); }, prepend(...c) { this.children.unshift(...c); }, setAttribute() {}, addEventListener() {}, replaceChildren(...c) { this.children = c; } }; made.push(n); return n; };
  const host = mk('nav'); host.ownerDocument = { createElement: mk, defaultView: {} };
  mountRelated(host, '/flip/');
  const row = host.children.find((c) => c.className === 'tk-row'), links = row.children.filter((c) => c.tag === 'a');
  assert.equal(links[0].className, 'tk-card'); assert.equal(links[0].href, '/?q=flip%20a%20coin');
});
