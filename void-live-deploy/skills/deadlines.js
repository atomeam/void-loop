/**
 * deadlines skill - a chain of deadlines from one start moment ("24 hours, 72 hours, 14 days, 1 month"), each shown with its
 * date and time in your time zone, how long until it (or since), and whether it is pending, due soon, passed or met.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "deadline chain from today: 24 hours, 72 hours, 14 days", "when are my deadlines if it started monday 9am: 1 day, 3 days,
 * 2 weeks, 1 month", "reporting deadlines from 2026-10-15 14:00" (no list given: the common 24 h / 72 h / 14 d / 1 month chain).
 * The date math is the one calendar libraries use (date-fns addHours / addDays / addMonths): hours and minutes are exact
 * elapsed time; days and weeks keep the clock time across a daylight-saving change; months and years land on the same day
 * of the month, or its last day when that month is shorter (Jan 31 + 1 month = Feb 28, or 29 in a leap year). What it adds:
 * one ask in plain words, the state of each step, a "mark met" tap kept in this browser, and a card that keeps itself
 * current every minute. It gives dates only: no claim about which rule sets a deadline.
 */
import { keepLive } from './live.js';

const HOUR = 3600000, MIN = 60000;
const DEFAULT_CHAIN = '24 hours, 72 hours, 14 days, 1 month';
const UNIT = { m: 'minute', h: 'hour', d: 'day', w: 'week', mo: 'month', y: 'year' };
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const STORE = 'a2m.deadlines.met.v1';

// one step of the chain: "24 hours", "3d", "2 wks", "a month"
const STEP_RE = /\b(\d{1,4}|an?|one)\s*(minutes?|mins?|hours?|hrs?|h|days?|d|weeks?|wks?|w|months?|mos?|years?|yrs?|y)\b/g;
function unitOf(u) {
  if (/^min/.test(u)) return 'm';
  if (/^(?:hours?|hrs?|h)$/.test(u)) return 'h';
  if (/^(?:days?|d)$/.test(u)) return 'd';
  if (/^(?:weeks?|wks?|w)$/.test(u)) return 'w';
  if (/^(?:months?|mos?)$/.test(u)) return 'mo';
  return 'y';
}
export function stepsOf(s) {
  const out = []; let m; STEP_RE.lastIndex = 0;
  while ((m = STEP_RE.exec(s))) {
    const n = /^\d/.test(m[1]) ? Number(m[1]) : 1, unit = unitOf(m[2]);
    if (n < 1) continue;
    out.push({ n, unit, label: n + ' ' + UNIT[unit] + (n === 1 ? '' : 's'), at: m.index });
  }
  return out;
}

/** start + one step, in local time. Hours and minutes are exact elapsed time; days and weeks keep the clock time; months
 *  and years keep the day of the month, or take the month's last day when it is shorter. Pure (given the time zone). */
export function addStep(start, step) {
  const d = new Date(start.getTime());
  if (step.unit === 'm') return new Date(d.getTime() + step.n * MIN);
  if (step.unit === 'h') return new Date(d.getTime() + step.n * HOUR);
  if (step.unit === 'd' || step.unit === 'w') {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + step.n * (step.unit === 'w' ? 7 : 1), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  }
  return addMonths(d, step.unit === 'y' ? step.n * 12 : step.n);
}
export function addMonths(d, n) {
  const target = d.getMonth() + n, y = d.getFullYear() + Math.floor(target / 12), mo = ((target % 12) + 12) % 12;
  const last = new Date(y, mo + 1, 0).getDate();
  return new Date(y, mo, Math.min(d.getDate(), last), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

// "9am", "9:30 pm", "14:00", "noon", "midnight" -> { h, m }
function clockOf(s) {
  if (/\bnoon\b/.test(s)) return { h: 12, m: 0 };
  if (/\bmidnight\b/.test(s)) return { h: 0, m: 0 };
  let m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?=\s|$|[,.;])/);
  if (m) { let h = Number(m[1]); const mi = Number(m[2] || 0); if (h < 1 || h > 12 || mi > 59) return null;
    if (/^p/.test(m[3])) h = h === 12 ? 12 : h + 12; else h = h === 12 ? 0 : h; return { h, m: mi }; }
  m = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m) { const h = Number(m[1]), mi = Number(m[2]); return h < 24 && mi < 60 ? { h, m: mi } : null; }
  return null;
}
const realDate = (y, mo, d) => { const t = new Date(y, mo, d); return t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d; };
// the day the start clause names, at midnight local (null when it names none)
function dayOf(s, now) {
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return realDate(+m[1], +m[2] - 1, +m[3]) ? new Date(+m[1], +m[2] - 1, +m[3]) : undefined;
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/); // 10/15/2026, read month first
  if (m) return realDate(+m[3], +m[1] - 1, +m[2]) ? new Date(+m[3], +m[1] - 1, +m[2]) : undefined;
  const mon = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
  m = s.match(new RegExp('\\b' + mon + '\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b')) || null;
  let mo, day, y;
  if (m) { mo = MONTHS.indexOf(m[1]); day = +m[2]; y = m[3] ? +m[3] : null; }
  else { m = s.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + mon + '(?:,?\\s+(\\d{4}))?\\b'));
    if (m) { day = +m[1]; mo = MONTHS.indexOf(m[2]); y = m[3] ? +m[3] : null; } }
  if (m) { // a day with no year: this year's, or last year's when this year's is still ahead (a chain starts in the past)
    if (y == null) { y = now.getFullYear(); if (new Date(y, mo, day) > now) y -= 1; }
    return realDate(y, mo, day) ? new Date(y, mo, day) : undefined;
  }
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\btoday\b|\bnow\b|\btonight\b|\bthis (?:morning|afternoon|evening)\b/.test(s)) return base;
  if (/\byesterday\b/.test(s)) return new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1);
  if (/\btomorrow\b/.test(s)) return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
  m = s.match(/\b(last|next|this)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (m) { const want = WEEKDAYS.indexOf(m[2]), have = base.getDay();
    // a chain started on a weekday: the latest one on or before today ("last" skips today); "next" is the coming one
    let delta = m[1] === 'next' ? ((want - have + 7) % 7 || 7) : -(((have - want) + 7) % 7);
    if (m[1] === 'last' && delta === 0) delta = -7;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta); }
  return null;
}

/** what the ask says: { start, startSaid, steps, defaulted } or null when it is not a deadline chain. Pure but for `now`. */
export function deadlinesOf(text, now = new Date()) {
  const t = String(text || '').toLowerCase().replace(/[’']/g, "'").replace(/[?!]+$/, '').replace(/\s+/g, ' ').trim();
  if (!/\bdeadlines?\b/.test(t)) return null;
  if (/\b(?:what(?:'s| is| are)|define|meaning of|synonyms?)\s+(?:a\s+)?deadlines?\b/.test(t) && !/\bmy\b/.test(t)) return null;
  if (/\b(?:remind|reminder|alarm|timer)\b/.test(t)) return null;
  // the start: after "from", "since", "started", "starting", "start(s) on/at", up to the colon or the first step
  const sm = /\b(?:from|since|started(?:\s+on|\s+at)?|starting(?:\s+on|\s+at)?|starts?\s+(?:on|at)|began(?:\s+on|\s+at)?|beginning)\s+/.exec(t);
  const from = sm ? sm.index + sm[0].length : -1;
  const colon = t.search(/:(?!\d{2})/); // "today: 24 hours" splits there; the colon in "14:00" does not
  let clause = '', steps;
  if (colon >= 0) { steps = stepsOf(t.slice(colon + 1)); if (sm && from <= colon) clause = t.slice(from, colon); }
  else if (sm) { const region = t.slice(from), after = stepsOf(region);
    clause = after.length ? region.slice(0, after[0].at) : region;
    steps = stepsOf(t.slice(0, sm.index)).concat(after); }
  else steps = stepsOf(t);
  if (!sm && !steps.length) return null;
  if (!/\b(?:deadline chain|deadlines|deadline (?:dates|schedule|timeline|clock))\b/.test(t) && !steps.length) return null;
  let start;
  const said = clause.replace(/[,:;\s]+$/, '').trim();
  if (!said || /^(?:now|right now)$/.test(said)) start = new Date(Math.floor(now.getTime() / MIN) * MIN);
  else {
    const day = dayOf(said, now), clock = clockOf(said);
    if (day === undefined) return null; // a date that does not exist (february 30)
    if (!day && !clock) return null;
    const base = day || new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (clock) start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), clock.h, clock.m);
    else if (/\btoday\b|\bnow\b/.test(said) && !/\bmidnight\b/.test(said)) start = new Date(Math.floor(now.getTime() / MIN) * MIN); // "from today": from this minute
    else start = base;
  }
  const defaulted = !steps.length;
  if (defaulted) steps = stepsOf(DEFAULT_CHAIN);
  return { start, startSaid: said || 'now', steps: steps.map(({ n, unit, label }) => ({ n, unit, label })), defaulted };
}

/** the chain in time order, each with its due moment; the same step said twice is shown once. Pure. */
export function chainOf(start, steps) {
  const seen = new Set(), out = [];
  for (const s of steps) { const due = addStep(start, s); if (seen.has(due.getTime())) continue; seen.add(due.getTime()); out.push({ ...s, due }); }
  return out.sort((a, b) => a.due - b.due);
}

/** pending / soon / passed / met: due soon when under a tenth of its window is left, or under 2 hours. Pure. */
export function stateOf(now, start, due, met) {
  if (met) return 'met';
  const left = due.getTime() - now.getTime();
  if (left <= 0) return 'passed';
  const windowMs = Math.max(0, due.getTime() - start.getTime());
  return left < Math.max(windowMs * 0.1, 2 * HOUR) ? 'soon' : 'pending';
}

/** "in 2 days 3 h", "5 h 10 min ago", "now". Pure. */
export function spanText(ms) {
  const a = Math.abs(ms);
  if (a < MIN) return 'now';
  const d = Math.floor(a / (24 * HOUR)), h = Math.floor((a % (24 * HOUR)) / HOUR), m = Math.floor((a % HOUR) / MIN);
  const parts = d ? [d + (d === 1 ? ' day' : ' days'), h ? h + ' h' : ''] : h ? [h + ' h', m ? m + ' min' : ''] : [m + ' min'];
  const s = parts.filter(Boolean).join(' ');
  return ms > 0 ? 'in ' + s : s + ' ago';
}

const STATE_WORD = { pending: 'pending', soon: 'due soon', passed: 'passed', met: 'met' };
const keyOf = (start, steps) => start.getTime() + '|' + steps.map((s) => s.n + s.unit).join(',');
function readMet() { try { const v = JSON.parse(localStorage.getItem(STORE) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
function writeMet(all) { try { localStorage.setItem(STORE, JSON.stringify(all)); } catch (_) {} }

function zoneName() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; } }
function when(d) {
  try { return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }); }
  catch (_) { return d.toString(); }
}

const CSS = '.dl-list{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:0}'
  + '.dl-row{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;padding:10px 2px;border-top:1px solid rgba(255,255,255,.07)}'
  + '.dl-step{font-size:var(--fs-s,13px);color:var(--d-ink-3,#8e94a8);letter-spacing:.01em}'
  + '.dl-when{font-size:var(--fs-m,15px);color:var(--d-ink,#f2f4fb);font-variant-numeric:tabular-nums}'
  + '.dl-left{font-size:var(--fs-s,13px);color:var(--d-ink-2,#c3c8d8);font-variant-numeric:tabular-nums}'
  + '.dl-side{grid-row:1 / span 3;grid-column:2;display:flex;flex-direction:column;align-items:flex-end;gap:6px}'
  + '.dl-state{font-size:var(--fs-xs,12px);padding:2px 9px;border-radius:999px;border:1px solid rgb(var(--d-key,158 178 255) / .45);color:var(--d-ink-2,#c3c8d8);white-space:nowrap}'
  + '.dl-row[data-state="soon"] .dl-state{border-color:rgb(var(--d-warm,255 170 214) / .7);background:rgb(var(--d-warm,255 170 214) / .14);color:var(--d-ink,#f2f4fb)}'
  + '.dl-row[data-state="passed"] .dl-state{border-color:rgba(255,255,255,.16);color:var(--d-ink-3,#8e94a8)}'
  + '.dl-row[data-state="met"] .dl-state{border-color:transparent;background:rgb(var(--d-key,158 178 255) / .22);color:var(--d-ink,#f2f4fb)}'
  + '.dl-row[data-state="met"] .dl-when,.dl-row[data-state="met"] .dl-left{color:var(--d-ink-3,#8e94a8)}'
  + '.dl-met{font:inherit;font-size:var(--fs-s,13px);min-height:44px;min-width:44px;padding:0 14px;border-radius:999px;cursor:pointer;color:var(--d-ink,#f2f4fb);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.13)}'
  + '.dl-met:hover,.dl-met:focus-visible{background:rgba(255,255,255,.12)}'
  + '.dl-met:focus-visible{outline:2px solid rgb(var(--d-key,158 178 255));outline-offset:2px}';

function run(text, api) {
  const { showPage, esc } = api;
  const got = deadlinesOf(text, new Date());
  if (!got) return 'none';
  const { start, startSaid, steps, defaulted } = got;
  const chain = chainOf(start, steps), key = keyOf(start, steps), zone = zoneName();
  const draw = (el) => {
    const now = new Date(), met = new Set((readMet()[key] || []).map(String));
    const rows = chain.map((c, i) => {
      const id = c.n + c.unit, isMet = met.has(id), st = stateOf(now, start, c.due, isMet);
      return '<li class="dl-row" data-state="' + st + '" data-i="' + i + '">'
        + '<div class="dl-step">' + esc(c.label) + '</div>'
        + '<div class="dl-when">' + esc(when(c.due)) + '</div>'
        + '<div class="dl-left">' + esc(spanText(c.due - now)) + '</div>'
        + '<div class="dl-side"><span class="dl-state">' + esc(STATE_WORD[st]) + '</span>'
        + '<button type="button" class="dl-met" data-id="' + esc(id) + '" aria-pressed="' + isMet + '">' + (isMet ? 'undo' : 'mark met') + '</button></div></li>';
    }).join('');
    el.innerHTML = '<style>' + CSS + '</style><h2>Deadlines</h2>'
      + '<div class="sub">From ' + esc(when(start)) + (zone ? ' · ' + esc(zone) : '') + (defaulted ? ' · the common chain; say your own, like “deadlines from monday: 2 days, 1 week”' : '') + '</div>'
      + '<ul class="dl-list">' + rows + '</ul>'
      + '<div class="src">Your clock and time zone · hours are exact; days and months keep the clock time; a month from the 31st lands on the month’s last day · just the dates, not advice on which rule applies · marks stay in this browser</div>';
  };
  const el = showPage((p) => { p.classList.add('deadlines-card'); draw(p); });
  if (!el) return 'deadlines';
  el.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.dl-met'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const all = readMet(), list = new Set(all[key] || []), id = b.getAttribute('data-id');
    if (list.has(id)) list.delete(id); else list.add(id);
    all[key] = [...list]; writeMet(all); draw(el); if (live) live.stamp();
  });
  // keeps itself current every minute while the card is open (skills/live.js: stops when the card goes, waits while the tab is hidden)
  const present = typeof api._pageStill === 'function' ? () => api._pageStill(el) : () => el.isConnected;
  const live = keepLive(api, el, { name: 'deadlines', every: MIN, refresh: async () => draw(el), present });
  return 'deadlines';
}

export default {
  name: 'deadlines',
  examples: [
    'deadline chain from today: 24 hours, 72 hours, 14 days',
    'when are my deadlines if it started monday 9am: 1 day, 3 days, 2 weeks, 1 month',
    'reporting deadlines from 2026-10-15 14:00',
    'deadlines from yesterday 3pm: 24h, 72h, 14d',
    'my deadlines starting oct 1: 30 days, 60 days, 90 days'
  ],
  nearMisses: [
    'days until christmas',
    'remind me in 2 hours',
    'what is a deadline',
    'set a timer for 24 hours'
  ],
  match(lower, text) { return !!deadlinesOf(text || lower); },
  run
};
