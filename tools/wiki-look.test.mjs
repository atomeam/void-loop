// lib/wiki-look.js and the cartoon's photo look: a cartoon is drawn from what a Wikipedia page's lead photo shows. Run: node --test tools/wiki-look.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pageFor, leadPhoto, MAX_PHOTO } from '../void-live-deploy/lib/wiki-look.js';
import * as route from '../void-live-deploy/functions/api/card-art.js';
import { models } from '../void-live-deploy/lib/models.js';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(300).fill(7)]);
const wiki = (over = {}) => async (url, opts) => {
  const u = String(url), res = (body, ct = 'application/json', ok = true) => ({ ok, status: ok ? 200 : 404, headers: { get: () => ct }, json: async () => body, arrayBuffer: async () => (body instanceof Uint8Array ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : new ArrayBuffer(0)) });
  if (over.fail) throw new Error('down');
  if (u.includes('list=search')) return res({ query: { search: [{ title: over.title || 'Dimebag Darrell' }] } });
  if (u.includes('/page/summary/')) return res({ type: over.type || 'standard', description: 'American guitarist (1966-2004)', wikibase_item: 'Q319690', ...(over.noThumb ? {} : { thumbnail: { source: over.src || 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/D.jpg/320px-D.jpg' } }) });
  if (u.includes('wikidata.org/w/api.php')) return res(over.noP18 ? { claims: {} } : { claims: { P18: [{ mainsnak: { datavalue: { value: 'Dimebag Darrell 2004.jpg' } } }] } });
  if (u.includes('commons.wikimedia.org/w/api.php')) return res({ query: { pages: { 1: { imageinfo: [{ thumburl: over.offsite ? 'https://evil.example/x.jpg' : over.relative ? '//upload.wikimedia.org/wikipedia/commons/thumb/x/320px-x.jpg' : over.thumbHost ? 'https://thumb.wikimedia.org/wikipedia/commons/thumb/x/320px-x.jpg' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/x/320px-x.jpg' }] } } } });
  if (/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(u)) return over.bigPhoto ? res(new Uint8Array(MAX_PHOTO + 10), 'image/jpeg') : res(JPEG, over.ct || 'image/jpeg');
  throw new Error('unexpected ' + u);
};

test('a misspelt name finds the page whose title is the same name, and gives the usual spelling', async () => {
  assert.deepEqual(await pageFor('dimebag darrel', wiki()), { title: 'Dimebag Darrell', usual: 'Dimebag Darrell' });
  assert.equal(await pageFor('zorblax', wiki({ title: 'Quantum computing' })), null, 'a page that is not the name asked is never taken');
  assert.deepEqual(await pageFor('mercury', wiki({ title: 'Mercury (planet)' })), { title: 'Mercury (planet)', usual: 'Mercury' }, 'a disambiguation tail is dropped');
  assert.equal(await pageFor('x', wiki()), null); assert.equal(await pageFor('dimebag darrel', wiki({ fail: true })), null, 'a failed fetch is no page, never an error');
});
test('the lead photo comes only from the Wikimedia image hosts, as a small jpeg, png or webp, from a standard page', async () => {
  const ok = await leadPhoto('dimebag darrel', wiki()); assert.match(ok.img, /^data:image\/jpeg;base64,/); assert.equal(ok.usual, 'Dimebag Darrell'); assert.match(ok.description, /guitarist/);
  const viaWikidata = await leadPhoto('dimebag darrel', wiki({ noThumb: true })); assert.match(viaWikidata.img, /^data:image\/jpeg/, 'no Wikipedia thumbnail (non-free photo): the free Wikidata image is next');
  const why = []; assert.equal(await leadPhoto('dimebag darrel', wiki({ noThumb: true, noP18: true }), why), null); assert.match(why.join(), /no wikidata image.*no free photo/);
  assert.equal(await leadPhoto('dimebag darrel', wiki({ noThumb: true, offsite: true })), null, 'a Commons answer that points off Wikimedia is dropped');
  assert.ok(await leadPhoto('dimebag darrel', wiki({ noThumb: true, relative: true })), 'a protocol-relative Commons address is the same photo, not a miss');
  assert.ok(await leadPhoto('dimebag darrel', wiki({ noThumb: true, thumbHost: true })), 'thumb.wikimedia.org, where Commons now answers (live, 2026-10-24), is Wikimedia too');
  assert.equal(await leadPhoto('dimebag darrel', wiki({ src: 'https://thumb.wikimedia.org.evil.example/x.jpg', offsite: true })), null, 'a look-alike host is not');
  assert.equal(await leadPhoto('dimebag darrel', wiki({ src: '//evil.example/x.jpg', offsite: true })), null, 'protocol-relative off Wikimedia is still dropped');
  assert.match((await leadPhoto('dimebag darrel', wiki({ src: 'https://evil.example/a.jpg' }))).img, /^data:/, 'a thumbnail address off Wikimedia is never fetched; the Wikidata image is used instead');
  assert.equal(await leadPhoto('dimebag darrel', wiki({ type: 'disambiguation' })), null);
  assert.equal(await leadPhoto('dimebag darrel', wiki({ ct: 'text/html' })), null); assert.equal(await leadPhoto('dimebag darrel', wiki({ bigPhoto: true })), null);
});

// the route: the photo's description paints the cartoon, the usual spelling is used, and without a page the text model is asked as before
const look = 'a lean man with long curly dark brown hair, a long braided goatee dyed bright pink, a sleeveless black shirt, camouflage cargo shorts, a razor blade pendant, a blue electric guitar shaped like a jagged lightning bolt';
function env(visionSays) {
  const calls = { vision: 0, text: 0, paint: [] }, store = new Map();
  const DB = { prepare: (q) => ({ bind: (...a) => ({ run: async () => { if (/INSERT/.test(q)) store.set(a[0], { img: a[1], day: a[2] }); return {}; }, first: async () => (/SELECT img/.test(q) ? store.get(a[0]) || null : /COUNT/.test(q) ? { n: store.size } : null), all: async () => ({ results: [] }) }), run: async () => ({}), first: async () => ({ n: store.size }) }) };
  const JPEGB64 = '/9j/4AAQSkZJRgABAg' + 'B'.repeat(9000);
  return { calls, DB, SALT: 't', ART_POLLINATIONS: '0', AI: { run: async (model, o) => {
    if (o && o.messages) { const vision = Array.isArray(o.messages[0].content); if (vision) { calls.vision++; return { response: visionSays }; } calls.text++; return { response: 'Name: Wrong\nLook: a generic man with a beard and a guitar in dark clothes' }; }
    calls.paint.push(o && (o.prompt || (o.multipart && 'multipart'))); return { image: JPEGB64 }; } } };
}
test('photoLook paints from the photo description and says where it came from; no page falls back to the text model', async () => {
  const realFetch = globalThis.fetch; globalThis.fetch = wiki();
  try {
    const e = env(look); route.resetReady();
    const r = await route.photoLook(e, 'dimebag darrel', wiki());
    assert.equal(r.source, 'wikipedia'); assert.equal(r.name, 'Dimebag Darrell'); assert.match(r.look, /goatee dyed bright pink.*lightning bolt.*; american guitarist$/, 'the page says what the subject is'); assert.equal(e.calls.vision, 1);
    const none = await route.photoLook(env(look), 'zorblax', wiki({ title: 'Quantum computing' })); assert.equal(none, null);
    const l = await route.lookFor(env(look), 'cartoon13 dimebag darrel'); assert.equal(l.source, 'wikipedia'); assert.equal(l.name, 'Dimebag Darrell');
    const e2 = env(look); globalThis.fetch = wiki({ fail: true }); const f = await route.lookFor(e2, 'cartoon13 dimebag darrel');
    assert.equal(e2.calls.vision, 0); assert.equal(e2.calls.text, 1); assert.match(f.look, /generic man/, 'without a page the text model is asked as before'); assert.match(f.photoWhy, /search error down/, 'and it says why the photo was not used');
  } finally { globalThis.fetch = realFetch; }
});
