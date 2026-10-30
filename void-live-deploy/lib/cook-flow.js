// cook-flow — the one tap after a kitchen answer (asked by Verse, ask-20261015-0151-1: "a 'cook-flow' card that combines the
// new kitchen conversions with the 'timer' skill, allowing a user to set a countdown immediately after a conversion").
// A kitchen conversion ("3 cups in ml", "how many cups is 500g of flour", "gas mark 4 in celsius", "medium rare steak
// temperature") or a kitchen swap ends with a chip that starts a timer: one tap runs "set a 10 minute timer" (the timer
// skill, which starts at once), with 5 and 20 minutes beside it. Copied from the best: a phone's kitchen-timer shortcut
// after a recipe step. Pure: no DOM here; void.html (the calculated card) and skills/swaps.js append what cookChip returns.
const KITCHEN_UNIT = /\b(?:cups?|tbsp|tbs|tablespoons?|tsp|teaspoons?|ml|millilit(?:er|re)s?|fl\.?\s*oz|fluid\s+ounces?|lit(?:er|re)s?|l|grams?|g|oz|ounces?|pints?|pt|quarts?|qt|gallons?|gal|sticks?\s+of\s+butter)\b/;
const KITCHEN_WORD = /\b(?:gas\s+mark|oven|bake|baking|roast|steak|doneness|rare|well[\s-]done|cook(?:ed|ing)?\s+(?:to|chicken|pork|beef|turkey|fish|salmon|lamb|ham|eggs?)|flour|sugar|butter|rice|oats|honey|milk|water|cocoa|oil|yogurt|salt|syrup|cornstarch|dozen|buttermilk|eggs?|cream|baking\s+(?:powder|soda)|vinegar|lemon|garlic|onion|herbs|cheese|molasses|vanilla|breadcrumbs|mayo(?:nnaise)?|tomato|wine|ricotta|panko)\b/;
const BODY_ONLY = /\b(?:miles?|mi|km|kilomet(?:er|re)s?|feet|ft|foot|yards?|yd|met(?:er|re)s?|inch(?:es)?|cm|mph|kph|knots?|acres?|hectares?|bytes?|kb|mb|gb)\b/;
const DEFAULT_MIN = 10, OTHER_MIN = [5, 20];

/** the timer chip a kitchen ask earns: { ask, label, others: [{ ask, label }] }, or null for anything that is not kitchen work.
 *  `minutes`: the time the card itself states, offered first. Pure. */
export function cookNext(text, minutes = null) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 120) return null;
  const kitchen = (KITCHEN_UNIT.test(t) && (/\d/.test(t) || /\bhow\s+many\b/.test(t)) && !(BODY_ONLY.test(t) && !KITCHEN_WORD.test(t))) || KITCHEN_WORD.test(t);
  if (!kitchen) return null;
  if (/\b(?:timer|countdown|alarm|stopwatch)\b/.test(t)) return null; // already one
  const one = (m) => ({ ask: 'set a ' + m + ' minute timer', label: m + ' min' });
  // a card that states its own time (a hard-boiled egg: 12 minutes) offers that time first, not the default
  const first = Number.isInteger(minutes) && minutes >= 1 && minutes <= 180 ? minutes : DEFAULT_MIN;
  return { ...one(first), label: 'set a ' + first + ' minute timer', others: [DEFAULT_MIN, ...OTHER_MIN].filter((m) => m !== first).slice(0, 2).map(one) };
}

/** the chip as HTML for a card (data-ask links the page already runs), or '' when the ask is not kitchen work. `esc` is the page's escaper;
 *  `minutes` as cookNext. Pure. */
export function cookChip(text, esc, minutes = null) {
  const n = cookNext(text, minutes);
  if (!n) return '';
  const e = typeof esc === 'function' ? esc : (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return '<p class="cook-flow" style="margin:10px 0 0;font-size:14px"><a href="#" data-ask="' + e(n.ask) + '" style="text-decoration:none;border:1px solid rgba(150,175,255,.35);border-radius:999px;padding:4px 12px;white-space:nowrap">⏱ ' + e(n.label) + '</a>'
    + ' <span style="color:#8a8a8a">or ' + n.others.map((o) => '<a href="#" data-ask="' + e(o.ask) + '">' + e(o.label) + '</a>').join(' · ') + ' · it starts at once, on the stage</span></p>';
}
