/**
 * showcase skill: look what I made (see main for full header).
 * Fix 2026-10-22: Done on "Recently built" writes a2m.void.recentDismissed.v1 so the 169-item tour does not reopen.
 */
export { SEEN_KEY, SHOWN_KEY, LEDGER_URL, showcaseOf, KNOWN, lineOf, hardenedLine, playable, sinceLast, whatsNew, TRAY, trayOf, dropDelta, newestAt, shownSet, markShown, VERIFIED_URL, RECENT_DAYS, start, nudge, startAll } from './showcase-core.js';
export const RECENT_DISMISS_KEY = 'a2m.void.recentDismissed.v1';
export function recentDismissedAt(store) {
  try { const s = store || (typeof localStorage !== 'undefined' ? localStorage : null); return (s && s.getItem(RECENT_DISMISS_KEY)) || ''; } catch (_) { return ''; }
}
export function dismissRecent(steps, store) {
  const newest = (steps || []).reduce((m, s) => (s && typeof s.at === 'string' && s.at > m ? s.at : m), '');
  const at = newest || new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  try { const s = store || (typeof localStorage !== 'undefined' ? localStorage : null); if (s) s.setItem(RECENT_DISMISS_KEY, at); } catch (_) {}
  return at;
}
