// A tab left open while a new version deployed keeps running the page code it loaded (owner, 2026-10-17: "nothing showed just now"; asked by Owner).
// The build id is the commit the deploy writes to /build.json (else the page's ETag); the tab keeps the id it
// loaded with and compares again when it regains focus and about every ten minutes. Different: one small "tap to reload" line, never an automatic reload.
// Pure functions here; the wiring is in void.html. Tests: tools/stale-tab.test.mjs.

export const CHECK_MS = 10 * 60 * 1000;
export const NOTICE = 'A newer V01D is ready — tap to reload';

/** this deploy's id, from what one tiny request reads: the commit the deploy wrote to /build.json (changes on every deploy, page or skill code or neither), else the
 *  page's own ETag or Last-Modified (changes when the page itself does); '' when neither is there, which never raises the notice. Pure. */
export function idOf(build, etag) {
  const b = build && typeof build.id === 'string' ? build.id.trim() : '';
  if (b) return 'b:' + b;
  const e = String(etag == null ? '' : etag).trim();
  return e ? 'e:' + e : '';
}

/** true when both ids are known and differ: an unreadable check (empty) never raises the notice. Pure. */
export const isStale = (loaded, now) => !!loaded && !!now && loaded !== now;

/** whether a check is due: the interval has passed since the last one. Pure. */
export const checkDue = (last, now, every = CHECK_MS) => !Number.isFinite(last) || now - last >= every;
