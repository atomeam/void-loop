// Watch with Verse (lib/watch-along.js has the why and the pure half). One route:
//   POST { mode: 'ask', station, captions?, frame?, ask, turns?, listen? }  -> { text, senses }        talk about what is playing
//   POST { mode: 'learn', station, captions?, frame?, listen? }             -> { show, notes, kept }   Verse writes its own notes from it
//   POST { mode: 'choose', options }                    (owner key only)    -> { index, why, chosen }  Verse picks what to watch on its own
//   GET  ?kind=appraisal|fact|idea&q=<words>&limit=<n>                      -> { notes }               what Verse learned, newest first
// station is { kind: 'tv', cc, id } (an id from /local/tv/<CC>.json) or { kind: 'radio', id } (a Radio Browser station id). The name and
// network kept with a note come from those lists, never from the caller. listen: true on a radio station makes Verse hear its last few
// seconds itself (Whisper on the site's own binding), since a page cannot hand over the audio of another site's stream.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED.
//   - spend model calls: 'ask' has 12 a minute per connection, 'learn' 3 a minute per connection, one learn per station every 2 minutes
//     for everyone and LEARN_PER_DAY learns a day in all (D1 counters); 'choose' needs the owner key;
//   - make Verse's server read a radio stream: only the stream Radio Browser lists for that station id, https on the standard port and a
//     host name (lib/local-media.js playableStream), at most HEAR_BYTES bytes or HEAR_MS milliseconds, then dropped;
//   - put words in Verse's notes: a note is the model's own sentence about the material, at most 240 characters, checked by notesFrom();
//     captions are fenced as material, never instructions; a note is shown as text, never as markup, and never runs anything.
// Nothing of the stream is stored: not the captions, the picture or the audio. Only the notes are kept, with the station, show and day.
import { rateLimited } from './answer.js';
import { imageBytes } from './appraise.js';
import { ownerOk } from '../../lib/guard.js';
import { models, HEAR_FALLBACK } from '../../lib/models.js';
import { playableStream } from '../../lib/local-media.js';
import { stationOf, askMessages, learnMessages, notesFrom, senses, chooseMessages, pickFrom, wordsOf, KINDS, CAPTION_MAX } from '../../lib/watch-along.js';

export const ASK_PER_MIN = 12, LEARN_PER_MIN = 3, LEARN_GAP_S = 120, LEARN_PER_DAY = 400, HEAR_BYTES = 200000, HEAR_MS = 12000, FRAME_MAX = 400000;
const RADIO_HOSTS = ['de1.api.radio-browser.info', 'all.api.radio-browser.info'];
const UA = 'VerseBot/1.0 (+https://a-to-mind.com/local/)';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS void_watch_notes (h TEXT PRIMARY KEY, at TEXT NOT NULL, day TEXT NOT NULL, medium TEXT NOT NULL, cc TEXT NOT NULL, station TEXT NOT NULL, network TEXT NOT NULL, show TEXT NOT NULL, kind TEXT NOT NULL, topic TEXT NOT NULL, note TEXT NOT NULL, value_cents INTEGER, source TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS void_watch_runs (k TEXT PRIMARY KEY, n INTEGER NOT NULL, at INTEGER NOT NULL)',
];
let ready = null;
const schema = (env) => (ready = ready || env.DB.batch(SCHEMA.map((q) => env.DB.prepare(q))).catch((e) => { ready = null; throw e; }));

const said = (r) => String((r && (r.response || r.text || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && (r.result.response || r.result.text)))) || '').trim();
async function chat(env, messages, max_tokens) {
  return said(await env.AI.run(models('watch'), { messages, max_tokens, chat_template_kwargs: { enable_thinking: false } }));
}

async function getJson(url, fetchFn) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try { const r = await fetchFn(url, { signal: ctl.signal, headers: { accept: 'application/json', 'user-agent': UA } }); if (!r.ok) throw new Error('status ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
/** a TV station from the site's own lists (/local/tv/<CC>.json, then /local/tv/world/<CC>.json): { name, network } or null. */
export async function tvStation(env, origin, s) {
  if (!env || !env.ASSETS) return { name: s.name, network: s.network, unchecked: true };
  for (const path of ['/local/tv/' + s.cc + '.json', '/local/tv/world/' + s.cc + '.json']) {
    try {
      const r = await env.ASSETS.fetch(new Request(new URL(path, origin))); if (!r.ok) continue;
      const file = await r.json(), st = (file.stations || []).find((x) => x && x.id === s.id);
      if (st) return { name: String(st.t || s.id).slice(0, 90), network: String(st.n || '').slice(0, 40) };
    } catch (_) {}
  }
  return null;
}
/** a radio station from Radio Browser by its id: { name, cc, stream, codec } or null. */
export async function radioStation(id, fetchFn = fetch) {
  for (const h of RADIO_HOSTS) {
    try {
      const list = await getJson('https://' + h + '/json/stations/byuuid/' + encodeURIComponent(id), fetchFn), st = Array.isArray(list) && list[0];
      if (st) return { name: String(st.name || 'A station').replace(/\s+/g, ' ').trim().slice(0, 90), cc: String(st.countrycode || '').toUpperCase().slice(0, 2), stream: String(st.url_resolved || st.url || '').trim(), codec: String(st.codec || '').toUpperCase() };
    } catch (_) {}
  }
  return null;
}
/** the first HEAR_BYTES bytes of a live audio stream, read within HEAR_MS, as one array; null when it is not a stream Verse may read. */
export async function hearBytes(stream, fetchFn = fetch, limit = HEAR_BYTES, ms = HEAR_MS) {
  if (!playableStream(stream)) return null;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms), parts = []; let n = 0;
  try {
    const r = await fetchFn(stream, { signal: ctl.signal, headers: { 'user-agent': UA } });
    if (!r.ok || !r.body || /mpegurl|text\/html/i.test(r.headers.get('content-type') || '')) return null;
    const reader = r.body.getReader();
    while (n < limit) { const { done, value } = await reader.read(); if (done) break; parts.push(value); n += value.length; }
    try { await reader.cancel(); } catch (_) {}
  } catch (_) { if (!n) return null; } finally { clearTimeout(t); ctl.abort(); }
  const out = new Uint8Array(Math.min(n, limit)); let at = 0;
  for (const p of parts) { const take = Math.min(p.length, out.length - at); out.set(p.subarray(0, take), at); at += take; if (at >= out.length) break; }
  return out.length > 8000 ? out : null;
}
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
/** what Verse hears in the bytes: Whisper turbo, then the first Whisper; '' when neither answers. */
export async function hear(env, bytes) {
  try { const r = await env.AI.run(models('hear'), { audio: b64(bytes), vad_filter: true }); const s = said(r); if (s) return s; } catch (_) {}
  try { return said(await env.AI.run(HEAR_FALLBACK, { audio: [...bytes] })); } catch (_) { return ''; }
}

/** the station a request names, checked against the lists: { kind, cc, id, name, network, stream?, codec? } or a reason. */
async function resolve(env, origin, raw, fetchFn) {
  const s = stationOf(raw); if (!s) return { error: 'name a station: { kind: "tv", cc, id } or { kind: "radio", id }' };
  if (s.kind === 'tv') { const t = await tvStation(env, origin, s); return t ? { ...s, ...t } : { error: 'that TV station is not on Verse\'s lists' }; }
  const r = await radioStation(s.id, fetchFn); return r ? { ...s, ...r, cc: r.cc || s.cc } : { error: 'that radio station is not in the directory' };
}
/** the picture a request sends, when it is a small JPEG, PNG or WebP data URL; '' otherwise. */
const frameOf = (f) => { const s = String(f || '').trim(); return s && s.length <= FRAME_MAX && imageBytes(s) ? s : ''; };

async function bump(env, k, now) {
  await env.DB.prepare('INSERT INTO void_watch_runs (k, n, at) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1, at = excluded.at').bind(k, now).run();
}
const hashOf = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');

/** keep a learn's notes: each once per station (same text), with where and when Verse heard it. Returns how many were new. */
export async function keepNotes(env, st, learned, source, now = new Date()) {
  const at = now.toISOString(), day = at.slice(0, 10); let kept = 0;
  for (const n of learned.notes) {
    const h = await hashOf(st.kind + '|' + st.id + '|' + n.note.toLowerCase());
    const r = await env.DB.prepare('INSERT OR IGNORE INTO void_watch_notes (h, at, day, medium, cc, station, network, show, kind, topic, note, value_cents, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(h, at, day, st.kind, st.cc || '', st.name, st.network || '', learned.show, n.kind, n.topic, n.note, n.value_cents, source).run();
    if (r && r.meta && r.meta.changes) kept++;
  }
  return kept;
}
/** the notes Verse learned, newest first; kind and words narrow them. */
export async function readNotes(env, { kind = '', q = '', limit = 50 } = {}) {
  await schema(env);
  const words = wordsOf(q).slice(0, 4), where = [], args = [];
  if (KINDS.includes(kind)) { where.push('kind = ?'); args.push(kind); }
  for (const w of words) { where.push('(topic LIKE ? OR note LIKE ? OR show LIKE ?)'); args.push('%' + w + '%', '%' + w + '%', '%' + w + '%'); }
  const sql = 'SELECT at, day, medium, cc, station, network, show, kind, topic, note, value_cents, source FROM void_watch_notes' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY at DESC LIMIT ?';
  const r = await env.DB.prepare(sql).bind(...args, Math.max(1, Math.min(200, Number(limit) || 50))).all();
  return (r && r.results) || [];
}

export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return json({ notes: [], say: 'Verse keeps no notes on this deploy (no database bound).' });
  const p = new URL(request.url).searchParams;
  try { return json({ notes: await readNotes(env, { kind: p.get('kind') || '', q: p.get('q') || '', limit: p.get('limit') }) }); }
  catch (_) { return json({ notes: [], say: 'The notes did not load just now.' }, 502); }
}

export async function onRequestPost({ request, env, fetchFn = fetch }) {
  let body; try { body = await request.json(); } catch (_) { return json({ error: 'send JSON: { mode, station, ... }' }, 400); }
  const mode = body && body.mode;
  if (!['ask', 'learn', 'choose'].includes(mode)) return json({ error: 'mode is ask, learn or choose' }, 400);
  if (!env || !env.AI) return json({ error: 'Verse cannot watch from this deploy (no model bound)' }, 503);
  const owner = await ownerOk(request, env).catch(() => false);

  if (mode === 'choose') {
    if (!owner) return json({ error: 'only Verse\'s own watcher chooses' }, 403);
    const options = (Array.isArray(body.options) ? body.options : []).slice(0, 16).map((o) => ({ ...stationOf(o), watched: Math.max(0, Number(o && o.watched) || 0) })).filter((o) => o.id);
    if (!options.length) return json({ error: 'no stations to choose from' }, 400);
    let topics = []; try { if (env.DB) topics = (await readNotes(env, { limit: 20 })).map((n) => n.topic); } catch (_) {}
    let raw = ''; try { raw = await chat(env, chooseMessages(options, topics), 120); } catch (_) {}
    const pick = pickFrom(raw, options);
    return json({ ...pick, station: pick.index >= 0 ? options[pick.index] : null });
  }

  const origin = new URL(request.url).origin;
  if (!owner && await rateLimited(request, env, mode === 'ask' ? 'watch' : 'watch-learn', mode === 'ask' ? ASK_PER_MIN : LEARN_PER_MIN)) return json({ error: 'That is a lot in a minute. Give me a moment.' }, 429);
  const st = await resolve(env, origin, body.station, fetchFn); if (st.error) return json({ error: st.error }, 400);
  let captions = String(body.captions || '').slice(-CAPTION_MAX), heard = false, couldNot = '';
  const frame = st.kind === 'tv' ? frameOf(body.frame) : '';

  if (mode === 'learn') {
    if (!env.DB) return json({ error: 'Verse keeps no notes on this deploy (no database bound)' }, 503);
    await schema(env);
    const now = Math.floor(Date.now() / 1000), day = new Date().toISOString().slice(0, 10);
    const [last, today] = await Promise.all([
      env.DB.prepare('SELECT at FROM void_watch_runs WHERE k = ?').bind('station:' + st.kind + ':' + st.id).first('at'),
      env.DB.prepare('SELECT n FROM void_watch_runs WHERE k = ?').bind('day:' + day).first('n')]);
    if (last && now - last < LEARN_GAP_S) return json({ show: '', notes: [], kept: 0, say: 'Verse learned from this station a moment ago.' });
    if ((today || 0) >= LEARN_PER_DAY) return json({ show: '', notes: [], kept: 0, say: 'Verse has learned all it can today.' });
    await Promise.all([bump(env, 'station:' + st.kind + ':' + st.id, now), bump(env, 'day:' + day, now)]);
  }
  if (st.kind === 'radio' && (body.listen || !captions)) {
    const bytes = await hearBytes(st.stream, fetchFn);
    if (bytes) { const text = await hear(env, bytes); if (text) { captions = text.slice(-CAPTION_MAX); heard = true; } else couldNot = 'Verse listened but caught no words (music, or the speech model did not answer).'; }
    else couldNot = 'Verse could not open this station\'s stream to listen.';
  }
  const got = senses({ kind: st.kind, captions, frame });

  if (mode === 'ask') {
    const ask = String(body.ask || '').slice(0, 300);
    let text = ''; try { text = await chat(env, askMessages({ station: st, captions, frame, ask, turns: body.turns }), 400); } catch (_) {}
    if (!text) return json({ error: 'Verse did not answer just now; try again in a moment' }, 502);
    return json({ text, senses: got, heard, couldNot });
  }
  if (!captions && !frame) return json({ show: '', notes: [], kept: 0, senses: got, say: couldNot || 'Nothing to learn from: no captions and no picture.' });
  let raw = ''; try { raw = await chat(env, learnMessages({ station: st, captions, frame }), 600); } catch (_) {}
  const learned = notesFrom(raw);
  const kept = learned.notes.length ? await keepNotes(env, st, learned, owner && body.source === 'auto' ? 'verse' : 'viewers') : 0;
  return json({ show: learned.show, notes: learned.notes, kept, senses: got, heard, couldNot, station: { kind: st.kind, cc: st.cc, id: st.id, name: st.name } });
}
