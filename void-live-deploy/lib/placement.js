// Where a card goes on the stage so it doesn't cover another (2026-10-10: the tab card grew and a summoned countdown landed on it,
// so a person's click hit the wrong card). Pure: rectangles in, moves out, the same answer every time.
//   arrange(cards, area): cards are { id, x, y, w, h, pinned?, fresh?, grew? } in stage order.
//     - a fresh card (just summoned) keeps its spot if it's clear, else takes the nearest free spot from where it was asked to land
//     - a card that grew keeps its spot; the cards it now covers move to the nearest free spot from where they were,
//       unless they are pinned (a card the person dragged stays where they put it), and if it grew onto a pinned card, it moves
//     - everything else stays exactly where it is, overlapping or not: a saved layout is never reshuffled on load
//   Returns { id: { x, y } } for the cards that move.

export const GAP = 12, STEP = 16, EDGE = 8;

const hit = (a, b, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
export function overlaps(a, b, gap = 0) { return hit(a, b, gap); }

/**
 * The nearest spot for a w x h card, from `from`, where it covers none of `others` (keeping `gap` between).
 * Candidates are a STEP grid inside the area, nearest first (ties: higher on the stage, then further left).
 * When nothing is free it takes the candidate that covers the least, so a card is never sent off the stage.
 */
export function freeSpot(size, others, area, from, { gap = GAP, step = STEP } = {}) {
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
  return best ? { x: best.x, y: best.y } : { x: fx, y: fy };
}

export function arrange(cards, area, opts = {}) {
  const gap = opts.gap ?? GAP;
  const list = (cards || []).filter((c) => c && c.id != null && c.w > 0 && c.h > 0).map((c) => ({ ...c }));
  const grown = list.filter((c) => c.grew);
  const movable = new Set();
  for (const c of list) if (c.fresh && !c.pinned) movable.add(c.id);
  for (const g of grown) {
    for (const c of list) if (c !== g && !c.pinned && !c.grew && hit(g, c, gap)) movable.add(c.id);
    if (!g.pinned && list.some((c) => c !== g && c.pinned && hit(g, c, gap))) movable.add(g.id);
  }
  const placed = list.filter((c) => !movable.has(c.id));
  const moves = {};
  for (const c of list) {
    if (!movable.has(c.id)) continue;
    if (placed.some((o) => hit(c, o, gap))) {
      const p = freeSpot(c, placed, area, { x: c.x, y: c.y }, opts);
      if (p.x !== c.x || p.y !== c.y) { moves[c.id] = p; c.x = p.x; c.y = p.y; }
    }
    placed.push(c);
  }
  return moves;
}
