// Everyone's tally, the pure half (owner, 2026-10-23: the coin flip sites keep a global count, "50.1% of all flips today were Heads"; the green light:
// "the global counter for the coin-flip stats ... rate limits and a closed message list"). Shared by functions/api/tally.js (the route) and
// skills/coin.js (the line under the coin). The request carries ONLY a tally name and a value from a closed list, and a small count; the
// server returns integers. No free text exists anywhere in this feature. Playbook: docs/playbooks/open-endpoint-closed-list.md.
import { dayOf, secondsToMidnight, clientKey } from './reactions.js';
import { EMOJI_CHARS } from './emoji.js';
export { dayOf, secondsToMidnight, clientKey };

/** the closed list: tally name -> its values. Adding one is a code change and a review, never a request. */
export const TALLIES = Object.freeze({
  coin: Object.freeze(['heads', 'tails']),
  // the emoji wall (owner, 2026-10-26): a copy is counted only if the emoji is on lib/emoji.js's list, so the endpoint
  // still takes nothing but a name from a closed list and a count — no text exists in this feature
  emoji: EMOJI_CHARS,
});
export const TALLY_IDS = Object.freeze(Object.keys(TALLIES));
export const isTally = (of) => typeof of === 'string' && Object.prototype.hasOwnProperty.call(TALLIES, of);
export const isValue = (of, v) => isTally(of) && typeof v === 'string' && TALLIES[of].includes(v);

export const LIMITS = Object.freeze({
  body: 200,            // bytes: {"of":"coin","v":"heads","n":5} is about 32
  nMax: 20,             // the most one request adds (a twenty-coin flip is one request)
  perMinute: 30,        // requests per hashed client per minute
  perDay: 600,          // requests per hashed client per UTC day
  globalPerDay: 20000,  // requests per UTC day in all: the D1 write budget (about 3 writes each)
  countCap: 9999999,    // one (tally, value, day) count never goes past this
});

/** Check a request's content type and body text. Returns { ok: true, of, v, n } or { ok: false, status, error } with a fixed message
 *  (nothing from the request is ever put in an error). Unknown fields are ignored. Pure. */
export function parseTally(contentType, text) {
  if (!/^application\/json\s*(;|$)/i.test(String(contentType || ''))) return { ok: false, status: 415, error: 'send JSON' };
  const s = typeof text === 'string' ? text : '';
  if (new TextEncoder().encode(s).length > LIMITS.body) return { ok: false, status: 413, error: 'too big' };
  let b; try { b = JSON.parse(s); } catch (_) { return { ok: false, status: 400, error: 'bad request' }; }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, status: 400, error: 'bad request' };
  if (!isTally(b.of)) return { ok: false, status: 400, error: 'not a tally' };
  if (!isValue(b.of, b.v)) return { ok: false, status: 400, error: 'not a value' };
  const n = b.n === undefined ? 1 : b.n;
  if (!Number.isInteger(n) || n < 1 || n > LIMITS.nMax) return { ok: false, status: 400, error: 'bad count' };
  return { ok: true, of: b.of, v: b.v, n };
}

/** rows [{ v, day, n }] from storage -> { all: { heads, tails }, today: { heads, tails } } for EVERY value on the list, integers only,
 *  ignoring any row not on the list. Pure. */
export function countsOf(of, rows, today) {
  const all = {}, now = {};
  if (!isTally(of)) return { all, today: now };
  for (const v of TALLIES[of]) { all[v] = 0; now[v] = 0; }
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !isValue(of, r.v)) continue;
    const n = Math.floor(Number(r.n)); if (!Number.isFinite(n) || n <= 0) continue;
    all[r.v] = Math.min(all[r.v] + n, LIMITS.countCap);
    if (r.day === today) now[r.v] = Math.min(now[r.v] + n, LIMITS.countCap);
  }
  return { all, today: now };
}

/** the quiet line under the coin: "Everyone today: 51% heads of 1,204 flips · all time 50.0% of 98,311" ('' until anyone has flipped). Pure. */
export function coinLine(counts) {
  const c = counts && counts.all, t = counts && counts.today;
  const sum = (o) => (o ? (Number(o.heads) || 0) + (Number(o.tails) || 0) : 0), pct = (o, d) => ((100 * (Number(o.heads) || 0)) / sum(o)).toFixed(d);
  if (!sum(c)) return '';
  const today = sum(t) ? 'Everyone today: ' + pct(t, 0) + '% heads of ' + sum(t).toLocaleString('en') + ' flip' + (sum(t) === 1 ? '' : 's') + ' · ' : 'Everyone: ';
  return today + (sum(t) ? 'all time ' : '') + pct(c, 1) + '% heads of ' + sum(c).toLocaleString('en');
}
