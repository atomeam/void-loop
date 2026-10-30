// /resize-image/'s stage card: the size open on the page (width, height, unit and KB limit), as an ask the stage's imgfit skill reads back
// (skills/imgfit.js match, then lib/imgfit.js sizeIn), so "See it as a card on the stage" shows a resizer card for that size, not the example.
// Only the size: the picture never leaves the page and is never in an ask or an address. An ask the skill would read as another size gives
// '', so the example ask stays. Pure: tools/resize-card.test.mjs.
import { sizeIn, MAX_SIDE } from './imgfit.js';
import imgfit from '../skills/imgfit.js';

const UNIT = { px: 'px', cm: 'cm', mm: 'mm', in: 'in' };
const num = (v) => { const s = String(v == null ? '' : v).trim(); return /^\d{1,5}(?:\.\d{1,3})?$/.test(s) && Number(s) > 0 ? Number(s) : 0; };

/** the stage ask for the size on the page ({ w, h, u, kb }, the form's values), or ''. Pure. */
export function cardAsk(f) {
  const w = num(f && f.w), h = num(f && f.h), u = UNIT[f && f.u] || '', kb = num(f && f.kb);
  const size = w && h && u && w <= MAX_SIDE && h <= MAX_SIDE;
  if (!size && !kb) return '';
  const ask = size ? 'resize a photo to ' + w + ' x ' + h + ' ' + u + (kb ? ' under ' + kb + ' kb' : '') : 'compress a photo to ' + kb + ' kb';
  if (!imgfit.match(ask.toLowerCase(), ask)) return '';
  const s = sizeIn(ask);
  if (size && (s.w !== w || s.h !== h || s.unit !== u)) return '';
  if (kb && s.kb !== kb) return ''; // a limit like 49.5 KB the skill would round: the example stays
  return ask;
}
