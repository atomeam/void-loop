// anchor-density — how much "navigation depth" the ghost anchor (#void-anchor in void.html, the heart that opens the store) has behind
// it. Asked by Void (2026-10-18): "Integrate the 'density-indicator' logic into the ghost anchor so it visually shows how much
// 'navigation depth' or history is available." Navigation depth is what is on this device to go back to: the things on the stage
// (kept cards among them: a kept card is a stage thing of kind 'kept'), read from the stage store the way lib/state.js reads it
// (STORES.stage), against a goal of ANCHOR_GOAL things. density() from lib/list-goal.js gives the ratio and the state (under, near,
// met), the same rule the list bar draws with; the heart fills from the bottom by the ratio, and at 'met' it is whole and green.
// Pure: no DOM; void.html draws it on every void:stage-change (no timer).
import { density } from './list-goal.js';
import { read } from './state.js';

export const ANCHOR_GOAL = 12;
// the heart's box in its 24x24 viewBox (void.html's path spans y 6.2 to 21); the fill is a clip rect that grows up from the bottom
export const HEART_TOP = 6, HEART_BOTTOM = 21;

/** the things kept on this device, as the stage keeps them ({ id: thing }); {} when nothing is kept or the store is unreadable. Pure over the storage. */
export function stageThings(storage) {
  try { const v = JSON.parse(read('stage', storage) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; }
}

/** anchorDensity(things) -> { count, goal, ratio, state, label, title, fill: { y, h } }: `things` is the stage's map ({ id: thing }) or a list;
 *  count is every thing in it (a null slot counts for nothing), the label "7 of 12", the title the anchor shows, fill the clip rect
 *  (y and height in the heart's viewBox) that covers the lowest `ratio` of the heart. Pure. */
export function anchorDensity(things) {
  const list = Array.isArray(things) ? things : things && typeof things === 'object' ? Object.values(things) : [];
  const count = list.filter((t) => t && typeof t === 'object').length;
  const d = density(count, ANCHOR_GOAL);
  const h = Math.round((HEART_BOTTOM - HEART_TOP) * d.ratio * 10) / 10;
  return { count, goal: ANCHOR_GOAL, ratio: d.ratio, state: d.state, label: d.label, title: 'support V01D · ' + d.label + ' things on your stage',
    fill: { y: Math.round((HEART_BOTTOM - h) * 10) / 10, h: h ? h + (24 - HEART_BOTTOM) : 0 } }; // past the bottom edge so the rect never leaves a sliver
}
