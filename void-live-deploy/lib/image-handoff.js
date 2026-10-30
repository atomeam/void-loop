// lib/image-handoff.js: one picture carried from one Verse page to the next (owner, 2026-10-29: "all the pages are supposed to be able
// to work together"). A picture is too big for a link, so a press on a send link keeps one copy in this browser's IndexedDB
// (verse-handoff / img / last: { blob, name, fromPage, at }) and opens the next page with ?img=handoff; that page takes the copy and
// opens it as if the file had been chosen there. Nothing is written until a person presses, nothing leaves the device, and a copy older
// than an hour is not offered. Tests: tools/image-handoff.test.mjs.

export const PARAM = 'img', VALUE = 'handoff';
export const MAX_AGE = 60 * 60 * 1000, MAX_BYTES = 50 * 1024 * 1024;
const DB = 'verse-handoff', STORE = 'img', KEY = 'last';

/** whether a page was opened to take the kept picture. Pure. */
export const wantsImage = (search) => new URLSearchParams(search || '').get(PARAM) === VALUE;
/** the link that opens `path` with the kept picture: imageLink('/paint/') → '/paint/?img=handoff'; a link that has it already is kept. Pure. */
export function imageLink(path) {
  const p = String(path), q = p.indexOf('?');
  if (q >= 0 && wantsImage(p.slice(q))) return p;
  return p + (q >= 0 ? '&' : '?') + PARAM + '=' + VALUE;
}
/** the address without ?img=handoff, so a reload does not open the picture a second time. Pure. */
export function withoutImage(href) {
  const u = new URL(href, 'https://x.invalid'); u.searchParams.delete(PARAM);
  return u.pathname + (u.search === '?' ? '' : u.search) + u.hash;
}
/** a safe file name for the picture, with an extension that fits its type. Pure. */
export function fileNameOf(name, type) {
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }[type] || 'png';
  const base = String(name == null ? '' : name).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 60) || 'picture';
  return base + '.' + ext;
}
/** whether a kept record can be offered: a picture, not too big, not too old. Pure. */
export function usable(rec, now = Date.now()) {
  if (!rec || typeof rec !== 'object' || !rec.blob || typeof rec.at !== 'number') return false;
  const type = String(rec.blob.type || ''), size = Number(rec.blob.size);
  return /^image\//.test(type) && size > 0 && size <= MAX_BYTES && now - rec.at >= 0 && now - rec.at <= MAX_AGE;
}

/** the browser's store: IndexedDB, one object store, one key */
export function idbStore(idb = globalThis.indexedDB, key = KEY) {
  const open = () => new Promise((ok, no) => { if (!idb) return no(new Error('no IndexedDB')); const r = idb.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const run = async (mode, fn) => { const db = await open(); try { return await new Promise((ok, no) => { const t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE));
    t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); t.onabort = () => no(t.error); }); } finally { db.close(); } };
  return { get: () => run('readonly', (s) => s.get(key)), set: (v) => run('readwrite', (s) => s.put(v, key)) };
}

/** keep one picture for the next page (called from a press only). true when it was kept. */
export async function putImage(blob, { name = '', fromPage = '' } = {}, store = idbStore(), now = Date.now()) {
  const rec = { blob, name: fileNameOf(name, blob && blob.type), fromPage: String(fromPage).slice(0, 80), at: now };
  if (!usable(rec, now)) return false;
  try { await store.set(rec); return true; } catch (_) { return false; }
}
/** the kept picture as a File ({ file, fromPage }), or null when there is none to offer */
export async function takeImage(store = idbStore(), now = Date.now()) {
  let rec = null; try { rec = await store.get(); } catch (_) { return null; }
  if (!usable(rec, now)) return null;
  const F = globalThis.File, file = F ? new F([rec.blob], rec.name, { type: rec.blob.type }) : Object.assign(rec.blob, { name: rec.name });
  return { file, fromPage: rec.fromPage };
}

/** send a picture: keep it, then open the next page. getBlob() may be async and may give null (nothing to send). */
export async function sendImage(path, getBlob, { name = '', fromPage = '' } = {}, go = (u) => { globalThis.location.href = u; }) {
  let blob = null; try { blob = await getBlob(); } catch (_) { blob = null; }
  if (!blob) return false;
  const kept = await putImage(blob, { name, fromPage });
  if (kept) go(imageLink(path));
  return kept;
}
/** a picture given as a data: or same-origin address, as a Blob */
export const blobOf = async (src) => (await fetch(src)).blob();
/** a canvas as a PNG Blob */
export const canvasBlob = (c, type = 'image/png') => new Promise((ok) => c.toBlob((b) => ok(b), type));

/** on a receiving page: when it was opened with ?img=handoff, give the kept picture to open(file) and tidy the address */
export async function receiveImage(open, loc = globalThis.location, hist = globalThis.history, store) {
  if (!wantsImage(loc.search)) return false;
  try { hist.replaceState(hist.state, '', withoutImage(loc.pathname + loc.search + loc.hash)); } catch (_) { /* the address stays; harmless */ }
  const got = await takeImage(store);
  if (!got) return false;
  await open(got.file, got.fromPage);
  return true;
}

// a PDF goes the same way, under its own key and ?doc=handoff, so a picture and a document kept at once do not replace each other
// (PDF tools: "Translate it" opens /translate/ with the PDF ready). Only a PDF is taken, and only a press keeps one.
export const DOC_PARAM = 'doc', DOC_KEY = 'doc';
/** whether a page was opened to take the kept document. Pure. */
export const wantsDoc = (search) => new URLSearchParams(search || '').get(DOC_PARAM) === VALUE;
/** the link that opens `path` with the kept document: docLink('/translate/') → '/translate/?doc=handoff'. Pure. */
export function docLink(path) {
  const p = String(path), q = p.indexOf('?');
  if (q >= 0 && wantsDoc(p.slice(q))) return p;
  return p + (q >= 0 ? '&' : '?') + DOC_PARAM + '=' + VALUE;
}
/** a safe file name for the document, ending in .pdf. Pure. */
export const docNameOf = (name) => fileNameOf(name, 'image/png').replace(/\.png$/, '.pdf').replace(/^picture\.pdf$/, 'document.pdf');
/** whether a kept record can be offered: a PDF, not too big, not too old. Pure. */
export function usableDoc(rec, now = Date.now()) {
  if (!rec || typeof rec !== 'object' || !rec.blob || typeof rec.at !== 'number') return false;
  const size = Number(rec.blob.size);
  return String(rec.blob.type || '') === 'application/pdf' && size > 0 && size <= MAX_BYTES && now - rec.at >= 0 && now - rec.at <= MAX_AGE;
}
/** keep one PDF for the next page (called from a press only). true when it was kept. */
export async function putDoc(blob, { name = '', fromPage = '' } = {}, store = idbStore(undefined, DOC_KEY), now = Date.now()) {
  const rec = { blob, name: docNameOf(name), fromPage: String(fromPage).slice(0, 80), at: now };
  if (!usableDoc(rec, now)) return false;
  try { await store.set(rec); return true; } catch (_) { return false; }
}
/** the kept PDF as a File ({ file, fromPage }), or null when there is none to offer */
export async function takeDoc(store = idbStore(undefined, DOC_KEY), now = Date.now()) {
  let rec = null; try { rec = await store.get(); } catch (_) { return null; }
  if (!usableDoc(rec, now)) return null;
  const F = globalThis.File, file = F ? new F([rec.blob], rec.name, { type: rec.blob.type }) : Object.assign(rec.blob, { name: rec.name });
  return { file, fromPage: rec.fromPage };
}
/** send a PDF: keep it, then open the next page. getBlob() may be async and may give null (nothing to send). */
export async function sendDoc(path, getBlob, { name = '', fromPage = '' } = {}, go = (u) => { globalThis.location.href = u; }, store) {
  let blob = null; try { blob = await getBlob(); } catch (_) { blob = null; }
  if (!blob) return false;
  const kept = await putDoc(blob, { name, fromPage }, store);
  if (kept) go(docLink(path));
  return kept;
}
/** on a receiving page: when it was opened with ?doc=handoff, give the kept PDF to open(file) and tidy the address */
export async function receiveDoc(open, loc = globalThis.location, hist = globalThis.history, store) {
  if (!wantsDoc(loc.search)) return false;
  try { const u = new URL(loc.pathname + loc.search + loc.hash, 'https://x.invalid'); u.searchParams.delete(DOC_PARAM);
    hist.replaceState(hist.state, '', u.pathname + (u.search === '?' ? '' : u.search) + u.hash); } catch (_) { /* the address stays; harmless */ }
  const got = await takeDoc(store);
  if (!got) return false;
  await open(got.file, got.fromPage);
  return true;
}
