// Where a card goes on the stage so it doesn't cover another (2026-10-10: the tab card grew and a summoned countdown landed on it,
// so a person's click hit the wrong card). Pure: rectangles in, moves out, the same answer every time.
//   arrange(cards, area): cards are { id, x, y, w, h, pinned?, fresh?, grew? } in stage order.
//     - a fresh card (just summoned) keeps its spot if it's clear, else takes the nearest free spot from where it was asked to land
//     - a card that grew keeps its spot; the cards it now covers move to the nearest free spot from where they were,
//       unless they are pinned (a card the person dragged stays where they put it), and if it grew onto a pinned card, it moves
//     - everything else stays exactly where it is, overlapping or not: a saved layout is never reshuffled on load
//     - a large card (a board) that has no clear spot at its size shrinks instead (scale, top-left anchored) to the largest size
//       that fits clear; a shrunk card grows back, at the nearest spot to its home, as soon as it fits at full size again
//   cards may also carry scale (1 = full size; w and h are always the full size) and home ({ x, y }: where it stood at full size).
//   Returns { id: { x, y, scale? } } for the cards that move or change size.

export const GAP = 12, STEP = 16, EDGE = 8;
export const BIG = 400 * 300, MIN_SCALE = 0.2; // a card at least this large may shrink, never below this
const big = (c) => c.w * c.h >= BIG;
const rect = (c) => ({ x: c.x, y: c.y, w: c.w * (c.scale || 1), h: c.h * (c.scale || 1) });

const hit = (a, b, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
export function overlaps(a, b, gap = 0) { return hit(a, b, gap); }

/**
 * The nearest spot for a w x h card, from `from`, where it covers none of `others` (keeping `gap` between).
 * Candidates are a STEP grid inside the area, nearest first (ties: higher on the stage, then further left).
 * When nothing is free it takes the candidate that covers the least, so a card is never sent off the stage.
 */
export function freeSpot(size, others, area, from, opts = {}) { return spot(size, others, area, from, opts, false); }
/** The nearest spot where the card covers nothing, or null when there is none. */
export function clearSpot(size, others, area, from, opts = {}) { return spot(size, others, area, from, opts, true); }
function spot(size, others, area, from, { gap = GAP, step = STEP } = {}, strict) {
  const w = Math.max(1, size.w), h = Math.max(1, size.h);
  const maxX = Math.max(EDGE, (area.w || 0) - w - EDGE), maxY = Math.max(EDGE, (area.h || 0) - h - EDGE);
  const fx = Math.min(maxX, Math.max(EDGE, Math.round(from.x))), fy = Math.min(maxY, Math.max(EDGE, Math.round(from.y)));
  const xs = [fx], ys = [fy];
  for (let x = EDGE; x <= maxX; x += step) if (x !== fx) xs.push(x);
  for (let y = EDGE; y <= maxY; y += step) if (y !== fy) ys.push(y);
  if (!xs.includes(maxX)) xs.push(maxX);
  if (!ys.includes(maxY)) ys.push(maxY);
  const cands = [];
  for (const y of ys) for (const x of xs) cands.push({ x, y, d: (x - fx) ** 2 + (y - fy) ** 2 });
  cands.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  let best = null, bestCover = Infinity;
  for (const c of cands) {
    const r = { x: c.x, y: c.y, w, h };
    let cover = 0;
    for (const o of others) if (hit(r, o, gap)) cover += Math.max(0, Math.min(r.x + w, o.x + o.w) - Math.max(r.x, o.x)) * Math.max(0, Math.min(r.y + h, o.y + o.h) - Math.max(r.y, o.y)) + 1;
    if (cover === 0) return { x: c.x, y: c.y };
    if (cover < bestCover) { bestCover = cover; best = c; }
  }
  if (strict) return null;
  return best ? { x: best.x, y: best.y } : { x: fx, y: fy };
}
/** The largest scale (1, then down in steps of 0.05 to MIN_SCALE) at which the card has a clear spot, with that spot; or null. */
export function shrinkSpot(card, others, area, from, opts = {}) {
  for (let k = 0; ; k++) {
    const s = Math.round((1 - k * 0.05) * 100) / 100;
    if (s < MIN_SCALE) return null;
    const p = clearSpot({ w: card.w * s, h: card.h * s }, others, area, from, opts);
    if (p) return { ...p, scale: s };
  }
}

export function arrange(cards, area, opts = {}) {
  const gap = opts.gap ?? GAP;
  const list = (cards || []).filter((c) => c && c.id != null && c.w > 0 && c.h > 0).map((c) => ({ ...c, scale: c.scale > 0 && c.scale < 1 ? c.scale : 1 }));
  const touch = (a, b) => hit(rect(a), rect(b), gap);
  const grown = list.filter((c) => c.grew);
  const movable = new Set();
  for (const c of list) if (c.fresh && !c.pinned) movable.add(c.id);
  for (const g of grown) {
    for (const c of list) if (c !== g && !c.pinned && !c.grew && touch(g, c)) movable.add(c.id);
    if (!g.pinned && list.some((c) => c !== g && c.pinned && touch(g, c))) movable.add(g.id);
  }
  const placed = list.filter((c) => !movable.has(c.id)).map(rect);
  const moves = {};
  const put = (c, p) => {
    const scale = p.scale ?? c.scale;
    if (p.x !== c.x || p.y !== c.y || scale !== c.scale) { moves[c.id] = scale === 1 && c.scale === 1 ? { x: p.x, y: p.y } : { x: p.x, y: p.y, scale }; c.x = p.x; c.y = p.y; c.scale = scale; }
  };
  for (const c of list) {
    if (!movable.has(c.id)) continue;
    if (placed.some((o) => hit(rect(c), o, gap))) {
      const from = { x: c.x, y: c.y }, clear = clearSpot({ w: c.w, h: c.h }, placed, area, from, opts);
      put(c, clear ? { ...clear, scale: 1 } : (big(c) && shrinkSpot(c, placed, area, from, opts)) || freeSpot(rect(c), placed, area, from, opts));
    }
    placed.push(rect(c));
  }
  // a shrunk card that nothing moved grows back at its home spot once it fits there (the board that pushed it was dismissed)
  for (const c of list) {
    if (c.scale === 1 || c.pinned || moves[c.id]) continue;
    const others = list.filter((o) => o !== c).map(rect), home = c.home || { x: c.x, y: c.y };
    const p = clearSpot({ w: c.w, h: c.h }, others, area, home, opts);
    if (p) put(c, { ...p, scale: 1 });
  }
  return moves;
}
