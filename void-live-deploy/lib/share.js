// Bring someone into your Verse (frontier #11, plan item 10 the live half): the room one invite opens.
// An invite is a room name nobody can guess (random, signed with the site's SALT), so a stranger cannot wake a Durable
// Object for a name they made up. In the room only two things pass: where your cursor is (a faint presence on the other
// screens) and a summon (the words that put something on your stage, run again on theirs). Nothing else rides along, and
// each tab is held to RATE messages a second. Used by share-worker/index.js (the Durable Object), functions/api/share/
// and the page; tested in tools/share.test.mjs.
export const MAX_PEERS = 4, RATE = 40, MAX_MSG = 600, ASK_MAX = 120, TEXT_MAX = 400;
// Public rooms (owner, 2026-10-23: "the live crowd room for the is-it multiplayer flags ... the existing relay with rate limits and a closed
// message list"): a room anyone may join without an invite, named `public-<id>` from this closed list, with its own size. In a public room
// only the crowd's moves pass (a cursor with a flag, a ripple, a stamp): a summon or a thing's words from a stranger never reach anyone's
// stage. Nothing is stored; when the last tab closes, the room is gone.
export const PUBLIC_ROOMS = Object.freeze({ 'is-it': Object.freeze({ max: 150 }) });
const PUBLIC_RE = /^public-([a-z][a-z0-9-]{0,30})$/, FLAG = /^[A-Z]{2}$/, CROWD = new Set(['cursor', 'ripple', 'stamp']);
/** the config of a public room name ("public-is-it" -> { id: 'is-it', max: 150 }), or null for any other name. Pure. */
export function publicRoom(name) {
  const m = typeof name === 'string' && PUBLIC_RE.exec(name);
  return m && Object.prototype.hasOwnProperty.call(PUBLIC_ROOMS, m[1]) ? { id: m[1], ...PUBLIC_ROOMS[m[1]] } : null;
} // TEXT_MAX: a sticky's words, so the message stays under MAX_MSG
const B64U = /^[A-Za-z0-9_-]{16}$/;
const TOKEN = /^[A-Za-z0-9_-]{1,12}$/, KEY = /^[A-Za-z0-9_-]{1,12}\.\d{1,2}$/; // a summon's token; a thing it made: token.place
const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sign(secret, name) {
  const key = await crypto.subtle.importKey('raw', enc.encode('void-share|' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(name))).slice(0, 16);
}
export async function mintRoom(secret) {
  const name = b64u(crypto.getRandomValues(new Uint8Array(12)));
  return name + '.' + (await sign(secret, name));
}
export async function roomOk(room, secret) {
  if (!secret || typeof room !== 'string') return false;
  const [name, sig, extra] = room.split('.');
  if (extra !== undefined || !B64U.test(name || '') || !B64U.test(sig || '')) return false;
  const want = await sign(secret, name);
  let diff = 0; for (let i = 0; i < 16; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
export const inviteLink = (origin, room) => origin + '/?with=' + room;
export function roomFromUrl(href) {
  try { const r = new URL(href).searchParams.get('with'); return r && /^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{16}$/.test(r) ? r : null; } catch (_) { return null; }
}

// what may pass: a cursor (0..1 of the screen), a summon (the words, trimmed, and the short token the typing tab gave it), a
// move (that token and the thing's place in what the summon made, to a spot 0..1 of the stage), or a thing's words (the same
// key and plain text: line breaks kept, other control characters dropped, at most TEXT_MAX); anything else is null.
// Each tab gives its own ids to what a summon makes, so the token is how both tabs know which thing a move means.
export function clean(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_MSG) return null;
  let m; try { m = JSON.parse(raw); } catch (_) { return null; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const unit = (v) => Math.min(1, Math.max(0, v));
  // the crowd's moves: a cursor may carry a flag (exactly two capital letters: a region code, drawn as its flag on the other screens, never text),
  // and an angle (a whole number of 15° turns, -360..360: the flag turned with the arrow keys or the wheel, as on isitchristmas.com),
  // a ripple is a place, a stamp is a place and a flag
  if (m.t === 'cursor' && Number.isFinite(m.x) && Number.isFinite(m.y)) {
    const c = { t: 'cursor', x: unit(m.x), y: unit(m.y) };
    if (FLAG.test(m.flag)) c.flag = m.flag;
    if (Number.isInteger(m.a) && m.a % 15 === 0 && Math.abs(m.a) <= 360) c.a = m.a;
    return c;
  }
  if (m.t === 'ripple' && Number.isFinite(m.x) && Number.isFinite(m.y)) return { t: 'ripple', x: unit(m.x), y: unit(m.y) };
  if (m.t === 'stamp' && Number.isFinite(m.x) && Number.isFinite(m.y) && FLAG.test(m.flag)) return { t: 'stamp', x: unit(m.x), y: unit(m.y), flag: m.flag };
  if (m.t === 'summon' && typeof m.ask === 'string') { const ask = m.ask.trim(); if (ask && ask.length <= ASK_MAX) return typeof m.k === 'string' && TOKEN.test(m.k) ? { t: 'summon', ask, k: m.k } : { t: 'summon', ask }; }
  if (m.t === 'move' && typeof m.key === 'string' && KEY.test(m.key) && Number.isFinite(m.x) && Number.isFinite(m.y)) return { t: 'move', key: m.key, x: unit(m.x), y: unit(m.y) };
  if (m.t === 'text' && typeof m.key === 'string' && KEY.test(m.key) && typeof m.text === 'string') return { t: 'text', key: m.key, text: m.text.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, TEXT_MAX) };
  if (m.t === 'drop' && typeof m.key === 'string' && KEY.test(m.key)) return { t: 'drop', key: m.key };
  if (m.t === 'sync' && typeof m.key === 'string' && KEY.test(m.key)) { const data = cleanData(m.data); return data ? { t: 'sync', key: m.key, data } : null; }
  return null;
}

// What a sync carries (asked by Verse, 2026-10-16: the whole stage across tabs, not only movement): one of a list's entries (at most 8,
// 40 characters each, ticked or not), a timer's state (running or not, milliseconds left, at most a day), or a counter's number.
// Anything else in `data` is dropped, and a drop names a thing by the same key a move does.
export function cleanData(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const plain = (t) => String(t).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (Array.isArray(d.items)) {
    const items = d.items.slice(0, 8).filter((x) => Array.isArray(x) && typeof x[0] === 'string' && plain(x[0])).map((x) => [plain(x[0]), x[1] ? 1 : 0]);
    return { items };
  }
  if (d.timer && typeof d.timer === 'object' && Number.isFinite(d.timer.left)) return { timer: { run: d.timer.run ? 1 : 0, left: Math.min(86400000, Math.max(0, Math.round(d.timer.left))) } };
  if (Number.isFinite(d.value)) return { value: Math.min(1e9, Math.max(-1e9, Math.round(d.value))) };
  return null;
}

export class Room {
  constructor({ max = MAX_PEERS, rate = RATE, crowd = false } = {}) { this.max = max; this.rate = rate; this.crowd = crowd; this.peers = new Map(); this.n = 0; }
  /** a room for a public name: its size, and only the crowd's moves pass; null when the name is not a public room. */
  static forPublic(name) { const c = publicRoom(name); return c ? new Room({ max: c.max, crowd: true }) : null; }
  get size() { return this.peers.size; }
  join(send) {
    if (this.peers.size >= this.max) return null;
    const id = 'p' + (++this.n);
    const others = [...this.peers.keys()];
    this.peers.set(id, { send, second: 0, count: 0 });
    send({ t: 'hello', you: id, peers: others });
    this.tell(id, { t: 'join', id });
    return id;
  }
  // relays one message from a tab to the others; returns how many it reached (0 when dropped)
  message(id, raw, now = Date.now()) {
    const p = this.peers.get(id);
    if (!p) return 0;
    const second = Math.floor(now / 1000);
    if (second !== p.second) { p.second = second; p.count = 0; }
    if (++p.count > this.rate) return 0;
    const m = clean(raw);
    if (!m || (this.crowd && !CROWD.has(m.t))) return 0; // a public room passes the crowd's moves only
    return this.tell(id, { ...m, from: id });
  }
  leave(id) { if (this.peers.delete(id)) this.tell(id, { t: 'left', id }); }
  tell(from, msg) {
    let n = 0;
    for (const [id, p] of this.peers) if (id !== from) { try { p.send(msg); n++; } catch (_) {} }
    return n;
  }
}
