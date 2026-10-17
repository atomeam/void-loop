// A tab left open while a new version deployed keeps running the page code it loaded (owner, 2026-10-17: "nothing showed just now"; asked by Owner).
// The build id is a hash of skills/index.json, the file every deploy that adds or reorders a skill changes and the page already fetches; the tab keeps the id it
// loaded with and compares again when it regains focus and about every ten minutes. Different: one small "tap to reload" line, never an automatic reload.
// Pure functions here; the wiring is in void.html. Tests: tools/stale-tab.test.mjs.

export const CHECK_MS = 10 * 60 * 1000;
export const NOTICE = 'A newer V01D is ready — tap to reload';

/** a short stable id for a text (FNV-1a, 32 bits, hex); '' for no text. Pure. */
export function buildId(text) {
  const s = String(text == null ? '' : text); if (!s) return '';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** true when both ids are known and differ: an unreadable check (empty) never raises the notice. Pure. */
export const isStale = (loaded, now) => !!loaded && !!now && loaded !== now;

/** whether a check is due: the interval has passed since the last one. Pure. */
export const checkDue = (last, now, every = CHECK_MS) => !Number.isFinite(last) || now - last >= every;
