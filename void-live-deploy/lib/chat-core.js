// Verse's chat (/chat/, the WhatsApp Web floor), the pure half: the key, the room it names, sealing and opening a message, and what a message may be.
// End to end in the browser: a chat is one random 256-bit AES-GCM key. It lives in the invite link's fragment (#k=...), which a browser never sends to a
// server, and in the browsers of the people who opened that link. The relay (functions/api/chat.js) only ever sees the room, a SHA-256 of the key cut to
// 32 hex characters, and sealed bytes: who wrote, what, and every picture are inside the seal. Shared by lib/chat-ui.js and functions/api/chat.js;
// tests in tools/chat.test.mjs (round trips, a wrong key, a changed byte, the shapes).
export const LIMITS = Object.freeze({ text: 4000, name: 40, title: 60, sealed: 8000, blob: 200000, img: 140000, imgPx: 1280 /* img: the picture's data URL in characters, so its seal stays under blob */, keep: 400 });
export const KEY_RE = /^[A-Za-z0-9_-]{43}$/, ROOM_RE = /^[0-9a-f]{32}$/, SEALED_RE = /^[A-Za-z0-9_-]+$/;
const enc = new TextEncoder(), dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

/** bytes to base64url without padding. Pure. */
export function b64u(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** base64url to bytes, or null when it is not base64url. Pure. */
export function unb64u(s) {
  if (typeof s !== 'string' || !SEALED_RE.test(s)) return null;
  try { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; } catch (_) { return null; }
}
/** a new chat key: 32 random bytes as 43 base64url characters. */
export const newKey = () => b64u(globalThis.crypto.getRandomValues(new Uint8Array(32)));
export const keyOk = (k) => typeof k === 'string' && KEY_RE.test(k);
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
/** the room a key names: what the relay sees instead of the key (SHA-256 of a label and the key, 32 hex). The key cannot be had back from it. */
export async function roomOf(key) {
  if (!keyOk(key)) throw new Error('not a chat key');
  return hex(await subtle().digest('SHA-256', enc.encode('verse-chat-room|' + key))).slice(0, 32);
}
const cryptoKey = (key) => subtle().importKey('raw', unb64u(key), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
/** a message sealed with the chat key: base64url of a fresh 12-byte IV and the AES-GCM ciphertext (which carries its own 16-byte tag). */
export async function seal(key, obj) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode('verse-chat-v1') }, await cryptoKey(key), enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return b64u(out);
}
/** a sealed message opened with the key and checked (clean below), or null: a wrong key, a changed byte, or a shape that is not a message. */
export async function open(key, sealed) {
  const b = unb64u(sealed); if (!b || b.length < 29) return null;
  try { const pt = await subtle().decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12), additionalData: enc.encode('verse-chat-v1') }, await cryptoKey(key), b.subarray(12)); return clean(JSON.parse(dec.decode(pt))); } catch (_) { return null; }
}

const ID_RE = /^[A-Za-z0-9_-]{6,24}$/;
const line = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const text = (s, n) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f‪-‮⁦-⁩]/g, '').replace(/\n{4,}/g, '\n\n\n').slice(0, n);
const IMG_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
/** what a message may be once opened, or null: a text (with the id of the message it answers), a picture (a JPEG, PNG or WebP data URL under the cap
 *  and a caption), a read receipt (up to which number), the chat's name, and a call's signal (an offer, an answer, an end). Even sealed by a member,
 *  anything else is dropped. Pure. */
export function clean(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || !ID_RE.test(m.from || '')) return null;
  const base = { t: m.t, ...(ID_RE.test(m.id || '') ? { id: m.id } : {}), from: m.from, name: line(m.name, LIMITS.name) || 'Someone', at: Number.isFinite(m.at) ? Math.round(m.at) : 0 };
  if (m.t === 'msg') { const t = text(m.text, LIMITS.text); if (!t.trim() || !ID_RE.test(m.id || '')) return null; return { ...base, text: t, ...(ID_RE.test(m.re || '') ? { re: m.re } : {}) }; }
  if (m.t === 'img') { if (!ID_RE.test(m.id || '') || typeof m.data !== 'string' || m.data.length > LIMITS.img || !IMG_RE.test(m.data)) return null; return { ...base, data: m.data, w: Math.max(0, Math.min(8000, m.w | 0)), h: Math.max(0, Math.min(8000, m.h | 0)), cap: line(m.cap, 200) }; }
  if (m.t === 'read') { const n = Number(m.upTo); return Number.isInteger(n) && n > 0 ? { ...base, upTo: n } : null; }
  if (m.t === 'title') { const t = line(m.title, LIMITS.title); return t ? { ...base, title: t } : null; }
  if (m.t === 'join') return base;
  if (m.t === 'call') {
    if (!['offer', 'answer', 'end', 'busy'].includes(m.kind) || !ID_RE.test(m.cid || '')) return null;
    const sdp = typeof m.sdp === 'string' && m.sdp.length < 6000 && /^v=0/.test(m.sdp) ? m.sdp : '';
    if ((m.kind === 'offer' || m.kind === 'answer') && !sdp) return null;
    return { ...base, kind: m.kind, cid: m.cid, video: !!m.video, ...(sdp ? { sdp } : {}), ...(ID_RE.test(m.to || '') ? { to: m.to } : {}) };
  }
  return null;
}

/** the key (and the chat's name, if the link carries one) in an invite link's fragment, or null. Pure. */
export function fromHash(hash) {
  const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const k = p.get('k'); return keyOk(k) ? { key: k, title: line(p.get('n'), LIMITS.title) } : null;
}
/** the invite link: the page, then the key in the fragment (never sent to a server), and the chat's name if it has one. Pure. */
export const linkOf = (origin, key, title = '') => origin + '/chat/#k=' + key + (title ? '&n=' + encodeURIComponent(title) : '');
/** a short random id (a device, a message, a call). */
export const newId = (n = 12) => b64u(globalThis.crypto.getRandomValues(new Uint8Array(n))).slice(0, 16);

/** who has read each of my messages: { [seq]: [names] } from the read receipts in a chat's log (the latest from each member counts). Pure. */
export function readers(log, me) {
  const upTo = new Map();
  for (const m of log) if (m.t === 'read' && m.from !== me) { const p = upTo.get(m.from); if (!p || m.upTo > p.upTo) upTo.set(m.from, { upTo: m.upTo, name: m.name }); }
  const out = {};
  for (const m of log) if ((m.t === 'msg' || m.t === 'img') && m.from === me && m.s) out[m.s] = [...upTo.values()].filter((r) => r.upTo >= m.s).map((r) => r.name);
  return out;
}
/** the members a chat's log shows: [{ id, name, last }], newest name kept. Pure. */
export function members(log) {
  const by = new Map();
  for (const m of log) if (m.from) by.set(m.from, { id: m.from, name: m.name, last: Math.max((by.get(m.from) || {}).last || 0, m.at || 0) });
  return [...by.values()];
}
/** the chat's name: the latest title message, else the one the link carried, else the members' names. Pure. */
export function titleOf(chat, me) {
  const t = [...(chat.log || [])].reverse().find((m) => m.t === 'title');
  if (t) return t.title; if (chat.title) return chat.title;
  const others = members(chat.log || []).filter((x) => x.id !== me).map((x) => x.name);
  return others.length ? others.slice(0, 3).join(', ') : '';
}
/** the messages search finds in every chat kept on this device: [{ room, m }], words in any order, case and accents ignored. Pure. */
export function searchChats(chats, q) {
  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = fold(q).split(/\s+/).filter(Boolean); if (!words.length) return [];
  const out = [];
  for (const [room, c] of Object.entries(chats || {})) for (const m of c.log || []) if (m.t === 'msg' || (m.t === 'img' && m.cap)) { const t = fold(m.text || m.cap); if (words.every((w) => t.includes(w))) out.push({ room, m }); }
  return out.sort((a, b) => (b.m.at || 0) - (a.m.at || 0)).slice(0, 100);
}
