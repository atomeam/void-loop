// link (skills/link.js): which asks put up or take down the one link card, its host and short title, where it lands, and the card it mounts (opens in a new tab, host under the title).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk, { hostOf, titleOf, isImageUrl, urlOf, wantsCreate, wantsRemove, plainLink, ask } from '../void-live-deploy/skills/link.js';

class El { constructor(tag) { this.tagName = tag; this.children = []; this.style = {}; this.dataset = {}; this.on = {}; this.textContent = ''; } appendChild(c) { this.children.push(c); return c; } addEventListener(t, f) { this.on[t] = f; } }
globalThis.document = { createElement: (t) => new El(t) };
const stageOf = () => { const things = {}, s = { sel: null, saves: 0, renders: 0, bound: [] };
  s.api = { things: () => things, stage: new El('div'), select: (id) => { s.sel = id; }, selected: () => s.sel, save: () => { s.saves++; }, render: () => { s.renders++; }, bindDrag: (el, th) => s.bound.push(th.id) };
  s.api.stage.clientWidth = 1000; s.api.stage.clientHeight = 800; s.things = things; return s; };

test('the asks: its examples and hand-written ones on both sides', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const t of ['link card: https://a.org', 'please make a link card https://a.org/x', 'Drop a link https://a.org/docs']) assert.ok(sk.match(t.toLowerCase(), t), t);
  for (const t of ['https://a.org', 'add a link https://a.org/x.png', 'add a link https://a.org please', 'clear the link card https://a.org', 'add a link']) assert.ok(!sk.match(t.toLowerCase(), t), t);
});
test('host and title: www dropped, the last path part decoded and cut at 48, a bad url kept as it is', () => {
  assert.equal(hostOf('https://www.github.com/x'), 'github.com'); assert.equal(hostOf('nonsense'), 'nonsense');
  assert.equal(titleOf('https://www.example.org/guides/getting-started/'), 'example.org/getting-started');
  assert.equal(titleOf('https://example.org'), 'example.org'); assert.equal(titleOf('https://example.org/'), 'example.org');
  assert.equal(titleOf('https://a.org/docs/a%20b?x=1'), 'a.org/a b');
  assert.equal(titleOf('https://a.org/' + 'x'.repeat(60)), 'a.org/' + 'x'.repeat(48));
  assert.equal(titleOf('not a url'), 'not a url');
  assert.equal(isImageUrl('https://a.org/x.PNG?w=1'), true); assert.equal(isImageUrl('https://a.org/x.png/page'), false);
  assert.equal(urlOf('go to https://a.org/x!'), 'https://a.org/x');
});
test('create and remove: a bare url and "make … link" create, an image url never does', () => {
  assert.equal(wantsCreate('https://a.org/page'), true); assert.equal(wantsCreate('https://a.org/x.jpg'), false);
  assert.equal(wantsCreate('make it a link https://a.org'), true); assert.equal(wantsCreate('read https://a.org'), false);
  assert.equal(wantsCreate('remove the link https://a.org'), false);
  for (const t of ['remove the link', 'clear the card', 'the link, gone', 'delete link please']) assert.equal(wantsRemove(t), true, t);
  for (const t of ['remove the image', 'add a link', 'linked in']) assert.equal(wantsRemove(t), false, t);
  assert.equal(plainLink('link card https://a.org'), true); assert.equal(plainLink('show me a link https://a.org'), true);
});
test('run puts up one card in the middle, picked; a second url reuses it; remove takes it away', async () => {
  const s = stageOf();
  assert.equal(await sk.run('add a link https://www.github.com/atomeam', { stage: s.api }), 'link');
  const [card] = Object.values(s.things);
  assert.match(card.id, /^link_[a-z0-9]+$/); assert.equal(card.kind, 'link'); assert.equal(card.url, 'https://www.github.com/atomeam');
  assert.equal(card.host, 'github.com'); assert.equal(card.title, 'github.com/atomeam'); assert.equal(card.x, 360); assert.equal(card.y, 380);
  assert.equal(s.sel, card.id); assert.equal(s.saves, 1); assert.equal(s.renders, 1);
  assert.equal(await sk.run('link card https://example.org', { stage: s.api }), 'link');
  assert.equal(Object.keys(s.things).length, 1); assert.equal(card.title, 'example.org'); assert.equal(card.host, 'example.org');
  assert.equal(ask('remove the link', 'remove the link', s.api), 'link-removed'); assert.deepEqual(s.things, {}); assert.equal(s.sel, null);
  assert.equal(ask('remove the link', 'remove the link', s.api), 'no link');
  assert.equal(await sk.run('remove the link', { stage: s.api }), 'none');
  assert.equal(ask('https://a.org/x.png', 'https://a.org/x.png', s.api), '');
  assert.equal(sk.stageKinds.link.askAt, 'link'); assert.equal(sk.stageKinds.link.ask, ask);
});
test('mount: an anchor that opens in a new tab, the host under it only when the title differs', () => {
  const s = stageOf(), th = { id: 'link_a', kind: 'link', x: 5, y: 6, url: 'https://example.org/docs', host: 'example.org', title: 'example.org/docs', color: 'blue' };
  sk.stageKinds.link.mount(th, s.api);
  const el = s.api.stage.children[0], [a, host] = el.children;
  assert.equal(el.className, 'thing link-card'); assert.equal(el.dataset.id, 'link_a'); assert.equal(el.style.left, '5px'); assert.equal(el.style.top, '6px'); assert.equal(el.style.borderColor, 'blue');
  assert.equal(el.style.outline, undefined);
  assert.equal(a.href, 'https://example.org/docs'); assert.equal(a.target, '_blank'); assert.equal(a.rel, 'noopener noreferrer'); assert.equal(a.textContent, 'example.org/docs');
  assert.equal(host.className, 'host'); assert.equal(host.textContent, 'example.org'); assert.deepEqual(s.bound, ['link_a']);
  const s2 = stageOf(); s2.sel = 'link_b'; sk.stageKinds.link.mount({ id: 'link_b', x: 0, y: 0, url: 'https://example.org', host: 'example.org', title: 'example.org' }, s2.api);
  const el2 = s2.api.stage.children[0]; assert.equal(el2.children.length, 1); assert.equal(el2.style.outline, '1px solid rgba(255,255,255,0.25)');
});
