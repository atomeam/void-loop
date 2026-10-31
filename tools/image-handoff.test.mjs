// lib/image-handoff.js: one picture carried from one page to the next through this browser's IndexedDB (run: node --test tools/image-handoff.test.mjs)
import test from 'node:test'; import assert from 'node:assert/strict';
import { imageLink, wantsImage, withoutImage, fileNameOf, usable, putImage, takeImage, sendImage, receiveImage, MAX_AGE, MAX_BYTES,
  docLink, wantsDoc, docNameOf, usableDoc, putDoc, takeDoc, sendDoc, receiveDoc } from '../void-live-deploy/lib/image-handoff.js';

const mem = () => { let v; return { get: async () => v, set: async (x) => { v = x; } }; };
const png = (n = 10) => new Blob([new Uint8Array(n)], { type: 'image/png' });

test('the link carries ?img=handoff once, beside any other parameter', () => {
  assert.equal(imageLink('/paint/'), '/paint/?img=handoff');
  assert.equal(imageLink('/photos/?tab=crop'), '/photos/?tab=crop&img=handoff');
  assert.equal(imageLink('/paint/?img=handoff'), '/paint/?img=handoff');
  assert.ok(wantsImage('?img=handoff')); assert.ok(wantsImage('?a=1&img=handoff'));
  assert.ok(!wantsImage('')); assert.ok(!wantsImage('?img=other')); assert.ok(!wantsImage(null));
  assert.equal(withoutImage('/paint/?img=handoff'), '/paint/');
  assert.equal(withoutImage('/photos/?tab=crop&img=handoff#x'), '/photos/?tab=crop#x');
});

test('a file name is safe and fits the picture type', () => {
  assert.equal(fileNameOf('A red fox: dawn.jpg', 'image/png'), 'A-red-fox-dawn.png');
  assert.equal(fileNameOf('', 'image/jpeg'), 'picture.jpg');
  assert.equal(fileNameOf('../../etc/passwd', 'image/webp'), 'etc-passwd.webp');
  assert.ok(!/[\/\\]/.test(fileNameOf('a/b\\c', 'image/png')));
});

test('only a recent picture of a fitting size is offered', () => {
  const now = 1_000_000_000;
  assert.ok(usable({ blob: png(), at: now }, now));
  assert.ok(usable({ blob: png(), at: now - MAX_AGE }, now));
  assert.ok(!usable({ blob: png(), at: now - MAX_AGE - 1 }, now), 'older than an hour');
  assert.ok(!usable({ blob: png(), at: now + 5 }, now), 'from the future');
  assert.ok(!usable({ blob: new Blob(['x'], { type: 'text/plain' }), at: now }, now), 'not a picture');
  assert.ok(!usable({ blob: new Blob([], { type: 'image/png' }), at: now }, now), 'empty');
  assert.ok(!usable({ blob: { type: 'image/png', size: MAX_BYTES + 1 }, at: now }, now), 'too big');
  assert.ok(!usable(null, now)); assert.ok(!usable({ at: now }, now));
});

test('a kept picture comes back as a File with its name, once kept', async () => {
  const st = mem(), now = Date.now();
  assert.equal(await takeImage(st, now), null);
  assert.ok(await putImage(png(32), { name: 'my painting', fromPage: '/paint/' }, st, now));
  const got = await takeImage(st, now + 1000);
  assert.equal(got.fromPage, '/paint/'); assert.equal(got.file.name, 'my-painting.png'); assert.equal(got.file.type, 'image/png'); assert.equal(got.file.size, 32);
  assert.equal(await takeImage(st, now + MAX_AGE + 1), null, 'too old to offer');
  assert.ok(!(await putImage(new Blob(['x'], { type: 'text/plain' }), {}, st, now)), 'a non-picture is not kept');
});

test('sending keeps the picture first, then opens the page; nothing to send opens nothing', async () => {
  const opened = [];
  assert.equal(await sendImage('/paint/?img=handoff', async () => null, {}, (u) => opened.push(u)), false);
  assert.equal(await sendImage('/paint/', () => { throw new Error('no canvas'); }, {}, (u) => opened.push(u)), false);
  // node has no IndexedDB: the picture cannot be kept, so the page is not opened empty
  assert.equal(await sendImage('/paint/', async () => png(), { name: 'x' }, (u) => opened.push(u)), false);
  assert.deepEqual(opened, []);
});

test('a receiving page opens the kept picture and tidies its address', async () => {
  const st = mem(), now = Date.now(); await putImage(png(5), { name: 'fox.png', fromPage: '/image/' }, st, now);
  const seen = [], hist = { state: null, replaceState: (s, t, u) => seen.push(u) };
  const loc = { search: '?img=handoff', pathname: '/paint/', hash: '' };
  let got = null; assert.ok(await receiveImage((f, from) => { got = [f.name, from]; }, loc, hist, st));
  assert.deepEqual(got, ['fox.png', '/image/']); assert.deepEqual(seen, ['/paint/']);
  got = null; assert.equal(await receiveImage(() => { got = 1; }, { search: '', pathname: '/paint/', hash: '' }, hist, st), false); assert.equal(got, null);
  assert.equal(await receiveImage(() => {}, loc, hist, mem()), false, 'nothing kept');
});

const pdf = (n = 10) => new Blob([new Uint8Array(n)], { type: 'application/pdf' });

test('a PDF goes by ?doc=handoff, with a safe .pdf name, and only a recent PDF is offered', () => {
  assert.equal(docLink('/translate/'), '/translate/?doc=handoff');
  assert.equal(docLink('/translate/?to=de'), '/translate/?to=de&doc=handoff');
  assert.equal(docLink('/translate/?doc=handoff'), '/translate/?doc=handoff');
  assert.ok(wantsDoc('?doc=handoff')); assert.ok(!wantsDoc('?img=handoff')); assert.ok(!wantsImage('?doc=handoff'));
  assert.equal(docNameOf('Q3 report: final.pdf'), 'Q3-report-final.pdf'); assert.equal(docNameOf(''), 'document.pdf'); assert.equal(docNameOf('../../x.pdf'), 'x.pdf');
  const now = 1_000_000_000;
  assert.ok(usableDoc({ blob: pdf(), at: now }, now));
  assert.ok(!usableDoc({ blob: pdf(), at: now - MAX_AGE - 1 }, now), 'older than an hour');
  assert.ok(!usableDoc({ blob: png(), at: now }, now), 'a picture is not a document');
  assert.ok(!usable({ blob: pdf(), at: now }, now), 'and a document is not a picture');
  assert.ok(!usableDoc({ blob: { type: 'application/pdf', size: MAX_BYTES + 1 }, at: now }, now), 'too big');
});

test('a kept PDF comes back to the page that asks for it, and the address is tidied', async () => {
  const st = mem(), now = Date.now();
  assert.ok(await putDoc(pdf(64), { name: 'hello-rotated.pdf', fromPage: '/pdf/' }, st, now));
  assert.ok(!(await putDoc(png(), {}, mem(), now)), 'a picture is not kept as a document');
  const got = await takeDoc(st, now + 1000); assert.equal(got.file.name, 'hello-rotated.pdf'); assert.equal(got.file.type, 'application/pdf'); assert.equal(got.fromPage, '/pdf/');
  const seen = [], hist = { state: null, replaceState: (s, t, u) => seen.push(u) };
  let opened = null; assert.ok(await receiveDoc((f, from) => { opened = [f.name, from]; }, { search: '?to=de&doc=handoff', pathname: '/translate/', hash: '' }, hist, st));
  assert.deepEqual(opened, ['hello-rotated.pdf', '/pdf/']); assert.deepEqual(seen, ['/translate/?to=de']);
  assert.equal(await receiveDoc(() => {}, { search: '', pathname: '/translate/', hash: '' }, hist, st), false);
  assert.equal(await receiveDoc(() => {}, { search: '?doc=handoff', pathname: '/translate/', hash: '' }, hist, mem()), false, 'nothing kept');
  const went = []; assert.ok(await sendDoc('/translate/', () => pdf(), { name: 'a.pdf' }, (u) => went.push(u), mem())); assert.deepEqual(went, ['/translate/?doc=handoff']);
  assert.equal(await sendDoc('/translate/', async () => null, {}, (u) => went.push(u), mem()), false); assert.equal(went.length, 1);
});
