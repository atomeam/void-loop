// A ticket for Verse's coding agent's brain (functions/api/agent-brain.js, tools/verse-agent.mjs): the narrowest key that lets the agent's run reach
// the site's own Workers AI binding. The agent runs code a model wrote, so it never holds the owner key; a step of the workflow that runs no model code
// mints this from the owner key and hands it over as a file. A stolen ticket opens one route (the agent's free models, under that route's daily cap)
// for at most three hours, and nothing else: ownerOk (lib/guard.js) never accepts it.
// Form: vt1.<expiry, unix seconds>.<run id>.<HMAC-SHA256 of "agent-brain|<expiry>|<run id>" keyed by the owner key, base64url>. WebCrypto only.
const enc = new TextEncoder();
export const TICKET_PREFIX = 'vt1.';
export const MAX_TICKET_MS = 3 * 3600e3;
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => { const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const keyOf = (secret) => crypto.subtle.importKey('raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const runOf = (run) => String(run || '').replace(/[^\w-]/g, '').slice(0, 40) || 'run';

/** a ticket for this run, good for `ttl` ms (at most three hours). */
export async function mintTicket(secret, run, now = Date.now(), ttl = 2 * 3600e3) {
  if (!secret) throw new Error('no owner key to mint a ticket from');
  const exp = Math.floor((now + Math.max(60e3, Math.min(ttl, MAX_TICKET_MS))) / 1000), r = runOf(run);
  const sig = await crypto.subtle.sign('HMAC', await keyOf(secret), enc.encode('agent-brain|' + exp + '|' + r));
  return TICKET_PREFIX + exp + '.' + r + '.' + b64u(sig);
}
/** { ok, run } for a ticket made from this owner key, not expired and not longer than three hours from now; constant-time on the signature. */
export async function ticketOk(ticket, secret, now = Date.now()) {
  try {
    const m = /^vt1\.(\d{9,11})\.([\w-]{1,40})\.([A-Za-z0-9_-]{40,50})$/.exec(String(ticket || ''));
    if (!m || !secret) return { ok: false };
    const exp = +m[1];
    if (exp * 1000 <= now || exp * 1000 > now + MAX_TICKET_MS + 60e3) return { ok: false };
    const good = await crypto.subtle.verify('HMAC', await keyOf(secret), unb64u(m[3]), enc.encode('agent-brain|' + exp + '|' + m[2]));
    return good ? { ok: true, run: m[2] } : { ok: false };
  } catch (_) { return { ok: false }; }
}
