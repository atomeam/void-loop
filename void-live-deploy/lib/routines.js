// routines — the pure half of frontier #13's first piece: "call this my morning" keeps the last few asks as a named routine in
// this browser, and "my morning" runs them again, in order. A routine is only asks Verse already answers, so it can never do
// more than typing them would. Nothing leaves the browser: no account, no server, no tracking; the list of recent asks is the
// one the ask box already keeps for its hints (a2m.void.asks.v1).
export const KEY = 'a2m.void.routines.v1', ASKS_KEY = 'a2m.void.asks.v1';
export const MAX_ASKS = 4, MAX_ROUTINES = 20, DEFAULT_COUNT = 3;

const clean = (t) => String(t || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const nameOf = (n) => n.replace(/\s+routine$/, '').trim();
const NAME = '([a-z][a-z0-9\' -]{1,30}?)';
const NUM = { one: 1, two: 2, three: 3, four: 4 };

/** the routine ask, or null: save / run (only a routine that exists) / list / forget */
export function routineAsk(text, saved = {}) {
  const t = clean(text);
  let m = new RegExp('^(?:call|name|save|keep) (?:this|that|these|those|them)(?: as)? my ' + NAME + '$').exec(t);
  if (m) return { kind: 'save', name: nameOf(m[1]), count: null };
  m = new RegExp('^(?:save|keep) (?:the )?last (\\d|one|two|three|four) (?:asks?|things?|questions?) as my ' + NAME + '$').exec(t);
  if (m) return { kind: 'save', name: nameOf(m[2]), count: Number(m[1]) || NUM[m[1]] };
  if (/^(?:my|show my|list my) routines$/.test(t)) return { kind: 'list' };
  m = new RegExp('^(?:forget|delete|remove) my ' + NAME + '$').exec(t);
  if (m && saved && Object.prototype.hasOwnProperty.call(saved, nameOf(m[1]))) return { kind: 'forget', name: nameOf(m[1]) };
  m = new RegExp('^(?:(?:run|do|start|play) )?my ' + NAME + '$').exec(t);
  if (m && saved && Object.prototype.hasOwnProperty.call(saved, nameOf(m[1]))) return { kind: 'run', name: nameOf(m[1]) };
  return null;
}

/** the asks a save keeps: the ones before it (recent is newest first), never a routine ask, oldest first, at most a few */
export function pick(recent, count) {
  const n = Math.max(1, Math.min(MAX_ASKS, count || DEFAULT_COUNT));
  const keep = (recent || []).filter((a) => typeof a === 'string' && a.trim() && !routineAsk(a, null) && !/^(?:my|run my|do my) /i.test(a.trim()) && !/^unlock\b/i.test(a.trim()));
  return keep.slice(0, n).reverse();
}

export function load(ls) {
  try { const v = JSON.parse((ls && ls.getItem(KEY)) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (_) { return {}; }
}
export function save(ls, name, asks, day) {
  const all = load(ls); all[name] = { asks: asks.slice(0, MAX_ASKS).map((a) => String(a).slice(0, 240)), saved: day };
  const names = Object.keys(all); if (names.length > MAX_ROUTINES) delete all[names[0]];
  try { ls.setItem(KEY, JSON.stringify(all)); } catch (_) {}
  return all[name];
}
export function remove(ls, name) {
  const all = load(ls); delete all[name];
  try { ls.setItem(KEY, JSON.stringify(all)); } catch (_) {}
}
export function recentAsks(ls) {
  try { const v = JSON.parse((ls && ls.getItem(ASKS_KEY)) || '[]'); return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []; } catch (_) { return []; }
}
