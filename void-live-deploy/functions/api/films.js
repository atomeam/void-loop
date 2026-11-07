// Verse's films, on the site for people who pay (owner, 2026-10-14: "just put void films right onto the sight , with only paid
// access"; "we need to scale up . just because we use cloudflare we can use whatever it takes on top of that"). The films live
// in R2 (bucket void-films, binding FILMS in wrangler.toml): films/<id>.mp4 and its words in films/<id>.json. Who may watch is the
// support desk's rule (payer() in functions/api/support.js): the owner, a Verse Pro key, a Code Review Pro license or a paid
// account's session. A <video> cannot send a Bearer header, so the list hands each payer a link to each film that is signed and
// stops working after WATCH_MS; the link streams from R2 with Range, so a film plays at once and seeks, however many people watch.
//   GET [?from=N]                (anyone)              -> { films: [{ id, at, title, description, tags, bytes, src, reviews }], owner, member, next }
//                                 one page, newest first; next is the ?from= of the page after it, null at the end (2026-11-06,
//                                 owner: "films is stopping at 60 ? why ?": the list used to end at the newest 60. Now there is no
//                                 ceiling: R2 is listed to its last key and each request reads a bounded page, so it never runs out)
//                                 reviews only for the owner and members (2026-10-15: the films are Verse's ads, so anyone watches)
//                                 reviews: lib/film-reviews.js (POST one at /api/film-review)
//   GET ?id=&exp=&sig=           (a signed link)       -> the MP4 (206 for a Range)
//   POST ?id= video/mp4 body     (the owner)           -> stores the film      (.github/workflows/record.yml, daily)
//   POST ?id= application/json   (the owner)           -> stores its words { title, description, tags }
// Anyone lists and watches; only the owner adds films.
import { bad, good } from '../../lib/void-me.js';
import { payer } from './support.js';
import { BUY_URL } from '../../lib/review-api.js';
import { forFilms } from '../../lib/film-reviews.js';

export const WATCH_MS = 6 * 3600e3, WORDS_MAX = 6000;
/** a page of films, and how many a request may read to fill one (the unlisted are skipped): bounded work per request, any number of films */
export const PAGE = 60, SCAN_MAX = 240;
export const LIST_MAX = PAGE; // the old name: a page now, not a ceiling
export const ID_RE = /^[a-z0-9][a-z0-9-]{2,95}$/;
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function signer(env) {
  if (!env.READ_TOKEN) throw new Error('READ_TOKEN is not set');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('void-film:' + env.READ_TOKEN + '|' + (env.SALT || '')));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
export async function sign(env, id, exp) { return b64u(await crypto.subtle.sign('HMAC', await signer(env), enc.encode(id + '|' + exp))); }
export async function watchLink(env, id, now = Date.now()) {
  const exp = Math.floor((now + WATCH_MS) / 1000);
  return '/api/films?id=' + id + '&exp=' + exp + '&sig=' + (await sign(env, id, exp));
}
async function signedOk(env, id, exp, sig, now) {
  if (!ID_RE.test(id) || !/^\d{9,11}$/.test(exp) || Number(exp) * 1000 < now || !sig) return false;
  const want = await sign(env, id, exp);
  if (want.length !== sig.length) return false;
  let d = 0; for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0;
}

const noStore = () => bad(503, 'films are not switched on here: the FILMS bucket is not bound');
const words = (s, max) => String(s || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, max);

// "bytes=a-b" | "bytes=a-" | "bytes=-n" -> an R2 range, or null for the whole film
function rangeOf(h, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(h || '');
  if (!m || (!m[1] && !m[2])) return null;
  if (!m[1]) { const n = Math.min(Number(m[2]), size); return { offset: size - n, length: n }; }
  const a = Number(m[1]), b = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return a <= b && a < size ? { offset: a, length: b - a + 1 } : 'bad';
}

async function stream(env, request, id) {
  const head = await env.FILMS.head('films/' + id + '.mp4');
  if (!head) return bad(404, 'no such film');
  const size = head.size, r = rangeOf(request.headers.get('range'), size);
  if (r === 'bad') return new Response(null, { status: 416, headers: { 'content-range': 'bytes */' + size } });
  const obj = await env.FILMS.get('films/' + id + '.mp4', r ? { range: r } : {});
  if (!obj) return bad(404, 'no such film');
  const h = { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=3600', 'content-length': String(r ? r.length : size) };
  if (!r) return new Response(obj.body, { status: 200, headers: h });
  return new Response(obj.body, { status: 206, headers: { ...h, 'content-range': 'bytes ' + r.offset + '-' + (r.offset + r.length - 1) + '/' + size } });
}

/** every film in the bucket, newest first. R2 lists at most 1000 keys a call, so the cursor is followed to the last one. */
export async function storedFilms(env) {
  const out = []; let cursor;
  do {
    const l = await env.FILMS.list({ prefix: 'films/', limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const o of l.objects || []) if (o.key.endsWith('.mp4')) out.push(o);
    cursor = l.truncated && l.cursor ? l.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
}

export async function onRequestGet({ request, env }) {
  if (!env.FILMS) return noStore();
  const q = new URL(request.url).searchParams, now = Date.now();
  if (q.has('id')) {
    const id = q.get('id') || '';
    if (!(await signedOk(env, id, q.get('exp') || '', q.get('sig') || '', now))) return bad(403, 'this film link is not signed or has run out: open /films/ again');
    return stream(env, request, id);
  }
  // anyone watches (owner, 2026-10-15: "anyone should be able to at least watch the films those are our ads its how we spread
  // the word"); reviews and the owner's tools stay with the owner and members
  const p = await payer(request, env).catch(() => null);
  const stored = await storedFilms(env);
  const from = Math.max(0, Math.floor(Number(q.get('from')) || 0)), owner = !!(p && p.owner);
  const words = async (o) => {
    const id = o.key.slice(6, -4);
    let w = {}; try { const j = await env.FILMS.get('films/' + id + '.json'); if (j) w = JSON.parse(await j.text()); } catch (_) { w = {}; }
    return { id, at: new Date(o.uploaded).toISOString(), title: w.title || id, description: w.description || '', tags: w.tags || '', bytes: o.size, src: await watchLink(env, id, now), ...(w.gate === 'pass' ? {} : { unlisted: true }) };
  };
  // read a page at a time until a page of films that may show is in hand, the scan budget is spent, or the films end
  const films = []; let at = from;
  while (at < stored.length && films.length < PAGE && at - from < SCAN_MAX) {
    const batch = stored.slice(at, at + Math.min(PAGE, SCAN_MAX - (at - from)));
    at += batch.length;
    for (const f of await Promise.all(batch.map(words))) if (owner || !f.unlisted) films.push(f);
  }
  const next = at < stored.length ? at : null;
  // unlisted until it passes the quality gate (owner, 2026-11-03: "verses videos are bad, its not framed properly the music is bad and
  // they are meaningless to most people"): a film shows to everyone only when its words say gate 'pass' (tools/video-gate.mjs). The
  // rest stay stored and the owner still sees them, marked unlisted, so this is reversible: post the words again with gate 'pass'.
  const reviews = p ? await forFilms(env, films.map((f) => f.id), p).catch(() => ({})) : {};
  for (const f of films) f.reviews = reviews[f.id] || null;
  return good({ films, owner, member: !!p, buy: BUY_URL, until: new Date(now + WATCH_MS).toISOString(), next, ...(owner ? { stored: stored.length } : {}) });
}

// Only the owner writes; lib/guard.js refuses anyone else before reading a byte of the body (OWNER_WRITES).
export async function onRequestPost({ request, env }) {
  if (!env.FILMS) return noStore();
  const p = await payer(request, env);
  if (!p || !p.owner) return bad(403, 'only the owner adds films');
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!ID_RE.test(id)) return bad(400, 'send ?id= (lowercase letters, digits and dashes)');
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (type.startsWith('video/mp4')) {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength < 1000) return bad(400, 'that is not a film');
    await env.FILMS.put('films/' + id + '.mp4', bytes, { httpMetadata: { contentType: 'video/mp4' } });
    return good({ ok: true, id, bytes: bytes.byteLength });
  }
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return bad(400, 'send the film as video/mp4, or its words as JSON { title, description, tags }'); }
  const w = { title: words(b && b.title, 200), description: words(b && b.description, WORDS_MAX), tags: words(b && b.tags, 500), gate: b && b.gate === 'pass' ? 'pass' : '' };
  if (!w.title) return bad(400, 'a film needs a title');
  await env.FILMS.put('films/' + id + '.json', JSON.stringify(w), { httpMetadata: { contentType: 'application/json' } });
  return good({ ok: true, id });
}
