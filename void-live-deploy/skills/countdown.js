/**
 * countdown skill — days until a date. "days until new year" needs no network.
 * Empty surface stays empty; the count is a page.
 */
export function countdownOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:how many )?days until new year$/i.test(t)) return { kind: 'newyear' };
  if (/^days until (?:jan(?:uary)?\.?\s+1|january 1)$/i.test(t)) return { kind: 'newyear' };
  const m = t.match(/^(?:how many )?days until ([a-z]+\s+\d{1,2})$/i);
  if (m) return { kind: 'named', label: m[1] };
  return null;
}
export function daysUntil(target, now = new Date()) {
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}
export function newYearDate(now = new Date()) {
  const y = now.getMonth() === 0 && now.getDate() === 1 ? now.getFullYear() : now.getFullYear() + (now.getMonth() === 11 && now.getDate() === 31 ? 0 : 1);
  const year = now.getMonth() === 0 && now.getDate() === 1 ? now.getFullYear() : now.getFullYear() + 1;
  return new Date(year, 0, 1);
}
const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
function namedDate(label, now) {
  const m = String(label).toLowerCase().match(/^([a-z]+)\s+(\d{1,2})$/);
  if (!m || MONTHS[m[1]] == null) return null;
  const month = MONTHS[m[1]], day = Number(m[2]);
  let d = new Date(now.getFullYear(), month, day);
  if (daysUntil(d, now) < 0) d = new Date(now.getFullYear() + 1, month, day);
  return d;
}
function page(esc, label, n) {
  const word = n === 1 ? 'day' : 'days';
  const line = n === 0 ? 'That is today.' : n < 0 ? 'That date has passed.' : n + ' ' + word + ' until ' + label + '.';
  return '<h2>' + esc(label) + '</h2><p>' + esc(line) + '</p><div class="src">Counted on this device. Nothing is published.</div>';
}
async function run(text, api) {
  const hit = countdownOf(text);
  if (!hit) return 'none';
  const now = new Date();
  const target = hit.kind === 'newyear' ? newYearDate(now) : namedDate(hit.label, now);
  if (!target) return 'none';
  const label = hit.kind === 'newyear' ? 'New Year' : hit.label;
  const el = api.showPage((p) => { p.innerHTML = page(api.esc, label, daysUntil(target, now)); });
  return el ? 'countdown' : 'countdown';
}
export default {
  name: 'countdown',
  countdownOf,
  daysUntil,
  examples: ['days until new year', 'how many days until new year', 'days until january 1', 'days until december 25'],
  nearMisses: ['what is the new year', 'make a clock', 'when is the next holiday', 'remind me at 5'],
  match(lower, text) { return !!countdownOf(text); },
  run,
};
