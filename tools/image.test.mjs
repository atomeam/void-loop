// image (skills/image.js): which asks put up or take down the one picture, the url it keeps, where it lands, its own tilt, and the photo it mounts (a failed load says so).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk, { urlOf, wantsCreate, wantsRemove, bareImageUrl, plainImage, tiltOf, ask, askBare } from '../void-live-deploy/skills/image.js';

class El { constructor(tag) { this.tagName = tag; this.children = []; this.style = {}; this.dataset = {}; this.on = {}; this.textContent = ''; } appendChild(c) { this.children.push(c); return c; } addEventListener(t, f) { this.on[t] = f; } }
globalThis.document = { createElement: (t) => new El(t) };
const stageOf = () => { const things = {}, s = { sel: null, saves: 0, renders: 0, said: [], bound: [] };
  s.api = { things: () => things, stage: new El('div'), select: (id) => { s.sel = id; }, selected: () => s.sel, save: () => { s.saves++; }, render: () => { s.renders++; }, say: (m) => s.said.push(m), bindDrag: (el, th) => s.bound.push(th.id) };
  s.api.stage.clientWidth = 1000; s.api.stage.clientHeight = 800; s.things = things; return s; };

test('the asks: its examples and hand-written ones on both sides', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const t of ['image: https://a.org/x', 'please display a picture https://a.org/x', 'Show me the photo https://a.org/p.jpg']) assert.ok(sk.match(t.toLowerCase(), t), t);
  for (const t of ['https://a.org/x.png', 'show this image https://a.org/x.png please', 'remove the image https://a.org/x.png', 'show this image']) assert.ok(!sk.match(t.toLowerCase(), t), t);
});
test('the pure readers: url, create, remove, a bare image url', () => {
  assert.equal(urlOf('see https://a.org/x.png).'), 'https://a.org/x.png'); assert.equal(urlOf('no link here'), null);
  assert.equal(wantsCreate('put it here https://a.org/x.jpg'), true); assert.equal(wantsCreate('put it here https://a.org/page'), false);
  assert.equal(wantsCreate('https://a.org/x.webp'), true); assert.equal(wantsCreate('remove the image https://a.org/x.png'), false); assert.equal(wantsCreate('a picture'), false);
  assert.equal(wantsCreate('add a photo https://a.org/page'), true);
  for (const t of ['remove the image', 'get rid of the picture', 'the photo, away', 'remove it', 'hide this.']) assert.equal(wantsRemove(t), true, t);
  for (const t of ['remove the link', 'remove it all', 'show the image']) assert.equal(wantsRemove(t), false, t);
  assert.equal(bareImageUrl(' https://a.org/x.webp?w=2 '), true); assert.equal(bareImageUrl('https://a.org/page'), false); assert.equal(bareImageUrl('look https://a.org/x.png'), false);
  assert.equal(plainImage('image https://a.org/x'), true); assert.equal(plainImage('show this image https://a.org/x', 'show this image https://a.org/x'), true);
});
test('a photo keeps its own tilt, never square, within 2.5 degrees', () => {
  assert.equal(tiltOf('image_abc'), tiltOf('image_abc')); assert.equal(tiltOf(''), -2.5);
  const seen = new Set(); let square = null;
  for (let i = 0; i < 2000; i++) { const t = tiltOf('image_' + i); seen.add(t); assert.ok(t !== 0 && Math.abs(t) <= 2.5, String(t)); if (square === null && t === 1.2) square = i; }
  assert.ok(seen.size > 30, 'spread: ' + seen.size); assert.notEqual(square, null);
});
test('run puts up one picture in the middle, picked; a second url reuses it; remove takes it away', async () => {
  const s = stageOf();
  assert.equal(await sk.run('show this image https://example.org/cat.png', { stage: s.api }), 'image');
  const [img] = Object.values(s.things);
  assert.match(img.id, /^image_[a-z0-9]+$/); assert.equal(img.kind, 'image'); assert.equal(img.src, 'https://example.org/cat.png');
  assert.equal(img.x, 340); assert.equal(img.y, 240); assert.equal(s.sel, img.id); assert.equal(s.saves, 1); assert.equal(s.renders, 1);
  assert.equal(await sk.run('add an image https://example.org/dog.jpg', { stage: s.api }), 'image');
  assert.equal(Object.keys(s.things).length, 1); assert.equal(img.src, 'https://example.org/dog.jpg');
  assert.equal(ask('remove the image', 'remove the image', s.api), 'image-removed');
  assert.deepEqual(s.things, {}); assert.equal(s.sel, null);
  assert.equal(ask('remove the image', 'remove the image', s.api), 'no image');
  assert.equal(await sk.run('remove the image', { stage: s.api }), 'none');
  assert.equal(ask('hello there', 'hello there', s.api), '');
});
test('askBare: a pasted image url alone, trimmed; anything else is left', () => {
  const s = stageOf();
  assert.equal(askBare('https://a.org/x.png', 'look https://a.org/x.png', s.api), '');
  assert.equal(askBare('', '  https://a.org/x.gif  ', s.api), 'image');
  assert.equal(Object.values(s.things)[0].src, 'https://a.org/x.gif');
  assert.equal(sk.stageKinds.image.askAt, 'image'); assert.equal(sk.stageKinds.image.ask, ask);
});
test('mount: a photo with its src, place, tilt and caption; a failed load says so', () => {
  const s = stageOf(), th = { id: 'image_q1', kind: 'image', x: 12, y: 34, src: 'https://a.org/x.png', color: '#f00', title: '' };
  s.sel = 'image_q1'; sk.stageKinds.image.mount(th, s.api);
  const el = s.api.stage.children[0], [img, title] = el.children;
  assert.equal(el.className, 'thing image'); assert.equal(el.dataset.id, 'image_q1');
  assert.equal(el.style.left, '12px'); assert.equal(el.style.top, '34px'); assert.equal(el.style.borderColor, '#f00'); assert.equal(el.style.rotate, tiltOf('image_q1') + 'deg');
  assert.equal(el.style.outline, '1px solid rgba(255,255,255,0.25)');
  assert.equal(img.src, 'https://a.org/x.png'); assert.equal(img.draggable, false); assert.equal(title.className, 'image-title'); assert.equal(title.contentEditable, 'true');
  assert.deepEqual(s.bound, ['image_q1']);
  title.textContent = 'My cat'; title.on.input(); assert.equal(th.title, 'My cat'); assert.equal(s.saves, 1);
  th.title = ''; img.onerror(); assert.equal(img.style.display, 'none'); assert.equal(title.textContent, 'Image (failed)'); assert.deepEqual(s.said, ['image failed to load']);
});
