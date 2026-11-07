// The members-only pages and the signed cookie the gate reads (functions/_middleware.js).
// The pages are the nav's own list (lib/verse-shell.js NAV), so a new nav item is gated by adding it here:
// Ask (/), Crew, Drones, Envoy, Tower, Holovids, Out Loud, Hoard, Starboard, Star Chart, Shields, Event Horizon, Assimilate.
// A non-member is sent to /join/, the public offer page; a member carries a signed, HttpOnly verse_session cookie:
// { v: 1, k: 'team' | 'acct' | 'owner', id, name, until, exp }. The cookie is a claim; memberOk re-reads D1 every request, so a
// membership the owner removed, or a $1 trial that ended, stops at once. Nothing secret is in the cookie: only its HMAC is a key.
import { TRIAL_MS } from './team.js';

export const COOKIE = 'verse_session';
export const SESSION_DAYS = 30;
export const SESSION_MS = SESSION_DAYS * 864e5;
export { TRIAL_MS };

const GATED = [
  '/', '/index.html', '/void.html',
  '/team/', '/bots/', '/agent/', '/conquered/', '/tower/', '/tower',
  '/films/', '/podcast/', '/treasury/', '/starboard/', '/scoreboard/', '/security/', '/limits/', '/contribute/',
];
// the ways in, and what a gated page loads: never behind the gate, or the offer and its form cannot render
const OPEN = ['/join/', '/members/', '/store/', '/team/join/', '/team/mcp', '/team/agents.txt', '/team/agent.mjs', '/api/', '/sw.js', '/.well-known/', '/robots.txt', '/sitemap.xml', '/manifest.webmanifest'];
const STATIC = ['/lib/', '/skills/', '/fonts/', '/sounds/', '/vendor/', '/og.png', '/verse.css', '/verse-shell.js', '/verse-field.js', '/favicon', '/join/'];

const under = (p, base) => p === base || p.startsWith(base.endsWith('/') ? base : base + '/');

/** true when this path is a members-only page. Pure. */
export function gatedPath(pathname) {
  const p = String(pathname || '/').replace(/\/{2,}/g, '/');
  if (p === '/' || p === '/index.html' || p === '/void.html') return true;
  if (OPEN.some((b) => under(p, b.replace(/\/$/, ''))) || STATIC.some((b) => under(p, b.replace(/\/$/, '')))) return false;
  return GATED.some((b) => b !== '/' && under(p, b.replace(/\/$/, '')));
}

const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** a signed session token: base64url(JSON payload) "." hex HMAC. Never put a key or a secret in the payload. */
export async function signSession(payload, secret) {
  if (!secret) throw new Error('no session secret');
  const body = b64u(enc.encode(JSON.stringify(payload)));
  return body + '.' + await hmac(secret, body);
}

/** the payload of a token signed with this secret and not expired, or null. */
export async function readSession(token, secret, now = Date.now()) {
  const t = String(token || '');
  if (!t || t.length > 4096 || !secret) return null;
  const [body, sig] = t.split('.');
  if (!body || !sig) return null;
  const want = await hmac(secret, body);
  let diff = want.length === sig.length ? 0 : 1;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ (sig.charCodeAt(i) || 0);
  if (diff) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
    return p && p.v === 1 && Number(p.exp) > now ? p : null;
  } catch (_) { return null; }
}

/** the verse_session value on a request, or ''. */
export function cookieValue(request, name = COOKIE) {
  const h = (request && request.headers && request.headers.get('cookie')) || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

export function sessionCookie(token, maxAge = SESSION_DAYS * 86400) {
  return COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge;
}
export function clearCookie() {
  return COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

/** the cookie's claim, checked against D1: an active member, an active $1 trial, a paid Verse account, or the owner. */
export async function memberOk(payload, env, now = Date.now()) {
  if (!payload || !env || !env.DB || !(Number(payload.exp) > now)) return false;
  try {
    if (payload.k === 'owner') return true;
    if (payload.k === 'team') {
      const a = await env.DB.prepare('SELECT role, off, until FROM void_team_agents WHERE id = ?').bind(payload.id).first();
      return !!a && a.role === 'member' && !a.off && (!a.until || Number(a.until) > now);
    }
    if (payload.k === 'acct') {
      const a = await env.DB.prepare('SELECT tier FROM void_accounts WHERE user_id = ?').bind(payload.id).first();
      return !!a && a.tier === 'paid';
    }
  } catch (_) { /* storage down: nobody gets in on a claim alone */ }
  return false;
}
