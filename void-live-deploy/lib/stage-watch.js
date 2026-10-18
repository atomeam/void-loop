// Tools pack 5: the stage watched between redraws (browser only). Every redraw calls the skills' `decorate` hook; this notices what
// was added, edited or taken off since the last look, keeps the last 20 taken off in a pile (to put back), and a day's change log.
// Both live in this browser's localStorage only; nothing is sent anywhere. The first look is a baseline, it logs nothing.
import { diffStage, logChanges, pushPile, thingLabel, sigOf } from './stage-find.js';

export const PILE_KEY = 'a2m.void.pile.v1', CHANGES_KEY = 'a2m.void.changes.v1', BOOKMARKS_KEY = 'a2m.void.bookmarks.v1';

export function readJson(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (_) { return fallback; }
}
export function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
}

let prev = null, last = new Map(), timer = 0, apiRef = null;
// the stage as it was saved when this page loaded: the first look compares against it, so a thing made by the very first ask is an add
let seed = null;
try { const raw = localStorage.getItem('a2m.void.state.v1'); seed = raw ? JSON.parse(raw) : {}; } catch (_) { seed = null; }

/** one look at the stage now: record what changed since the last look. Exported for the tests and the browser section. */
export function lookNow(stageApi) {
  const things = stageApi.things(), api = stageApi;
  if (prev === null) { // the first look: against the saved stage this page started with (or, with no way to read it, a baseline that logs nothing)
    if (!seed || typeof seed !== 'object') { prev = diffStage(new Map(), things).now; remember(things); return { added: [], removed: [], changed: [] }; }
    prev = diffStage(new Map(), seed).now; remember(seed);
  }
  const d = diffStage(prev, things);
  prev = d.now;
  const entries = [], at = Date.now();
  let pile = null;
  for (const id of d.added) entries.push({ op: 'add', id, kind: things[id].kind, label: thingLabel(things[id]) });
  for (const id of d.changed) entries.push({ op: 'change', id, kind: things[id].kind, label: thingLabel(things[id]) });
  for (const id of d.removed) {
    const th = last.get(id);
    if (!th) continue;
    entries.push({ op: 'remove', id, kind: th.kind, label: thingLabel(th) });
    pile = pushPile(pile || readJson(PILE_KEY, []), th, at);
  }
  if (d.added.length) { // a thing that came back (undo, a restore) leaves the pile
    const cur = pile || readJson(PILE_KEY, []);
    const kept = cur.filter((e) => !(e && e.thing && d.added.includes(e.thing.id)));
    if (kept.length !== cur.length) pile = kept;
  }
  if (pile) writeJson(PILE_KEY, pile);
  if (entries.length) writeJson(CHANGES_KEY, logChanges(readJson(CHANGES_KEY, []), entries, at));
  remember(things);
  return { added: d.added, removed: d.removed, changed: d.changed, api };
}

function remember(things) {
  last = new Map();
  for (const [id, th] of Object.entries(things || {})) {
    if (!th || !th.kind) continue;
    try { last.set(id, JSON.parse(JSON.stringify(th))); } catch (_) { /* a thing that will not serialize is not kept */ }
  }
}

/** called from a skill's decorate: look once the redraw settles (a drag redraws many times a second). Idempotent. */
export function watchStage(stageApi) {
  apiRef = stageApi;
  if (prev === null) { lookNow(stageApi); return; } // the first look is taken at once
  clearTimeout(timer);
  timer = setTimeout(() => { try { lookNow(apiRef); } catch (_) { /* never break a redraw */ } }, 250);
}

/** look right now instead of after the redraw settles: an ask about the pile or the day's changes must see what was just dismissed. */
export function flush(stageApi) { clearTimeout(timer); try { return lookNow(stageApi); } catch (_) { return null; } }

/** reset for tests */
export function _reset(savedState = null) { prev = null; last = new Map(); clearTimeout(timer); seed = savedState; }
export { sigOf };
