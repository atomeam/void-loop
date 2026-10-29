// A last-used date for every skill, kept on this device only (asked by Verse, twice: "Create a 'last-used' timestamp for every skill in the
// directory to identify which parts of my 135 skills are becoming dead weight", "Implement a 'last used' timestamp in the skill manifest
// to enable visibility into skill decay"). The owner's rule is no behaviour tracking, so nothing is counted on a server and nothing is
// sent: when a skill answers, the page writes the day into a small map in this browser's own storage ({ skill: 'YYYY-MM-DD' }, no words
// of any ask, one day's precision) and the family-health card reads it back for this device. A skill this device has never used reads
// "not used here yet", a skill idle 30 days or more reads as dead weight on this device. Pure apart from the storage handed in.
export const USED_KEY = 'a2m.void.used.v1';
export const DORMANT_DAYS = 30;
const NAME = /^[a-z0-9][a-z0-9-]{0,40}$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (now) => new Date(now).toISOString().slice(0, 10);

/** the map from storage text: only well-formed { skill: day } pairs; anything else is nothing. Pure. */
export function parseUsed(text) {
  let j = null; try { j = JSON.parse(text || 'null'); } catch (_) {}
  const out = {}; if (!j || typeof j !== 'object' || Array.isArray(j)) return out;
  for (const [k, v] of Object.entries(j)) if (NAME.test(k) && DAY.test(String(v))) out[k] = String(v);
  return out;
}
/** the map with `name` used on `now`'s day; the same map when nothing changes. Pure. */
export function markUsed(map, name, now = Date.now()) {
  const n = String(name || '').replace(/^skill:/, '');
  if (!NAME.test(n)) return map;
  const d = day(now); if (map[n] === d) return map;
  return { ...map, [n]: d };
}
/** write the day a skill answered into storage; never throws (storage can be absent or blocked). */
export function noteUsed(storage, name, now = Date.now()) {
  try {
    const cur = parseUsed(storage.getItem(USED_KEY)), next = markUsed(cur, name, now);
    if (next !== cur) storage.setItem(USED_KEY, JSON.stringify(next));
    return true;
  } catch (_) { return false; }
}
export function readUsed(storage) { try { return parseUsed(storage.getItem(USED_KEY)); } catch (_) { return {}; } }
/** days since a day, or null. Pure. */
export const idleDays = (at, now = Date.now()) => (DAY.test(String(at || '')) ? Math.max(0, Math.floor((Date.parse(day(now) + 'T00:00:00Z') - Date.parse(at + 'T00:00:00Z')) / 864e5)) : null);
/** one skill's line: "last used here 2026-10-16", "last used here 40 days ago (dead weight on this device)", or "not used here yet". Pure. */
export function usedWords(map, name, now = Date.now()) {
  const at = map && map[name], d = idleDays(at, now);
  if (d === null) return 'not used here yet';
  return 'last used here ' + (d === 0 ? 'today' : d === 1 ? 'yesterday' : at + ' (' + d + ' days ago)') + (d >= DORMANT_DAYS ? ', dead weight on this device' : '');
}
/** the skills this device has not used in DORMANT_DAYS or ever: { idle: [name], never: [name] }. Pure. */
export function deadWeight(names, map, now = Date.now()) {
  const idle = [], never = [];
  for (const n of names || []) { const d = idleDays(map && map[n], now); if (d === null) never.push(n); else if (d >= DORMANT_DAYS) idle.push(n); }
  return { idle, never };
}
