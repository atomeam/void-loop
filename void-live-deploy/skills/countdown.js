/**
 * countdown skill — days until a date. "days until new year" needs no network.
 * Empty surface stays empty; the count is an outcome card that stays on the stage (stageKinds), copyable as
 * plain text, until it's thrown off. A second named countdown (new year plus a birthday) gets its own card.
 */
// "january 1st", "the 1st of march", "jan 2nd", "dec 25th" read as "january 1", "march 1", "january 2", "december 25" (owner, 2026-10-18)
const ABBR = { jan: 'january', feb: 'february', mar: 'march', apr: 'april', jun: 'june', jul: 'july', aug: 'august', sep: 'september', sept: 'september', oct: 'october', nov: 'november', dec: 'december' };
export function plainDate(s) {
  return String(s || '')
    .replace(/\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+of\s+([a-z]{3,9})\b/gi, '$2 $1')
    .replace(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)\b/gi, '$1 $2')
    .replace(/\b(jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?(?=\s+\d)/gi, (m, a) => ABBR[a.toLowerCase()]);
}
// "show the countdown", "show the days until a date", "show the countdown to christmas" (one countdown with show-countdown,
// 2026-10-22): the plain countdown ask they mean ("days until new year" when no day is named), or null. Pure.
export function showAskOf(text) {
  const sh = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').replace(/^please /, '');
  if (/^show (?:the )?countdown$|^show the days until a date$/.test(sh)) return 'days until new year';
  const st = sh.match(/^show (?:the |a |my )?countdown (?:to|until|till) (.+)$/);
  if (!st) return null;
  for (const ask of ['countdown to ' + st[1], 'days until ' + st[1]]) if (countdownOf(ask)) return ask;
  return null;
}
export function countdownOf(text) {
  const t = plainDate(String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
  if (/^(?:how many )?(?:days|weeks) until new year$/i.test(t)) return { kind: 'newyear' };
  if (/^days until (?:jan(?:uary)?\.?\s+1|january 1)$/i.test(t)) return { kind: 'newyear' };
  const m = t.match(/^(?:how many )?(?:days|weeks) (?:until|till|to) (?:the )?([a-z]+\s+\d{1,2})$/i);
  if (m && realDay(m[1])) return { kind: 'named', label: m[1] };
  // "days until valentines day": named days the holiday list doesn't answer (christmas and halloween stay with it)
  const v = t.match(/^(?:how many )?(?:days|weeks) (?:until|till|to) (.+)$/i);
  if (v) { const w = v[1].toLowerCase().replace(/^the /, '').replace(/['’]/g, ''); if (OWN.has(w) && NAMED[w]) return { kind: 'named', label: NAMED[w][0], date: NAMED[w][1] }; }
  // "days until my birthday on march 3": a named day with its date
  const b = t.match(/^(?:(?:how many )?days (?:until|till|to)|(?:a |start a )?countdown (?:to|until|till)) (?:my |our |the )?([a-z' ]{2,40}?) (?:on|is on|is) ([a-z]+ \d{1,2})$/i);
  if (b && realDay(b[2])) return { kind: 'named', label: b[1], date: b[2].toLowerCase() };
  // "countdown to christmas", "how many sleeps until christmas" (plain "days until christmas" stays with holidays/calc)
  const c = t.match(/^(?:(?:a |start a )?countdown (?:to|until|till)|(?:how many )?sleeps (?:until|till|to)) (.+)$/i);
  if (c) {
    const w = c[1].toLowerCase().replace(/^the /, '').replace(/['’]/g, '');
    if (/^new years?(?: day)?$|^jan(?:uary)? 1$/.test(w)) return { kind: 'newyear' };
    if (NAMED[w]) return { kind: 'named', label: NAMED[w][0], date: NAMED[w][1] };
    if (realDay(w)) return { kind: 'named', label: c[1] };
  }
  return pickOf(t);
}
// an event countdown that names no date (docs/GAPS.md row 78, 2026-11-06: "event countdown" gave an explanation): a card with a name and
// a date box that counts down in days, hours, minutes and seconds. "event countdown", "countdown clock", "countdown to a date",
// "wedding countdown", "countdown to my wedding" (the name is filled in). A bare "countdown" or "countdown timer" stays a timer.
const EVENTS = 'wedding|birthday|vacation|holiday|trip|retirement|graduation|anniversary|due date|baby|party|launch|exam|concert|moving day|big day';
const MAKE = '(?:(?:make|create|start|set up|build|give me) )?(?:a |an |my |our )?';
/** { kind: 'pick', label } for an event countdown with no date named, or null. Pure. */
export function pickOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').replace(/^please /, '');
  if (new RegExp('^' + MAKE + '(?:event|custom|live) countdown(?: (?:timer|clock|generator|maker|widget|page))?$').test(t)
    || new RegExp('^' + MAKE + 'countdown (?:clock|generator|maker|widget)$').test(t)
    || new RegExp('^' + MAKE + 'countdown (?:timer |clock )?(?:to|until|till|for) (?:a|an|any|my|our|the) (?:date|day|event)$').test(t)) return { kind: 'pick', label: '' };
  const m = t.match(new RegExp('^' + MAKE + '(' + EVENTS + ') countdown(?: (?:timer|clock))?$')) || t.match(new RegExp('^' + MAKE + 'countdown (?:timer |clock )?(?:to|until|till|for) (?:my|our|the) (' + EVENTS + ')$'));
  return m ? { kind: 'pick', label: m[1].replace(/\b\w/g, (c) => c.toUpperCase()) } : null;
}
/** whole days, hours, minutes and seconds from now to the target; past: true once it has gone by. Pure. */
export function partsUntil(targetMs, nowMs = Date.now()) {
  const ms = targetMs - nowMs, past = ms < 0, s = Math.floor(Math.abs(ms) / 1000);
  return { past, days: Math.floor(s / 86400), hours: Math.floor(s / 3600) % 24, minutes: Math.floor(s / 60) % 60, seconds: s % 60 };
}
/** "12 days, 03:04:05" (or "... ago" once past). Pure. */
export function partsLine(p) {
  const two = (n) => String(n).padStart(2, '0');
  return p.days + (p.days === 1 ? ' day, ' : ' days, ') + two(p.hours) + ':' + two(p.minutes) + ':' + two(p.seconds) + (p.past ? ' ago' : '');
}
const KEY = 'verse-event-countdown';
// a datetime-local value ("2026-12-24T18:00") as local time in ms, or NaN
const localMs = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(v || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime() : NaN; };
const BOX = 'font:15px system-ui;padding:5px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.05);color:inherit';
function pickCard(hit, api) {
  const esc = api.esc || ((x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'));
  let kept = {};
  try { kept = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
  const name = hit.label || kept.name || '', when = !hit.label || hit.label === kept.name ? kept.when || '' : '';
  const el = api.showPage((p) => {
    p.innerHTML = '<h2>Event countdown</h2>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0">'
      + '<input class="ec-name" aria-label="Event name" placeholder="Event name" value="' + esc(name) + '" style="' + BOX + ';flex:1 1 160px">'
      + '<input class="ec-when" type="datetime-local" aria-label="Date and time of the event" value="' + esc(when) + '" style="' + BOX + '"></div>'
      + '<div class="ec-big" aria-live="off" style="font-size:30px;font-weight:600;line-height:1.2;margin:10px 0 4px;font-variant-numeric:tabular-nums"></div>'
      + '<p class="ec-say" aria-live="polite" style="min-height:1.4em;margin:4px 0;color:#9a9a9a"></p>'
      + '<div class="src">Counted in your browser from this device\'s clock · the name and date stay on this device</div>';
  });
  const q = (c) => el && el.querySelector && el.querySelector(c), nameEl = q('.ec-name'), whenEl = q('.ec-when'), big = q('.ec-big'), say = q('.ec-say');
  if (!whenEl || !big) return;
  let timer = null;
  const paint = () => {
    if (timer && el.isConnected === false) { clearInterval(timer); timer = null; return; }
    const t = localMs(whenEl.value), label = (nameEl && nameEl.value.trim()) || 'the event';
    if (!isFinite(t)) { big.textContent = ''; if (say) say.textContent = 'Pick the date and time of the event.'; return; }
    const pr = partsUntil(t);
    big.textContent = partsLine(pr);
    if (say) say.textContent = (pr.past ? 'Since ' : 'Until ') + label + ', ' + new Date(t).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + '.';
  };
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify({ name: nameEl ? nameEl.value.trim() : '', when: whenEl.value })); } catch (_) {} paint(); };
  whenEl.addEventListener('input', keep); whenEl.addEventListener('change', keep);
  if (nameEl) nameEl.addEventListener('input', keep);
  paint();
  timer = setInterval(paint, 1000);
  try { (when ? nameEl : whenEl).focus(); } catch (_) {}
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
const OWN = new Set(['valentines day', 'new years eve', 'christmas eve', 'july 4th', '4th of july']);
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
// a local date as YYYY-MM-DD, so the miniature can keep counting after the card was made
function isoDay(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
// "how many weeks until december 25": 78 days also reads as 11 weeks, 1 day
export function weeksLine(n) {
  const w = Math.floor(n / 7), d = n % 7;
  return w + (w === 1 ? ' week' : ' weeks') + (d ? ', ' + d + (d === 1 ? ' day' : ' days') : '');
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
  date.textContent = (th.days >= 14 ? weeksLine(th.days) + ' · ' : '') + th.dateText;
  el.appendChild(head); el.appendChild(big); el.appendChild(date);
  // the 3D desk calendar (skills/mini/countdown.js) under the count; where WebGL can't run the card keeps its plain look
  if (stageApi.miniature) {
    const slot = document.createElement('div');
    slot.className = 'countdown-mini';
    slot.style.cssText = 'height:150px;margin:10px -6px 0;border-radius:8px;overflow:hidden';
    el.appendChild(slot);
    // the same key on every re-render moves the live calendar here and passes it the new data; nothing is kept on th,
    // because the stage saves th as JSON
    stageApi.miniature(slot, 'countdown', { days: th.days, label: th.label, target: th.target || null }, { key: th.id, place: 'inside' })
      .catch(() => { slot.remove(); });
  }
  stageApi.bindDrag(el, th);
  stageApi.addCopy(el);
  stageApi.stage.appendChild(el);
}
async function run(text, api) {
  const hit = countdownOf(text);
  if (!hit) return 'none';
  if (hit.kind === 'pick') { pickCard(hit, api); return 'countdown'; }
  const now = new Date();
  const target0 = hit.kind === 'newyear' ? newYearDate(now) : namedDate(hit.date || hit.label, now);
  if (!target0) return 'none';
  const label = hit.kind === 'newyear' ? 'New Year' : titleOf(hit.label);
  const days = daysUntil(target0, now), dText = dateText(target0);
  const things = api.stage.things();
  const existing = Object.values(things).find((t) => t.kind === 'countdown' && t.label === label);
  const target = isoDay(target0);
  if (existing) { existing.days = days; existing.dateText = dText; existing.target = target; api.stage.save(); api.stage.render(); }
  else { // a second distinct countdown (new year, then a birthday) gets its own spot, not stacked on the first
    const n = Object.values(things).filter((t) => t.kind === 'countdown').length;
    api.summon('countdown', { label, days, dateText: dText, target, x: 40 + n * 24, y: 60 + n * 24 });
  }
  return 'countdown';
}
export default {
  name: 'countdown',
  countdownOf,
  daysUntil,
  examples: ['days until new year', 'how many days until new year', 'days until january 1', 'days until december 25', 'countdown to christmas', 'how many sleeps until christmas', 'days until my birthday on march 3', 'event countdown', 'wedding countdown'],
  nearMisses: ['what is the new year', 'what is a countdown', 'countdown timer', 'make a clock', 'when is the next holiday', 'remind me at 5', 'how many days until christmas'],
  match(lower, text) { return !!countdownOf(text); },
  run,
  stageKinds: { countdown: { mount } },
};
