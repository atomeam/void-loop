// Sightline: pure layout-constraint checks for Verse's cards (owner, 2026-11-11). A snapshot is the bounding boxes a
// browser captured after a card rendered; these functions say whether it breaks Verse's design rules, and what CSS
// would fix it. Pure: no DOM, no browser, no I/O. The browser suite captures the boxes; the checks decide.
//   overflow: a card whose content is taller than its box (text cut off, no scroll) -> add max-h + overflow-y-auto
//   min-width: a flex child narrower than its floor (cramped controls) -> min-w-0 / flex-1
//   scrollable list: more than N items in a container with no scroll -> max-h + overflow-y-auto
//   aspect ratio: a card far from its intended ratio -> aspect-[...]

/** a box is { width, height, scrollWidth, scrollHeight, clientWidth, clientHeight }. Pure. */
export function overflowOf(box) {
  if (!box) return null;
  const sh = Number(box.scrollHeight ?? box.height ?? 0);
  const ch = Number(box.clientHeight ?? box.height ?? 0);
  if (!Number.isFinite(sh) || !Number.isFinite(ch) || ch <= 0) return null;
  if (sh <= ch + 1) return null; // 1px tolerance
  return { kind: 'overflow', scrollHeight: sh, clientHeight: ch, excess: sh - ch, fix: 'max-h-60 overflow-y-auto' };
}

/** a box is too narrow: width < min (default 120px). Pure. */
export function minWidthOf(box, min = 120) {
  if (!box) return null;
  const w = Number(box.width ?? box.clientWidth ?? 0);
  if (!Number.isFinite(w) || w >= min) return null;
  return { kind: 'min-width', width: w, min, fix: 'min-w-0 flex-1' };
}

/** a list with more than `threshold` items needs a scroll container; without one it grows the card. Pure. */
export function unscrollableList(itemCount, hasScrollContainer, threshold = 5) {
  const n = Number(itemCount);
  if (!Number.isFinite(n) || n <= threshold) return null;
  if (hasScrollContainer) return null;
  return { kind: 'unscrollable-list', itemCount: n, threshold, fix: 'max-h-60 overflow-y-auto' };
}

/** a card whose content aspect ratio is far from `target` (default 1) by more than `tolerance`. Pure. */
export function aspectOf(box, target = 1, tolerance = 0.5) {
  if (!box) return null;
  const w = Number(box.width ?? box.clientWidth ?? 0);
  const h = Number(box.height ?? box.clientHeight ?? 0);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const ratio = w / h;
  if (Math.abs(ratio - target) <= tolerance) return null;
  return { kind: 'aspect', ratio: Math.round(ratio * 100) / 100, target, fix: 'aspect-video or aspect-square' };
}

/** run every check on one snapshot; returns the list of defects (empty = clean). Pure.
 *  snapshot: { name, box, itemCount?, hasScrollContainer?, minWidth?, aspectTarget?, aspectTolerance? } */
export function checkSnapshot(snap) {
  if (!snap) return [];
  const out = [];
  const o = overflowOf(snap.box); if (o) out.push({ name: snap.name, ...o });
  const m = minWidthOf(snap.box, snap.minWidth); if (m) out.push({ name: snap.name, ...m });
  const u = unscrollableList(snap.itemCount, snap.hasScrollContainer, snap.threshold); if (u) out.push({ name: snap.name, ...u });
  const a = aspectOf(snap.box, snap.aspectTarget, snap.aspectTolerance); if (a) out.push({ name: snap.name, ...a });
  return out;
}

/** run every check on a list of snapshots; returns { defects, clean }. Pure. */
export function checkAll(snapshots) {
  const defects = [];
  for (const s of snapshots || []) defects.push(...checkSnapshot(s));
  return { defects, clean: defects.length === 0 };
}

/** turn a defect list into a ready-to-paste CSS patch hint. Pure. */
export function patchFor(defects) {
  return (defects || []).map((d) => '/* ' + d.name + ': ' + d.kind + ' */ ' + (d.fix || '')).join('\n');
}