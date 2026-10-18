/**
 * rides skill - food and rides in one card: type an address (and what you want to eat), get the Uber Eats, DoorDash, Waymo,
 * Uber and Lyft apps and sites opened on it; plus "where does Waymo run". Contract: { name, examples, nearMisses, match, run }.
 * Every provider sits behind an adapter in skills/providers.js, so a real ordering API replaces a deep link later without
 * touching this card. None of these services has a public API for ordering on someone's behalf today (docs/everything-app.md).
 */
import { ofKind, waymoWhere } from './providers.js';
/** { waymo: city|'' } | { open: true, address?, food? } | null. Pure. */
export function ridesAsk(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:where\s+(?:does|do|can)\s+(?:i\s+(?:get|ride|take)\s+(?:a\s+)?)?waymos?\s*(?:run|operate|go|drive|work|ride)?|where\s+is\s+waymo(?:\s+available)?|waymo\s+(?:cities|service\s+areas?|map))$/);
  if (m) return { waymo: '' };
  m = t.match(/^(?:is\s+(?:there\s+)?waymo\s+(?:in|available\s+in)|does\s+waymo\s+(?:run|operate|work|go)\s+in|can\s+i\s+(?:get|take|ride)\s+a\s+waymo\s+in)\s+([a-z .'-]{2,40})$/);
  if (m) return { waymo: m[1].trim() };
  m = t.match(/^(?:order|get|i\s+want|deliver)\s+(?:me\s+)?(?:some\s+)?([a-z '&-]{2,30}?)\s+(?:delivered\s+)?(?:to|at)\s+(.{4,120})$/);
  if (m && !/\b(?:ride|car|taxi|waymo|uber)\b/.test(m[1])) return { open: true, food: m[1].trim(), address: m[2].trim() };
  m = t.match(/^([a-z '&-]{2,30}?)\s+delivery\s+(?:to|at|near)\s+(.{4,120})$/);
  if (m) return { open: true, food: m[1].trim() === 'food' ? '' : m[1].trim(), address: m[2].trim() };
  m = t.match(/^(?:(?:get|call|book|order)\s+(?:me\s+)?)?(?:a\s+)?(?:ride|waymo|robotaxi|taxi|car)\s+to\s+(.{4,120})$/);
  if (m) return { open: true, address: m[1].trim(), ride: true };
  if (/^(?:food\s+(?:and|&)\s+rides?|rides?\s+(?:and|&)\s+food|food\s+delivery|order\s+food|delivery\s+card|rides?\s+card|food\s+card|get\s+a\s+ride|order\s+a\s+ride|waymo|uber\s+eats|doordash|food\s+delivery\s+via\s+waymo|waymo\s+delivery)$/.test(t)) return { open: true };
  return null;
}
function draw(el, esc, q) {
  const btn = (p, kind) => '<a class="g-btn" style="display:inline-block;margin:3px 4px 3px 0;padding:6px 10px;text-decoration:none" target="_blank" rel="noopener" href="' + esc(p.web(q)) + '">' + esc(p.name) + ' ↗</a>'
    + '<a style="font-size:11px;opacity:.7;margin-right:8px" href="' + esc(p.app(q)) + '">app</a>';
  el.querySelector('.rd-out').innerHTML = '<p style="margin:10px 0 4px">Food' + (q.food ? ' · ' + esc(q.food) : '') + (q.address ? ' · to ' + esc(q.address) : '') + '</p>'
    + ofKind('food').map((p) => btn(p)).join('') + '<p style="margin:10px 0 4px">Rides' + (q.address ? ' · to ' + esc(q.address) : '') + '</p>' + ofKind('ride').map((p) => btn(p)).join('')
    + '<p class="g-sub" style="font-size:12px;margin-top:8px">You order and pay inside their app; Verse never sees your card. Waymo food delivery runs through DoorDash in metro Phoenix.</p>';
}
function run(text, api) {
  const { showPage, esc } = api; const q = ridesAsk(text);
  if (!q) return 'none';
  if ('waymo' in q) {
    const w = waymoWhere(q.waymo);
    showPage((el) => { el.innerHTML = '<h2>Where Waymo runs</h2><p>' + esc(w.text) + '</p><p class="g-sub">Waymo has no public ordering API, so Verse opens the Waymo app for you: <a href="https://waymo.com/rides/" target="_blank" rel="noopener">waymo.com/rides</a>.</p><div class="src">Source: <a href="https://waymo.com/faq/" target="_blank" rel="noopener">Waymo FAQ</a> · checked Oct 2026</div>'; });
    return 'rides';
  }
  showPage((el) => {
    el.className += ' rides-card';
    el.innerHTML = '<h2>Food &amp; rides</h2><div style="display:flex;gap:6px;flex-wrap:wrap"><input class="rd-food" aria-label="What to eat" placeholder="pizza, tacos…" style="flex:1;min-width:120px"><input class="rd-addr" aria-label="Address" placeholder="address or place" style="flex:2;min-width:160px"></div><div class="rd-out"></div><div class="src">Deep links to each service · <a data-ask="where does waymo run" href="#">where does Waymo run?</a></div>';
    const f = el.querySelector('.rd-food'), a = el.querySelector('.rd-addr');
    f.value = q.food || ''; a.value = q.address || '';
    const up = () => draw(el, esc, { food: f.value.trim(), address: a.value.trim() });
    for (const i of [f, a]) { i.addEventListener('input', up); i.addEventListener('keydown', (e) => e.stopPropagation()); }
    up();
  });
  return 'rides';
}
export default {
  name: 'rides',
  examples: ['food and rides', 'where does waymo run', 'is waymo in austin', 'pizza delivery to 1 main st phoenix', 'get me a ride to the airport', 'food delivery via waymo'],
  nearMisses: ['how far is the airport', 'pizza recipe', 'calories in pizza', 'uber stock price'],
  match(lower, text) { return !!ridesAsk(text || lower); },
  run,
};
