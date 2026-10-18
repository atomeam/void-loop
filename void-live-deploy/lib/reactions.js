// Spectator reactions, the pure half (owner, 2026-10-18: "a fixed reaction list backed by a basic rate limit ... a strict enum of allowed reactions ...
// eliminates the risk of payload bloat, injection, or layout-breaking strings from unauthenticated users"). Shared by functions/api/react.js (the
// route) and lib/reaction-bar.js (the buttons). The request carries ONLY a reaction id and a target slug; the glyph for an id lives here, in code, so
// nothing a stranger sends is ever drawn. No free text exists anywhere in this feature. Playbook: docs/playbooks/open-endpoint-closed-list.md.

/** the closed list: id -> glyph. Adding one is a code change and a review, never a request. */
export const REACTIONS = Object.freeze({
  clap: '\u{1F44F}',
  fire: '\u{1F525}',
  wow: '\u{1F62E}',
  laugh: '\u{1F602}',
  heart: '\u{2764}\u{FE0F}',
  eyes: '\u{1F440}',
  // asked by Verse (2026-10-18): "so errors trigger a specific 'confusion' or 'pity' reaction"; shown tinted on the incident-autopsy card. 8 is the owner's ceiling.
  confused: '\u{1F615}',
  pity: '\u{1F97A}',
});
export const ERROR_REACTIONS = Object.freeze(['confused', 'pity']);
export const REACTION_IDS = Object.freeze(Object.keys(REACTIONS));
export const isReaction = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(REACTIONS, id);
/** the glyph for an id, or '' for anything not on the list. Pure. */
export const glyphOf = (id) => (isReaction(id) ? REACTIONS[id] : '');

export const TARGET_RE = /^[a-z0-9-]{1,40}$/;
/** a target is a short slug; whether it names something real is the route's second check. Pure. */
export const targetOk = (t) => typeof t === 'string' && TARGET_RE.test(t);
/** the slug of an incident in incidents.json (its `at`, prefixed so it can never equal a ledger slug), e.g. 2026-10-18T04:08:54.198Z ->
 *  incident-2026-10-18t04-08-54-198z; '' for anything that is not a date. Like a ledger slug, the route accepts it only when the site's own incidents.json has it. Pure. */
export const incidentTargetOf = (at) => { const s = typeof at === 'string' && Number.isFinite(Date.parse(at)) ? targetOf(at) : ''; return s && targetOk('incident-' + s) ? 'incident-' + s : ''; };
/** the slug of a ledger entry (void.growth.json `at`, e.g. 2026-10-18T01:40:53Z -> 2026-10-18t01-40-53z): the stage items spectators can react to. Pure. */
export const targetOf = (at) => { const s = String(at || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); return targetOk(s) ? s : ''; };

export const LIMITS = Object.freeze({
  body: 300,            // bytes: {"target":"2026-10-18t01-40-53z","reaction":"clap"} is about 60
  perMinute: 20,        // reactions per hashed client per minute
  perDay: 200,          // reactions per hashed client per UTC day
  targetPerMinute: 120, // reactions per target per minute from everyone (a botnet's ceiling per item)
  globalPerDay: 5000,   // reactions per UTC day in all: the D1 write budget (about 3 writes each)
  countCap: 99999,      // one (target, reaction) count never goes past this
  targets: 2000,        // most distinct targets ever kept (the ledger is the closed set; this is the backstop)
});

/** Check a request's content type and body text. Returns { ok: true, target, reaction } or { ok: false, status, error } with a fixed message
 *  (nothing from the request is ever put in an error). Unknown fields are ignored. Pure. */
export function parseReaction(contentType, text) {
  if (!/^application\/json\s*(;|$)/i.test(String(contentType || ''))) return { ok: false, status: 415, error: 'send JSON' };
  const s = typeof text === 'string' ? text : '';
  if (new TextEncoder().encode(s).length > LIMITS.body) return { ok: false, status: 413, error: 'too big' };
  let b; try { b = JSON.parse(s); } catch (_) { return { ok: false, status: 400, error: 'bad request' }; }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, status: 400, error: 'bad request' };
  if (!isReaction(b.reaction)) return { ok: false, status: 400, error: 'not a reaction' };
  if (!targetOk(b.target)) return { ok: false, status: 400, error: 'not a target' };
  return { ok: true, target: b.target, reaction: b.reaction };
}

/** rows [{ reaction, n }] from storage -> { clap: 0, fire: 3, ... } for EVERY id on the list, integers only, ignoring any row not on the list. Pure. */
export function countsOf(rows) {
  const out = {}; for (const id of REACTION_IDS) out[id] = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r && isReaction(r.reaction)) { const n = Math.floor(Number(r.n)); if (Number.isFinite(n) && n > 0) out[r.reaction] = Math.min(n, LIMITS.countCap); }
  }
  return out;
}

export const dayOf = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
/** seconds until the next UTC midnight (the daily limit's Retry-After), at least 1. Pure. */
export function secondsToMidnight(now = Date.now()) {
  const d = new Date(now);
  return Math.max(1, Math.ceil((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now) / 1000));
}

/** the client's rate-limit key: SHA-256 of address | UTC day | secret salt, cut to 16 hex characters. The salt is the site's SALT secret and the day is in
 *  the hash, so a key can neither be turned back into an address nor be followed to the next day. Empty when there is no salt (the route then refuses). */
export async function clientKey(ip, day, salt) {
  if (!salt) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(ip || 'unknown') + '|' + day + '|' + salt));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
