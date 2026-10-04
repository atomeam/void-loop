/**
 * countdown skill — days until a date. "days until new year" needs no network.
 * Empty surface stays empty; the count is an outcome card that stays on the stage (stageKinds), copyable as
 * plain text, until it's thrown off. A second named countdown (new year plus a birthday) gets its own card.
 */
export function countdownOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:how many )?days until new year$/i.test(t)) return { kind: 'newyear' };
  if (/^days until (?:jan(?:uary)?\.?\s+1|january 1)$/i.test(t)) return { kind: 'newyear' };
  const m = t.match(/^(?:how many )?days until ([a-z]+\s+\d{1,2})$/i);
  if (m && realDay(m[1])) return { kind: 'named', label: m[1] };
  // "days until my birthday on march 3": a named day with its date
  const b = t.match(/^(?:how many )?days (?:until|till|to) (?:my |our |the )?([a-z' ]{2,40}?) (?:on|is on|is) ([a-z]+ \d{1,2})$/i);
  if (b && realDay(b[2])) return { kind: 'named', label: b[1], date: b[2].toLowerCase() };
  // "countdown to christmas", "how many sleeps until christmas" (plain "days until christmas" stays with holidays/calc)
  const c = t.match(/^(?:(?:a |start a )?countdown (?:to|until|till)|(?:how many )?sleeps (?:until|till|to)) (.+)$/i);
  if (c) {
    const w = c[1].toLowerCase().replace(/^the /, '').replace(/['’]/g, '');
    if (/^new years?(?: day)?$|^jan(?:uary)? 1$/.test(w)) return { kind: 'newyear' };
    if (NAMED[w]) return { kind: 'named', label: NAMED[w][0], date: NAMED[w][1] };
    if (realDay(w)) return { kind: 'named', label: c[1] };
  }
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
const NAMED = { christmas: ['Christmas', 'december 25'], 'christmas day': ['Christmas', 'december 25'], 'christmas eve': ['Christmas Eve', 'december 24'], halloween: ['Halloween', 'october 31'], 'valentines day': ['Valentine’s Day', 'february 14'], 'new years eve': ['New Year’s Eve', 'december 31'], 'july 4th': ['July 4', 'july 4'], 'the 4th of july': ['July 4', 'july 4'], '4th of july': ['July 4', 'july 4'] };
// "march 3" names a real day (february 31 does not; february 29 is allowed, it counts to the next leap year's)
function realDay(md) {
  const m = String(md).toLowerCase().match(/^([a-z]+)\s+(\d{1,2})$/);
  if (!m || MONTHS[m[1]] == null) return false;
  return +m[2] >= 1 && +m[2] <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][MONTHS[m[1]]];
}
const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
function namedDate(label, now) {
  const m = String(label).toLowerCase().match(/^([a-z]+)\s+(\d{1,2})$/);
  if (!m || MONTHS[m[1]] == null) return null;
  const month = MONTHS[m[1]], day = Number(m[2]);
  // the next year this day exists and is not past (february 29 waits for a leap year)
  for (let y = now.getFullYear(); y < now.getFullYear() + 9; y++) {
    const d = new Date(y, month, day);
    if (d.getMonth() === month && daysUntil(d, now) >= 0) return d;
  }
  return null;
}
function titleOf(label) { return String(label).replace(/\b\w/g, (c) => c.toUpperCase()); }
export function dateText(d) { return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
export function daysLine(n) {
  if (n === 0) return 'Today';
  if (n < 0) return Math.abs(n) + (Math.abs(n) === 1 ? ' day ago' : ' days ago');
  return n + (n === 1 ? ' day' : ' days');
}
// the outcome card: title, the count, the date — one child per line, so "copy" (stageApi.addCopy) reads naturally
function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card countdown-card';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:200px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:rgba(12,12,12,0.92);font-size:13px;cursor:grab;user-select:none;text-align:center';
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  const head = document.createElement('div');
  head.style.cssText = 'color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px';
  head.textContent = 'Days until ' + th.label;
  const big = document.createElement('div');
  big.style.cssText = 'font-size:28px;font-weight:600;line-height:1.1;margin-bottom:8px';
  big.textContent = daysLine(th.days);
  const date = document.createElement('div');
  date.style.cssText = 'color:var(--muted);font-size:11px';
  date.textContent = th.dateText;
  el.appendChild(head); el.appendChild(big); el.appendChild(date);
  stageApi.bindDrag(el, th);
  stageApi.addCopy(el);
  stageApi.stage.appendChild(el);
}
async function run(text, api) {
  const hit = countdownOf(text);
  if (!hit) return 'none';
  const now = new Date();
  const target = hit.kind === 'newyear' ? newYearDate(now) : namedDate(hit.date || hit.label, now);
  if (!target) return 'none';
  const label = hit.kind === 'newyear' ? 'New Year' : titleOf(hit.label);
  const days = daysUntil(target, now), dText = dateText(target);
  const things = api.stage.things();
  const existing = Object.values(things).find((t) => t.kind === 'countdown' && t.label === label);
  if (existing) { existing.days = days; existing.dateText = dText; api.stage.save(); api.stage.render(); }
  else { // a second distinct countdown (new year, then a birthday) gets its own spot, not stacked on the first
    const n = Object.values(things).filter((t) => t.kind === 'countdown').length;
    api.summon('countdown', { label, days, dateText: dText, x: 40 + n * 24, y: 60 + n * 24 });
  }
  return 'countdown';
}
export default {
  name: 'countdown',
  countdownOf,
  daysUntil,
  examples: ['days until new year', 'how many days until new year', 'days until january 1', 'days until december 25', 'countdown to christmas', 'how many sleeps until christmas', 'days until my birthday on march 3'],
  nearMisses: ['what is the new year', 'make a clock', 'when is the next holiday', 'remind me at 5', 'how many days until christmas'],
  match(lower, text) { return !!countdownOf(text); },
  run,
  stageKinds: { countdown: { mount } },
};
