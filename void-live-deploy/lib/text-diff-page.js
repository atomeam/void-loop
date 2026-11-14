// What the text comparison page says about a diff. Pure.

import { diffCounts } from './textdiff.js';

const n = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');

/** a side ready to compare. Case and runs of spaces can be set aside. The stored text is not changed. Pure. */
export function foldText(text, mode) {
  let s = String(text == null ? '' : text);
  if (mode && mode.space) s = s.replace(/[ \t]+/g, ' ');
  if (mode && mode.lower) s = s.toLowerCase();
  return s;
}

export function diffSummary(rows) {
  if (!rows || rows.tooLong) return { ok: false, reason: 'long' };
  const c = diffCounts(rows);
  if (!c.del && !c.add) return { ok: true, same: true, line: 'The two texts are the same.' };
  return { ok: true, same: false, line: n(c.del, 'line') + ' removed, ' + n(c.add, 'line') + ' added, ' + c.same + ' unchanged.' };
}
