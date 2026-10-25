// Comments under a published generator and under /image/ (owner, 2026-10-25: perchance's comments plugin), the rules shared by the route
// (functions/api/comments.js) and the widget (lib/comments-ui.js). Pure but for the HMAC helpers, which use WebCrypto. Tests: tools/comments.test.mjs.
import { SEXUAL, HATE } from './art-rules.js';

export const NAME_MAX = 30, TEXT_MAX = 500, THREAD_RE = /^(?:gen:[a-z2-7]{8}|image|forum:[a-z2-7]{10})$/, TITLE_MAX = 80, ID_RE = /^[a-z2-7]{10}$/, CHECK_MIN_MS = 3000, CHECK_MAX_MS = 864e5;
const line = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, max);
export const cleanName = (v) => line(v, NAME_MAX).replace(/[<>]/g, '') || 'Anonymous';
export const cleanText = (v) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, TEXT_MAX);
const LINK = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|net|org|io|ru|xyz|top|info|biz|click|link|shop|site|online|app|me|co)\b/i;
/** why a comment is not kept: '' or a plain sentence. `secret` is the route's key-shape check. Pure. */
export function commentProblem(name, text, secret = () => false) {
  if (!text) return 'write something first';
  const lo = (name + ' ' + text).toLowerCase();
  if (SEXUAL.test(lo) || HATE.test(lo)) return 'that is not something to post here';
  if (LINK.test(text) || LINK.test(name)) return 'links are not allowed in comments';
  if (secret(name) || secret(text)) return 'that looks like a key or a password; take it out first';
  if (/(.)\1{14,}/.test(text)) return 'that looks like noise';
  return '';
}
// the bot check: a small sum. The question comes from a random nonce; the token signs the day, the nonce, when it was given and the answer, with
// the SALT secret, so a page cannot make its own, and a post sent less than 3 seconds after the question was given is refused (no person is that quick).
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sign(salt, s) { const k = await crypto.subtle.importKey('raw', enc.encode('void-comments:' + salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(s))).slice(0, 22); }
export const sumOf = (nonce) => { const n = parseInt(String(nonce).slice(0, 6), 36) || 0; return [n % 9 + 1, Math.floor(n / 9) % 9 + 1]; };
/** a new check: { q: 'What is 3 + 4?', token }. */
export async function newCheck(salt, now = Date.now(), nonce = Math.random().toString(36).slice(2, 10)) {
  const [a, b] = sumOf(nonce), t = now.toString(36);
  return { q: 'What is ' + a + ' + ' + b + '?', token: nonce + '.' + t + '.' + await sign(salt, nonce + '|' + t + '|' + (a + b)) };
}
/** '' when the answer and token pass, else why not. */
export async function checkOk(salt, token, answer, now = Date.now()) {
  const m = /^([a-z0-9]{4,12})\.([a-z0-9]{6,12})\.([A-Za-z0-9_-]{22})$/.exec(String(token || '')); if (!m) return 'the check is missing; reload the page';
  const at = parseInt(m[2], 36), age = now - at;
  if (!(age >= CHECK_MIN_MS)) return 'a moment: that was quicker than a person types';
  if (age > CHECK_MAX_MS) return 'the check is old; reload the page';
  const n = parseInt(String(answer || '').trim(), 10); if (!Number.isFinite(n)) return 'answer the sum first';
  return (await sign(salt, m[1] + '|' + m[2] + '|' + n)) === m[3] ? '' : 'that is not the answer to the sum';
}
