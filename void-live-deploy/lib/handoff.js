/**
 * handoff: "Send to" between Verse's pages, on the device (owner, 2026-10-26: "and link them all if they are usable together"; docs/RULES.md
 * "Link what works together"). What one page makes goes to the next page that can use it: a trip's flights to the calendar, a note to the board,
 * a PDF page to the photo tools, a quote to the notes. The contract (docs/playbooks/link-pages.md):
 *   - a payload is { kind, data, from }: kind is one of KINDS, data is checked and cut to size by clean() (untrusted text, never HTML);
 *   - a page that makes something calls offer(kind, () => data) once (before or after the row is drawn); the "Use with" row (lib/toolkit.js mountRelated) then shows
 *     "Send to <page>" for every page in RECEIVERS that takes that kind (with a converter: a job, a parcel or a flight lands on the calendar);
 *   - a page that takes something lists itself in RECEIVERS and calls receive(path, { kind: (data) => 'what was done' }) when it starts,
 *     or names a link (link: (payload) => '/time/?at=...') so it needs no code of its own;
 *   - it travels same-origin only: a small payload in the address's # part (never sent to a server), a large one or a file in IndexedDB
 *     (read once, then deleted; anything left over an hour is swept). Nothing goes through the server, no account.
 * Pure except offer(), send(), receive() and the IndexedDB helpers. Tests: tools/handoff.test.mjs.
 */
import { RECEIVES, MAKES, MAKES_FILES, targetsFor } from './toolkit.js';
export const KINDS = Object.freeze(['event', 'place', 'route', 'file', 'text', 'list', 'job', 'parcel']);
export const LIMITS = Object.freeze({ text: 200000, title: 200, line: 500, items: 500, events: 50, stops: 20, notes: 2000, file: 50 * 1024 * 1024, inHash: 1800 });

// ---------- checking what arrives: every string cut, control characters gone, shapes exact; anything else is null ----------
const str = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
const line = (v, max) => str(v, max).replace(/[\r\n\t]+/g, ' ');
const DAY = /^\d{4}-\d{2}-\d{2}$/, WHEN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/;
const when = (v) => { const s = line(v, 16); if (!WHEN.test(s)) return ''; const d = new Date(s.length === 10 ? s + 'T00:00:00Z' : s + ':00Z'); return Number.isNaN(d.getTime()) ? '' : s; };
const tzOk = (v) => { const s = line(v, 64); return /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){0,2}$|^UTC$/.test(s) ? s : ''; };
const httpsUrl = (v) => { const s = line(v, 2000); try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch (_) { return ''; } };
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
const drop = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== false && !(Array.isArray(v) && !v.length)));

function cleanEvent(e) {
  if (!e || typeof e !== 'object') return null;
  const title = line(e.title, LIMITS.title), start = when(e.start); if (!title || !start) return null;
  let end = when(e.end); if (end && end < start) end = '';
  const allDay = !!e.allDay || start.length === 10;
  return drop({ title, start: allDay ? start.slice(0, 10) : start, end: end ? (allDay ? end.slice(0, 10) : end) : '', allDay, tz: allDay ? '' : tzOk(e.tz), endTz: allDay ? '' : tzOk(e.endTz),
    location: line(e.location, 300), notes: str(e.notes, LIMITS.notes) });
}
const CLEAN = {
  text: (d) => { const text = str(d && d.text, LIMITS.text); return text ? drop({ text, title: line(d.title, LIMITS.title) }) : null; },
  list: (d) => { const items = (Array.isArray(d && d.items) ? d.items : []).map((x) => line(x, LIMITS.line)).filter(Boolean).slice(0, LIMITS.items); return items.length ? drop({ items, title: line(d.title, LIMITS.title) }) : null; },
  event: (d) => { const raw = Array.isArray(d) ? d : d && Array.isArray(d.events) ? d.events : [d]; const events = raw.slice(0, LIMITS.events).map(cleanEvent).filter(Boolean); return events.length ? { events } : null; },
  place: (d) => { if (!d || typeof d !== 'object') return null; const name = line(d.name, LIMITS.title), code = /^[A-Z]{3}$/.test(line(d.code, 10).toUpperCase()) ? line(d.code, 10).toUpperCase() : '';
    return name || code ? drop({ name: name || code, code, lat: num(d.lat, -90, 90), lon: num(d.lon, -180, 180), tz: tzOk(d.tz) }) : null; },
  route: (d) => { const stops = (Array.isArray(d && d.stops) ? d.stops : []).map((x) => line(x, 10).toUpperCase()).filter((x) => /^[A-Z]{3}$/.test(x)).slice(0, LIMITS.stops); return stops.length >= 2 ? { stops } : null; },
  file: (d) => { if (!d || typeof d !== 'object') return null; const blob = d.blob, B = globalThis.Blob; if (!B || !(blob instanceof B) || !blob.size || blob.size > LIMITS.file) return null;
    const type = /^[\w.+-]+\/[\w.+-]+$/.test(line(d.type || blob.type, 100)) ? line(d.type || blob.type, 100).toLowerCase() : 'application/octet-stream';
    const name = line(d.name, LIMITS.title).replace(/[\\/:*?"<>|]+/g, '_') || 'file'; return { name, type, size: blob.size, blob }; },
  job: (d) => { if (!d || typeof d !== 'object') return null; const title = line(d.title, LIMITS.title); if (!title) return null;
    return drop({ title, company: line(d.company, LIMITS.title), when: when(d.when), tz: tzOk(d.tz), where: line(d.where, 300), url: httpsUrl(d.url), notes: str(d.notes, LIMITS.notes), step: line(d.step, 40) }); },
  parcel: (d) => { if (!d || typeof d !== 'object') return null; const name = line(d.name, LIMITS.title), expected = when(d.expected).slice(0, 10); if (!name || !DAY.test(expected)) return null;
    return drop({ name, expected, carrier: line(d.carrier, 60), tracking: line(d.tracking, 60), url: httpsUrl(d.url) }); },
};
/** a payload made safe: { kind, data, from } with every field checked and cut to size, or null. Pure. */
export function clean(p) {
  if (!p || typeof p !== 'object' || !KINDS.includes(p.kind)) return null;
  let data = null; try { data = CLEAN[p.kind](p.data); } catch (_) { data = null; }
  if (!data) return null;
  const from = /^\/(?:[a-z0-9-]+\/)*$/.test(String(p.from || '')) ? String(p.from) : '';
  return drop({ kind: p.kind, data, from, fromName: line(p.fromName, 60) });
}

// ---------- turning one kind into another, so a page that takes events takes a job interview or a parcel too ----------
const pad = (n) => String(n).padStart(2, '0');
/** the minutes a time zone is ahead of UTC at an instant (0 for none or an unknown zone). Pure. */
export function offsetOf(tz, ms) {
  if (!tz) return 0; try { const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const o = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return Math.round((Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute) - Math.floor(ms / 60000) * 60000) / 60000); } catch (_) { return 0; }
}
/** a local 'YYYY-MM-DDTHH:MM' in a zone as epoch ms, or NaN. Pure. */
export function utcOf(local, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(local || '')); if (!m) return NaN;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)); if (!tz) return guess;
  const a = guess - offsetOf(tz, guess) * 60000; return guess - offsetOf(tz, a) * 60000;
}
/** an instant as local 'YYYY-MM-DDTHH:MM' in a zone. Pure. */
export function localOf(ms, tz) { const d = new Date(ms + offsetOf(tz, ms) * 60000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
/** the calendar events a payload stands for: events as they are, a job's interview (an hour), a parcel's expected day (all day); [] for the rest. Pure. */
export function asEvents(p) {
  if (!p) return []; const d = p.data;
  if (p.kind === 'event') return d.events;
  if (p.kind === 'job' && d.when) return [drop({ title: (d.step || 'Interview') + ': ' + d.title + (d.company ? ' at ' + d.company : ''), start: d.when, allDay: d.when.length === 10, tz: d.tz, location: d.where, notes: [d.url, d.notes].filter(Boolean).join('\n') })];
  if (p.kind === 'parcel') return [drop({ title: 'Parcel arrives: ' + d.name, start: d.expected, allDay: true, notes: [d.carrier, d.tracking && 'Tracking ' + d.tracking, d.url].filter(Boolean).join(' · ') })];
  return [];
}
const evLine = (e) => e.title + ' · ' + e.start.replace('T', ' ') + (e.tz ? ' (' + e.tz + ')' : '') + (e.location ? ' · ' + e.location : '');
/** a payload as lines of text (a card each on a board, a line each in a note); [] for a file. Pure. */
export function asList(p) {
  if (!p) return []; const d = p.data;
  switch (p.kind) {
    case 'list': return d.items;
    case 'text': return d.text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, LIMITS.items).map((x) => x.slice(0, LIMITS.line));
    case 'event': return d.events.map(evLine);
    case 'place': return [d.name + (d.code && d.code !== d.name ? ' (' + d.code + ')' : '')];
    case 'route': return [d.stops.join(' → ')];
    case 'job': return [d.title + (d.company ? ' at ' + d.company : '') + (d.when ? ' · ' + d.when.replace('T', ' ') : '')];
    case 'parcel': return ['Parcel: ' + d.name + ' · expected ' + d.expected + (d.tracking ? ' · ' + d.tracking : '')];
    default: return [];
  }
}
/** a payload as { title, text } for a note or a word count; null for a file. Pure. */
export function asText(p) {
  if (!p || p.kind === 'file') return null; const d = p.data;
  if (p.kind === 'text') return { title: d.title || '', text: d.text };
  const title = d.title || (p.kind === 'event' ? (d.events.length === 1 ? d.events[0].title : d.events.length + ' events') : p.kind === 'job' ? d.title : p.kind === 'parcel' ? 'Parcel: ' + d.name : p.kind === 'place' ? d.name : p.kind === 'route' ? 'Route ' + d.stops.join('-') : '');
  const extra = p.kind === 'event' ? d.events.map((e) => e.notes).filter(Boolean) : p.kind === 'job' ? [d.where, d.url, d.notes].filter(Boolean) : [];
  return { title, text: [...asList(p).map((x) => (p.kind === 'list' ? '- ' + x : x)), ...extra].join('\n') };
}
const cityOfTz = (tz) => String(tz || '').split('/').pop().replace(/_/g, ' ');

// ---------- who takes what ----------
// The tables (which page takes which kinds and file types, which page makes what) live in lib/toolkit.js (RECEIVES, MAKES), so the related row
// can link the pages that work together without loading this file; here each page that reads its own address gets its link.
const LINKS = {
  '/translate/': (p) => '/translate/?q=' + encodeURIComponent(asText(p).text.slice(0, 5000)),
  '/time/': (p) => {
    const e = asEvents(p).find((x) => !x.allDay);
    if (e) { const zones = [...new Set([e.tz, e.endTz].filter(Boolean))]; const at = new Date(utcOf(e.start, e.tz)).toISOString(); return '/time/?at=' + encodeURIComponent(at) + (zones.length ? '&c=' + zones.map((z) => encodeURIComponent(cityOfTz(z))).join(',') : ''); }
    return p.kind === 'place' ? '/time/?c=' + encodeURIComponent(p.data.tz ? cityOfTz(p.data.tz) : p.data.name) : ''; },
  '/weather/': (p) => '/weather/?q=' + encodeURIComponent(p.data.name),
  '/flights/map/': (p) => '/flights/map/?route=' + encodeURIComponent(p.kind === 'route' ? p.data.stops.join('-') : p.data.code || p.data.name),
};
/** path: { name, kinds, files (MIME patterns a file must match), link (a page that reads its own address: no receiving code) }. */
export const RECEIVERS = Object.freeze(Object.fromEntries(Object.entries(RECEIVES).map(([p, r]) => [p, LINKS[p] ? { ...r, link: LINKS[p] } : r])));
/** the pages that make something another page takes, and what (tools/link-check.mjs holds each to offering it). */
export const PRODUCERS = MAKES;
export { MAKES_FILES, targetsFor };
const mimeOk = (pats, type) => (pats || []).some((m) => (m.endsWith('/*') ? type.startsWith(m.slice(0, -1)) : type === m));
/** whether a page takes a payload (its kind, and a file's type). Pure. */
export function accepts(path, p) { const r = RECEIVERS[path]; return !!(r && p && r.kinds.includes(p.kind) && (p.kind !== 'file' || mimeOk(r.files, p.data.type))); }

// ---------- the address part: base64url of the JSON, for payloads without a file ----------
const b64url = (s) => { const b = new TextEncoder().encode(s); let bin = ''; for (const x of b) bin += String.fromCharCode(x); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (s) => { const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(s).length / 4) * 4, '=')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); };
/** the '#send=...' part for a clean payload small enough to ride in the address, or '' (a file, or too long). Pure. */
export function toHash(p) { if (!p || p.kind === 'file') return ''; const h = '#send=' + b64url(JSON.stringify(p)); return h.length <= LIMITS.inHash ? h : ''; }
/** the payload an address part carries, checked again (it came from outside), or null. Pure. */
export function fromHash(hash) { const m = /(?:^#|&)send=([A-Za-z0-9_-]{4,})/.exec(String(hash || '')); if (!m) return null; try { return clean(JSON.parse(unb64url(m[1]))); } catch (_) { return null; } }
export const idOfHash = (hash) => (/(?:^#|&)send-id=([a-z0-9]{8,40})(?:&|$)/.exec(String(hash || '')) || [])[1] || '';

// ---------- IndexedDB, for files and long payloads ----------
const DB = 'a2m.void.handoff', STORE = 'p', HOUR = 3600000;
function db() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
const tx = (d, mode, fn) => new Promise((res, rej) => { const t = d.transaction(STORE, mode), s = t.objectStore(STORE), out = fn(s); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); });
async function put(p) {
  const d = await db(), id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  await tx(d, 'readwrite', (s) => { const all = s.openCursor(); all.onsuccess = () => { const c = all.result; if (!c) return; if (!(c.value && c.value.at > Date.now() - HOUR)) c.delete(); c.continue(); }; s.put({ at: Date.now(), p }, id); });
  d.close(); return id;
}
async function takeStored(id) { const d = await db(); let v = null; await tx(d, 'readwrite', (s) => { const g = s.get(id); g.onsuccess = () => { v = g.result; s.delete(id); }; return g; }); d.close(); return v && v.at > Date.now() - HOUR ? v.p : null; }

/** send a payload to a page: through its link when it has one, else in the address or IndexedDB; resolves to the URL it opened, or ''. */
export async function send(path, payload, nav = (u) => { location.href = u; }) {
  const p = clean(payload); if (!p || !accepts(path, p)) return '';
  const r = RECEIVERS[path]; let url = r.link ? r.link(p) : '';
  if (!url) { const h = toHash(p); url = path + (h || '#send-id=' + (await put(p))); }
  nav(url); return url;
}

// ---------- the page that makes something ----------
const offers = [], subs = new Set();
/** this page makes a kind: get() gives the data when "Send to" is pressed (null when there is nothing yet); mime narrows a file's targets. */
export function offer(kind, get, { mime = null, label = '' } = {}) { if (!KINDS.includes(kind)) return; offers.push({ kind, get, mime, label }); for (const f of subs) f(); }
export const offered = () => offers.slice();
/** call fn whenever a page offers something more; returns the way to stop. */
export function onOffer(fn) { subs.add(fn); return () => subs.delete(fn); }

/** the "Send to" buttons of a page, in el: one per page that takes what it offers (the first offer that a page takes wins). */
export function mountSend(el, path, fromName = '') {
  if (!el) return () => {};
  const d = el.ownerDocument;
  const draw = () => {
    const seen = new Set(), btns = [];
    for (const o of offers) for (const t of targetsFor(o.kind, path, o.mime)) {
      if (seen.has(t.path)) continue; seen.add(t.path);
      const b = d.createElement('button'); b.type = 'button'; b.className = 'tk-send'; b.dataset.to = t.path; b.dataset.kind = o.kind; const word = 'Send ' + (o.label ? o.label + ' ' : '') + 'to ' + t.name; b.textContent = word;
      const flash = (m) => { b.textContent = m; setTimeout(() => { b.textContent = word; }, 1800); };
      b.addEventListener('click', async () => {
        let data = null; try { data = await o.get(); } catch (_) { data = null; }
        if (!data) { flash('Nothing to send yet'); return; }
        const p = clean({ kind: o.kind, data, from: path, fromName });
        if (!p) { flash('That is too big or not readable'); return; }
        if (!accepts(t.path, p)) { flash(t.name + ' does not take this'); return; }
        try { if (!(await send(t.path, p))) flash('Could not send it'); } catch (_) { flash('Could not send it'); }
      });
      btns.push(b);
    }
    el.replaceChildren(...btns); el.hidden = !btns.length;
  };
  draw(); return onOffer(draw);
}

// ---------- the page that takes something ----------
/** what arrived in this page's address, read once (the # part is taken off the address; a stored one is deleted), or null. */
export async function take(loc = globalThis.location) {
  if (!loc) return null; const hash = loc.hash || ''; let p = fromHash(hash);
  const id = p ? '' : idOfHash(hash);
  if (id) { try { p = clean(await takeStored(id)); } catch (_) { p = null; } }
  if (p || id) try { history.replaceState(null, '', loc.pathname + loc.search); } catch (_) { /* no history */ }
  return p;
}
/** read what was sent to this page and hand it to the handler for its kind; the handler says what it did, shown in a note at the foot of the
 *  screen (fixed, so nothing on the page moves). Resolves to the payload, or null. */
export async function receive(path, handlers, d = globalThis.document) {
  const p = await take(); if (!p) return null;
  const fn = accepts(path, p) ? handlers[p.kind] : null;
  let said = ''; try { said = fn ? await fn(p.data, p) : ''; } catch (_) { said = ''; }
  note(d, said ? (p.fromName ? 'From ' + p.fromName + ': ' : '') + said : 'This page could not use what was sent.');
  return p;
}
function note(d, text) {
  if (!d || !d.body) return; const n = d.createElement('p'); n.className = 'tk-got'; n.setAttribute('role', 'status'); n.textContent = text;
  n.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);display:flex;align-items:center;gap:6px;box-sizing:border-box;margin:0;padding:6px 6px 6px 16px;border-radius:12px;background:#1d1b26;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px #0005;z-index:99';
  const x = d.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', 'Close'); x.style.cssText = 'flex:none;background:none;border:0;color:inherit;font:inherit;cursor:pointer;min-width:40px;min-height:40px';
  x.addEventListener('click', () => n.remove()); n.append(x); d.body.append(n); setTimeout(() => n.remove(), 9000);
}
