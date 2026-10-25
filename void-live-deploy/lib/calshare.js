// A whole calendar shared by link, no account (owner, 2026-10-25: "share a whole calendar by link with view/edit rights and no login"; the way
// Teamup does it: one link that only shows, one that also edits). The calendar lives on Verse's server (functions/api/calshare.js, D1) as one
// small document { name, color, events }; whoever holds a link's key can read it, and the edit key can also change it. The keys are never stored,
// only their SHA-256 with the site's SALT, so a copy of the table opens nothing. The link carries its key after a # (the browser never sends that
// part to any server, and it is not in a Referer). The owner key stays in the browser that shared the calendar: it resets the links and stops
// sharing. Pure, apart from the random keys. Tests: tools/calshare.test.mjs.
import * as C from './calendar.js';

export const LIMITS = Object.freeze({ body: 200000, events: 1000, perMinute: 30, createsPerDay: 20, writesPerDay: 600, allCreatesPerDay: 2000, idleDays: 400 });
export const ROLES = Object.freeze(['view', 'edit', 'owner']);
const B64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** a fresh random key (128 bits, base64url, 22 characters) */
export const newKey = () => B64(crypto.getRandomValues(new Uint8Array(16)));
/** a fresh calendar id (64 bits, 11 characters) */
export const newShareId = () => B64(crypto.getRandomValues(new Uint8Array(8)));
export const isId = (s) => /^[A-Za-z0-9_-]{11}$/.test(String(s || ''));
export const isKey = (s) => /^[A-Za-z0-9_-]{22}$/.test(String(s || ''));
/** the hex SHA-256 of a key with the site's salt: what the table keeps instead of the key */
export async function hashKey(key, salt) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('calshare:' + String(salt || '') + ':' + String(key || '')));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** the link that opens a shared calendar: the key after #, never sent to a server. Pure. */
export const linkOf = (origin, id, key) => String(origin || '') + '/calendar/#share=' + id + '.' + key;
/** { id, key } from a page's hash ("#share=<id>.<key>"), or null. Pure. */
export function fromHash(hash) {
  const m = /(?:^#|&)share=([A-Za-z0-9_-]{11})\.([A-Za-z0-9_-]{22})(?:&|$)/.exec(String(hash || ''));
  return m ? { id: m[1], key: m[2] } : null;
}
/** a calendar document as it may be kept: a name, a colour and up to LIMITS.events events, each one normalized (lib/calendar.js), with no
 *  calendar of its own and nothing read-only: { ok, doc } or { ok: false, status, error } with a fixed error that echoes nothing. Pure. */
export function parseDoc(raw) {
  let o = raw;
  if (typeof raw === 'string') { if (raw.length > LIMITS.body) return { ok: false, status: 413, error: 'too big' }; try { o = JSON.parse(raw); } catch (_) { return { ok: false, status: 400, error: 'not JSON' }; } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, status: 400, error: 'not a calendar' };
  const name = String(o.name || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 60);
  if (!name) return { ok: false, status: 400, error: 'a calendar needs a name' };
  if (!Array.isArray(o.events)) return { ok: false, status: 400, error: 'events must be a list' };
  if (o.events.length > LIMITS.events) return { ok: false, status: 413, error: 'too many events' };
  const events = o.events.map((e) => C.normalize(e && typeof e === 'object' ? { ...e, cal: undefined, ro: undefined } : null)).filter(Boolean);
  const color = /^#[0-9a-f]{6}$/i.test(o.color || '') ? String(o.color).toLowerCase() : C.PALETTE[4];
  const rev = Number.isInteger(o.rev) && o.rev >= 0 ? o.rev : null;
  return { ok: true, doc: { name, color, events }, rev };
}
/** a calendar entry for a shared calendar in the page's store: drawn in its colour, read-only when the link only shows. Pure. */
export const calendarEntry = (id, key, role, doc) => ({ id: 'sh-' + id, name: doc.name, color: doc.color, on: true, kind: 'shared', share: { id, key, role } });
/** the shared calendar's events as the page draws them: on that calendar, read-only for a view link. Pure. */
export const eventsOf = (calId, role, events) => (events || []).map((e) => ({ ...e, cal: calId, ...(role === 'view' ? { ro: true } : {}) }));
