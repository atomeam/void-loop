// Where a game's panel and the cards around it go (owner, 2026-10-18: the chess steps were cut off after step 3 and a list card sat
// under the game's panel). Pure: numbers and rectangles in, a plan out, so the stage code only applies it.
//   fitPanel({ top, content, floor })   the top and the max height for a panel that holds `content` px, so it ends above `floor`
//                                       (the ask bar's top, same coordinates as top) and still shows all it can; the rest scrolls.
//   settleAround(loose, blockers, area) the cards a game now covers: each goes to the nearest clear spot, or, with none, is tucked
//                                       into the tray. Nothing is dropped; `loose` is [{ id, x, y, w, h }], `blockers` [{ x, y, w, h }].
//   restorePlan(items, others, area)    when the game closes: each card back to the spot it was pushed from, when that spot is clear.
import { clearSpot, overlaps } from './placement.js';

export const MARGIN = 12, MIN_TOP = 8, MIN_H = 120;

/** { top, maxHeight, scrolls }: the panel never ends under `floor`, it takes the room it needs, and scrolls only when the room is short. */
export function fitPanel({ top = 0, content = 0, floor = 0, margin = MARGIN, minTop = MIN_TOP, minH = MIN_H } = {}) {
  const room = floor - margin;                                   // the lowest y the panel may reach
  const avail = Math.max(minH, room - minTop);                   // the tallest it can ever be
  const want = Math.max(1, Math.min(content > 0 ? content : avail, avail));
  const t = Math.min(Math.max(top, minTop), Math.max(minTop, room - want)); // slides up when it would run under the bar
  const maxHeight = Math.max(60, Math.floor(room - t));
  return { top: Math.round(t), maxHeight, scrolls: content > maxHeight + 1 };
}

const box = (c) => ({ x: c.x, y: c.y, w: c.w, h: c.h });
/** { moves: { id: { x, y } }, tuck: [id] } for the loose cards that touch a blocker (a game's board and panel, the ask bar). */
export function settleAround(loose, blockers, area, opts = {}) {
  const gap = opts.gap ?? 12, moves = {}, tuck = [];
  const hits = (c, list) => list.some((o) => overlaps(box(c), o, gap));
  const staying = (loose || []).filter((c) => c && c.w > 0 && c.h > 0 && !hits(c, blockers));
  const placed = staying.map(box);
  for (const c of (loose || [])) {
    if (!c || !(c.w > 0 && c.h > 0) || staying.includes(c)) continue;
    const p = clearSpot({ w: c.w, h: c.h }, [...blockers, ...placed], area, { x: c.x, y: c.y }, { gap });
    if (p) { moves[c.id] = p; placed.push({ x: p.x, y: p.y, w: c.w, h: c.h }); } else tuck.push(c.id);
  }
  return { moves, tuck };
}

/** Back to where they were: { id: { x, y } } for each item whose `prior` spot is clear of `others` (and of each other). */
export function restorePlan(items, others, area, opts = {}) {
  const gap = opts.gap ?? 12, out = {}, placed = (others || []).map(box);
  for (const c of items || []) {
    if (!c || !c.prior || !(c.w > 0 && c.h > 0)) continue;
    const r = { x: c.prior.x, y: c.prior.y, w: c.w, h: c.h };
    if (r.x + r.w > (area.w || Infinity) + 1 || r.y + r.h > (area.h || Infinity) + 1) continue;
    if (placed.some((o) => overlaps(r, o, gap))) continue;
    out[c.id] = { x: r.x, y: r.y }; placed.push(r);
  }
  return out;
}
