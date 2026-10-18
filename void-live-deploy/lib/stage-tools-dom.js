// The browser half of the stage tools (owner, 2026-10-18; "tools pack 4"): what the three skills stage-arrange, stage-style and stage-organize
// share to read and move things on the live stage. The pure half (asks, geometry, diffs) is lib/stage-tools.js, unit-tested in node.
import { resolveWho } from './stage-tools.js';

/** the ids picked together by "select all clocks" and friends; in memory only (a reload starts with nothing picked) */
export const multi = new Set();

export const read = (key, dflt) => { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? dflt : v; } catch (_) { return dflt; } };
export const write = (key, val) => { try { const s = JSON.stringify(val); if (s.length > 900000) return false; localStorage.setItem(key, s); return true; } catch (_) { return false; } };

export const STAGE_KEY = 'a2m.void.state.v1';

/** the stage's things now, the multi-selection with the gone ones dropped, and the single pick */
export function ctxOf(api) {
  const things = api.stage.things();
  for (const id of [...multi]) if (!things[id]) multi.delete(id);
  return { things, multi: [...multi], selected: api.stage.selected() };
}
/** ids a who names (see resolveWho); `{ none }` with nothing picked is everything unless `needPick`, then []. */
export function targets(api, who, needPick = false, ignorePick = false) {
  const c = ctxOf(api);
  if (ignorePick && (!who || who.none)) c.selected = null; // arranging: the picked card is just the last one made, so no selection means every card
  if (needPick && (!who || who.none) && !c.multi.length && !(c.selected && c.things[c.selected])) return [];
  return resolveWho(who, c);
}
export const elOf = (api, id) => api.stage.stage.querySelector(':scope > [data-id="' + CSS.escape(id) + '"]');

/** each target as a box { id, x, y, w, h } from where the card is drawn */
export function boxesOf(api, ids) {
  const things = api.stage.things(), out = [];
  for (const id of ids) {
    const t = things[id], el = elOf(api, id);
    if (!t || !el || !Number.isFinite(+t.x) || !Number.isFinite(+t.y)) continue;
    out.push({ id, x: +t.x, y: +t.y, w: el.offsetWidth || 0, h: el.offsetHeight || 0 });
  }
  return out;
}
/** move things to { id: {x, y} }; a thing put there by this is pinned (the stage never moves it again) */
export function moveTo(api, positions) {
  const things = api.stage.things(); let n = 0;
  for (const [id, p] of Object.entries(positions || {})) { const t = things[id]; if (!t) continue; t.x = p.x; t.y = p.y; t.pinned = true; n++; }
  if (n) { api.stage.save(); api.stage.render(); }
  return n;
}
export const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
/** the stage's own room, { w, h } */
export const boundsOf = (api) => ({ w: api.stage.stage.clientWidth || 800, h: api.stage.stage.clientHeight || 600 });
/** run `fn` once the page's DOM is there */
export function whenReady(fn) {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true }); else fn();
}
