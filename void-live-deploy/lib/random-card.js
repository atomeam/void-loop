// the random page's card on the stage: the range on the page, in the ask the stage's own random number answers
// ('random number between -5 and 5', void.html chanceOf). Whole numbers only, as the stage draws them; anything else keeps the example.
const WHOLE = /^-?\d{1,9}$/;
/** the stage ask for a draw from min to max, or '' when the page holds no whole-number range. Pure. */
export function cardAsk(min, max, dec = '0') {
  const a = String(min ?? '').trim(), b = String(max ?? '').trim();
  if (String(dec) !== '0' || !WHOLE.test(a) || !WHOLE.test(b)) return '';
  let lo = +a, hi = +b; if (lo > hi) [lo, hi] = [hi, lo];
  return 'random number between ' + lo + ' and ' + hi;
}
