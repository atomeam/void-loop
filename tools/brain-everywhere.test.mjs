// brain-everywhere: Verse Brain on every Verse page (owner, 2026-10-30: "make it so its brain can be used with all the tools and pages").
// A page reads and writes the one brain of the browser over the real BroadcastChannel (Node has one), keeps what it writes when no brain
// runs, and the next brain hears it first; a read starts the brain on the page only when no other tab holds the lock.
// Run: node --test tools/brain-everywhere.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../void-live-deploy/lib/brain-everywhere.js';
import * as Route from '../void-live-deploy/lib/brain-route.js';
import * as B from '../void-live-deploy/lib/brain.js';
import { hostBrain } from '../void-live-deploy/lib/brain-bridge.js';
import { startHost } from '../void-live-deploy/lib/brain-host.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
/** a page with no DOM beyond what the module reads */
function page(path, title, store = memStore()) {
  const listeners = {};
  const doc = { title, visibilityState: 'visible', querySelector: () => null, querySelectorAll: () => [], addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); }, dispatch: (t, detail) => (listeners[t] || []).forEach((f) => f({ detail })) };
  const win = { document: doc, localStorage: store, location: { pathname: path }, navigator: {} };
  return { win, doc, store };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('the lists it keeps are the ones the brain reads, a page has its own name, and an owner key is never kept', () => {
  assert.equal(E.HEARD_KEY, Route.HEARD_KEY); assert.equal(E.HEARD_MAX, Route.HEARD_MAX);
  assert.equal(E.pageName('File converter · Verse', '', '/converter/'), 'File converter');
  assert.equal(E.pageName('Verse', 'Prize odds', '/prizes/'), 'Prize odds');
  assert.equal(E.pageName('', '', '/fan-fic/'), 'fan fic');
  const s = memStore();
  assert.equal(E.keepIn(s, E.SEEN_KEY, { text: 'unlock abcdefghijklmnopqrst', at: 1 }, 5), false);
  for (let i = 0; i < 8; i++) assert.equal(E.keepIn(s, E.SEEN_KEY, { text: 'page ' + i, at: i }, 5), true);
  const all = E.takeAll(s, E.SEEN_KEY, 24);
  assert.deepEqual(all.map((a) => a.text), ['page 3', 'page 4', 'page 5', 'page 6', 'page 7']);
  assert.deepEqual(E.takeAll(s, E.SEEN_KEY, 24), [], 'taken once');
  assert.equal(E.chipText({ type: 'state', thinking: 'dragons', action: 'rest' }), 'Verse Brain: thinking about dragons');
  assert.equal(E.chipText({ type: 'state', thinking: null, action: 'explore' }), 'Verse Brain: explore');
  assert.equal(E.chipText(null), null);
});

test('with a brain running in another tab, a page reads it, writes words to it, tells it which page it is, and an event writes too', async () => {
  const b = B.createBrain(11); const host = hostBrain(B, () => b, { id: 'host-test' });
  const p = page('/converter/', 'File converter · Verse');
  const api = E.start({ win: p.win, doc: p.doc, wait: 400, poll: 50, startHost: () => { throw new Error('no second brain'); } });
  try {
    const s = await api.read();
    assert.ok(s && s.type === 'state' && s.from === 'host-test', 'read the running brain');
    assert.equal(await api.seen, true, 'the page was told');
    await sleep(60);
    assert.ok(b.concepts.words.includes('converter'), 'the page name became ideas: ' + b.concepts.words.join(' '));
    const goals = b.mind.goals.length;
    assert.equal(api.tell('dragons and maps'), true); await sleep(60);
    assert.ok(b.concepts.words.includes('dragons') && b.mind.goals.length > goals, 'words are goals as well as ideas');
    p.doc.dispatch(E.EVENT, { text: 'quiet garden' }); await sleep(60);
    assert.ok(b.concepts.words.includes('garden'), 'the verse:brain event writes');
    const good = b.will.good; p.doc.dispatch(E.EVENT, { reward: true }); await sleep(60);
    assert.equal(b.will.good, good + 1, 'and rewards');
    assert.equal(api.tell('unlock abcdefghijklmnopqrstu'), false, 'an owner key is never told');
    assert.equal(p.win.verseBrain, api);
  } finally { api.stop(); host.close(); }
});

test('with no brain anywhere, a page keeps what it writes, and the next brain hears it first; a read starts one only with the lock', async () => {
  const store = memStore(), p = page('/fanfic/', 'Fan fiction · Verse', store);
  let made = 0;
  const api = E.start({ win: p.win, doc: p.doc, wait: 120, poll: 50, locks: { request: (n, o, f) => Promise.resolve(f(null)) }, startHost: () => { made++; return null; } });
  try {
    assert.equal(await api.seen, true, 'kept for later');
    assert.equal(api.tell('wizards'), true);
    assert.equal(JSON.parse(store.getItem(E.SEEN_KEY)).length, 1);
    assert.equal(JSON.parse(store.getItem(E.HEARD_KEY))[0].text, 'wizards');
    assert.equal(await api.read(), null, 'another tab holds the lock: no brain here');
    assert.equal(made, 0);
  } finally { api.stop(); }
  // the next brain to start hears both before anything else
  const win = { localStorage: store };
  const h = startHost({ win, ticking: false, bridge: false, store: { loadKept: () => null, keep: () => true } });
  await h.ready;
  assert.ok(h.brain.concepts.words.includes('wizards') && h.brain.concepts.words.includes('fiction'), h.brain.concepts.words.join(' '));
  assert.deepEqual(h.pages.map((x) => [x.text, x.page]), [['Fan fiction', '/fanfic/']]);
  assert.equal(store.getItem(E.SEEN_KEY), null); assert.equal(store.getItem(E.HEARD_KEY), null);
  h.stop();
});

test('a read with no brain anywhere and the lock free starts the brain on this page and answers from it', async () => {
  const p = page('/wheel/', 'Wheel of names · Verse');
  let host = null;
  const api = E.start({ win: p.win, doc: p.doc, wait: 300, poll: 50, locks: { request: (n, o, f) => Promise.resolve(f({ name: n })) },
    startHost: () => { host = startHost({ win: { localStorage: memStore() }, ticking: false, store: { loadKept: () => null, keep: () => true } }); return host; } });
  try {
    const s = await api.read();
    assert.ok(host, 'started here');
    assert.ok(s && s.type === 'state', 'and answered: ' + JSON.stringify(s && s.type));
  } finally { api.stop(); if (host) host.stop(); }
});

test('every page loads it: /visit.js adds the module after load, the module runs once a page and starts itself only in a browser', () => {
  const v = readFileSync(new URL('../void-live-deploy/visit.js', import.meta.url), 'utf8');
  assert.match(v, /s\.type = 'module'; s\.src = '\/lib\/brain-everywhere\.js'/);
  assert.match(v, /addEventListener\('load', function \(\) \{ setTimeout\(function \(\) \{ var s = document\.createElement\('script'\)/);
  const m = readFileSync(new URL('../void-live-deploy/lib/brain-everywhere.js', import.meta.url), 'utf8');
  assert.match(m, /if \(win\.__verseBrainPage\) return win\.__verseBrainPage;/, 'once a page');
  assert.match(m, /if \(typeof window !== 'undefined' && window\.document && !window\.__verseBrainNoAuto\) start\(\);/);
  assert.ok(!/fetch\((?!'\/self\.json')/.test(m), 'it fetches nothing but /self.json for a brain it starts');
});
