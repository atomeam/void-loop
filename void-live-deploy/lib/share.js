// Bring someone into your Void (frontier #11, plan item 10 the live half): the room one invite opens.
// An invite is a room name nobody can guess (random, signed with the site's SALT), so a stranger cannot wake a Durable
// Object for a name they made up. In the room only two things pass: where your cursor is (a faint presence on the other
// screens) and a summon (the words that put something on your stage, run again on theirs). Nothing else rides along, and
// each tab is held to RATE messages a second. Used by share-worker/index.js (the Durable Object), functions/api/share/
// and the page; tested in tools/share.test.mjs.
export const MAX_PEERS = 4, RATE = 40, MAX_MSG = 600, ASK_MAX = 120;
const B64U = /^[A-Za-z0-9_-]{16}$/;
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

// what may pass: a cursor (0..1 of the screen) or a summon (the words, trimmed); anything else is null
export function clean(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_MSG) return null;
  let m; try { m = JSON.parse(raw); } catch (_) { return null; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const unit = (v) => Math.min(1, Math.max(0, v));
  if (m.t === 'cursor' && Number.isFinite(m.x) && Number.isFinite(m.y)) return { t: 'cursor', x: unit(m.x), y: unit(m.y) };
  if (m.t === 'summon' && typeof m.ask === 'string') { const ask = m.ask.trim(); if (ask && ask.length <= ASK_MAX) return { t: 'summon', ask }; }
  return null;
}

export class Room {
  constructor({ max = MAX_PEERS, rate = RATE } = {}) { this.max = max; this.rate = rate; this.peers = new Map(); this.n = 0; }
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
    return m ? this.tell(id, { ...m, from: id }) : 0;
  }
  leave(id) { if (this.peers.delete(id)) this.tell(id, { t: 'left', id }); }
  tell(from, msg) {
    let n = 0;
    for (const [id, p] of this.peers) if (id !== from) { try { p.send(msg); n++; } catch (_) {} }
    return n;
  }
}
