/**
 * calendar skill — a quiet timeline on the stage, from the same input as everything else.
 * No date picker, no account, no third-party script. Events live in this browser only.
 * Contract: { name, examples, match(lower, text), run(text, api) }
 *
 * Gated asks ("add X to my calendar", "schedule a meeting with …") stay on the confirm line.
 * This file only shows the local agenda and adds events that are not those gated sentences.
 */
import { show3d } from './calendar3d.js';
import { countdownOf } from './countdown.js';
import { pickKind } from '../lib/media.js';
import { mirror } from '../lib/chat-calendar.js';
import * as A from '../lib/agenda.js';
// the longest ask still read as an event to add ("lunch with Ana and Sam at the cafe on Main Street next Tuesday at noon" is 14)
export const MAX_EVENT_WORDS = 16;
const CLEAN = (s) => String(s || '').replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();

function gated(text) {
  const s = CLEAN(text).replace(/^(?:please\s+)/i, '');
  if (/^schedule\s+(?:a\s+|an\s+)?(?:meeting|call)\s+with\b/i.test(s)) return true;
  if (/^book\s+(?:a\s+|an\s+)?(?:meeting|call)\s+with\b/i.test(s)) return true;
  // "pace for a 5k in 25 minutes": running maths, not a date
  if (/^(?:what(?:'s|\s+is)\s+(?:the\s+|my\s+)?)?pace\s+(?:for|to\s+run)\b|\bin\s+[\d:.]+\s*(?:minutes?|mins?|hours?|hrs?)?\s+pace$/i.test(s)) return true;
  // "double 3/4 cup", "half of 2/3 cup": recipe maths, not a date
  if (/^(?:double|triple|halve|half\s+of|a\s+third\s+of|quarter\s+of)\s+\d+\s*\/\s*\d+(?:\s+(?:cups?|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lbs?|ounces?|oz))?$/i.test(s)) return true;
  // "hours from 8:30am to 4pm": clock maths, not an event
  if (/^(?:how\s+(?:many\s+(?:hours|minutes)|long|much\s+time)\s+(?:is\s+(?:it\s+)?)?|(?:the\s+)?(?:hours|time|minutes)\s+)(?:between|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\s+(?:and|to|until|till)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\??$/i.test(s)) return true;
  // "simplify 18/24", "reduce 6/8": a fraction, not a date
  if (/^(?:simplify|reduce)\s+(?:the\s+)?(?:ratio\s+)?\d+\s*[/:]\s*\d+$/i.test(s)) return true;
  // "remind me to stretch in 20 minutes": a timer from now, not a calendar entry
  if (/^(?:remind|wake|ping|alert|buzz)\s+me\b.*\bin\s+(?:\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|half\s+an?)\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/i.test(s)) return true;
  return false;
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY = '(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?';
const TIME = '(?:at\\s+)?(noon|midnight|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)?)';

// Parse the when out of an ask. Returns { at: Date, allDay, title } or null when there is no date or time in it.
function parseWhenText(text, now = new Date()) {
  let s = ' ' + text.replace(/[,.!?]+(\s|$)/g, ' ').replace(/\s+/g, ' ') + ' ';
  const cut = (re, keep) => { const m = s.match(new RegExp(re.source, 'i')); if (m && (!keep || keep(m))) { s = s.replace(m[0], ' '); return Array.from(m, (x) => (x == null ? x : x.toLowerCase())); } return null; };
  const evening = /\b(dinner|tonight|evening|night|drinks|party)\b/i.test(text);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let dated = false, m;
  if ((m = cut(/\s(?:on\s+)?(today|tonight|tomorrow|tmrw|day after tomorrow)\s/))) { dated = true; d.setDate(d.getDate() + ({ today: 0, tonight: 0, tomorrow: 1, tmrw: 1 }[m[1]] ?? 2)); }
  else if ((m = cut(/\sin\s+(\d+|a|an|one|two|three)\s+(day|week)s?\s/))) { dated = true; const n = { a: 1, an: 1, one: 1, two: 2, three: 3 }[m[1]] || +m[1]; d.setDate(d.getDate() + n * (m[2] === 'week' ? 7 : 1)); }
  else if ((m = cut(new RegExp('\\s(?:on\\s+)?(?:(this|next)\\s+)?' + DAY + '\\s'))) || (m = cut(new RegExp('\\s(?:on\\s+)?(?:(this|next)\\s+)?' + DAY + '(?=\\s)')))) {
    dated = true; const want = DAYS.findIndex((x) => x.startsWith(m[2].slice(0, 3)));
    let ahead = (want - d.getDay() + 7) % 7 || 7; // the coming one, never today
    if (m[1] === 'next' && ahead < 7 && d.getDay() !== 0 && want > d.getDay()) ahead += 7; // "next tuesday" said on a monday = the tuesday after this one
    d.setDate(d.getDate() + ahead);
  } else if ((m = cut(new RegExp('\\s(?:on\\s+)?' + MON + '\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\s'))) || (m = cut(new RegExp('\\s(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + MON + '(?:\\s+(\\d{4}))?\\s')))) {
    dated = true; const [mon, day] = /^\d/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
    d.setMonth(MONTHS.indexOf(mon.slice(0, 3)), +day); if (m[3]) d.setFullYear(+m[3]); else if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setFullYear(d.getFullYear() + 1);
  } else if ((m = cut(/\s(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s/))) {
    dated = true; d.setMonth(+m[1] - 1, +m[2]); if (m[3]) d.setFullYear(+m[3] < 100 ? 2000 + +m[3] : +m[3]); else if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setFullYear(d.getFullYear() + 1);
  }
  let timed = false;
  if ((m = cut(/\sin\s+(\d+|an|a|one|two)\s+(hour|minute|min)s?\s/))) {
    const n = { a: 1, an: 1, one: 1, two: 2 }[m[1]] || +m[1]; const t = new Date(now.getTime() + n * (m[2] === 'hour' ? 3600e3 : 60e3));
    return { at: t, allDay: false, title: tidy(s) };
  }
  if ((m = cut(new RegExp('\\s' + TIME + '(?=\\s)'), (x) => /at\s/i.test(x[0]) || /noon|midnight|am|pm|a\.m|p\.m|:/i.test(x[1])))) {
    timed = true; let [h, mi] = m[1] === 'noon' ? [12, 0] : m[1] === 'midnight' ? [0, 0] : [parseInt(m[1], 10), +(m[1].split(':')[1] || '0').slice(0, 2)];
    const ap = (m[1].match(/[ap]/) || [])[0];
    if (ap === 'p' && h < 12) h += 12; else if (ap === 'a' && h === 12) h = 0; else if (!ap && !/:/.test(m[1]) && h >= 1 && (h <= 7 || (evening && h < 12))) h += 12; // "at 4" = 4 pm, "dinner at 8" = 8 pm
    if (h > 23 || mi > 59) return null;
    d.setHours(h, mi, 0, 0);
    if (!dated && d < now) d.setDate(d.getDate() + 1); // "at 9" after 9 today = tomorrow
  }
  if (!dated && !timed) return null;
  return { at: d, allDay: !timed, title: tidy(s) };
}
function tidy(s) {
  return s.replace(/\b(Add|Put|Schedule|Book|Remind)\b/g, (w) => w.toLowerCase()).replace(/\b(add|put|schedule|book|set up|remind me to|remind me|to my (calendar|calender|agenda)|on my (calendar|calender|agenda)|in my (calendar|calender|agenda)|my (calendar|calender|agenda)|calendar|calender|agenda|please)\b/g, ' ')
    .replace(/^\s*(a|an|the|this|to)\s+/, ' ').replace(/\s+(on|at|for|by)\s*$/, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase()) || 'Event';
}


export function parseCalendar(text) {
  if (gated(text)) return null;
  const t = CLEAN(text);
  // "days until new year", "days until december 25": that is a countdown, not an agenda.
  // The ask carries a date, so parseWhenText would claim it - hand it to the countdown skill.
  if (countdownOf(t)) return null;
  // "good movies to watch tonight" asks for a pick, not an event called "Good movies to watch" (2026-10-30: it was saved as one)
  if (pickKind(t)) return null;
  // "add dentist to my calendar Oct 12 at 3" / "put lunch with Ana on my calendar tomorrow at noon": your own calendar, saved here
  const own = t.match(/^(?:please\s+)?(?:add|put)\s+(.+?)\s+(?:to|on|in)\s+my\s+(?:calendar|calender|agenda)(?:\s+(.+))?$/i);
  if (own) {
    const inner = parseCalendar(own[1] + (own[2] ? ' ' + own[2].replace(/^(?:for|on)\s+/i, '') : ''));
    if (inner && inner.kind === 'add') return { ...inner, raw: t };
    const what = CLEAN(own[1]).replace(/^(?:a|an|the)\s+/i, '');
    return { kind: 'when', title: /^(this|that|it)$/i.test(what) ? '' : what };
  }
  if (/^(?:show\s+(?:me\s+)?)?(?:my\s+)?(?:the\s+)?(?:calender|calendar|agenda)\b/i.test(t)
    || /^(?:what'?s|whats)\s+(?:next|on(?:\s+today)?|coming\s+up)\b/i.test(t)
    || /^(?:upcoming|my agenda)\b(?!\s+(?:public\s+|bank\s+)?holidays?\b)/i.test(t)) { // "upcoming holidays" is the holiday list
    return { kind: 'show' };
  }
  // "clear calendar" / "delete all my events": empties it, after one tap (it can't be undone)
  if (/^(?:clear|empty|wipe|erase|reset|delete\s+all(?:\s+of)?)\s+(?:out\s+)?(?:my\s+|the\s+)?(?:calender|calendar|agenda)(?:\s+events)?$/i.test(t)
    || /^(?:clear|delete|remove|erase)\s+(?:all\s+)?(?:of\s+)?(?:my\s+)?(?:calendar\s+|calender\s+)?events$/i.test(t)) {
    return { kind: 'clear' };
  }
  if (/^(?:remove|close|hide|dismiss)\s+(?:my\s+)?(?:the\s+)?(?:calender|calendar|agenda)\b/i.test(t)) {
    return { kind: 'hide' };
  }
  // an add needs a when in it: "call Sam next Tuesday at 4", "dentist Oct 12 at 3pm", "gym at 7pm", "pay rent in 3 days"
  if (/^(?:what|whats|who|whos|why|how|hows|when|whens|where|wheres|is|are|does|do|can|define|translate|weather|time|map|make|set|start)\b/i.test(t)) return null;
  if (/^(?:the\s+|today'?s\s+|live\s+)?[\w .'-]{0,40}\b(?:scores?|league\s+table|standings)(?:\s+(?:today|tonight|now|live|yesterday))?$/i.test(t)) return null; // the scores skill ("premier league scores today" is not an event)
  if (/\b(timer|clock|sticky|notepad|counter|countdown|shape|calculator)\b/i.test(t)) return null;
  if (/^(?:the\s+|today'?s\s+)?(?:\w+\s+)?(?:news|headlines|top\s+stories)\b/i.test(t)) return null; // the news skill ("tech news today" is not an event)
  if (/\b(hours?\s+between|days?\s+between|time\s+difference|how\s+many\s+(hours|days)|how\s+long\s+until)\b/i.test(t)) return null; // world time and the calculator answer these
  if (/\bwhat\s+time\s+(?:is\s+it|will\s+it\s+be)\b/i.test(t)) return null; // "if it's 3pm in new york what time is it in paris" is world time
  if (/^\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i.test(t) || /\b(sunrise|sunset|time zone|timezone)\b/i.test(t)) return null; // "3pm London to Tokyo" is world time; an event starts with what it is
  if (/^(?:please\s+)?(?:wake\s+me(?:\s+up)?|(?:set|make|start)\s+(?:an?\s+|my\s+)?alarm|alarm)\s+(?:for|at)\s+\d/i.test(t)) return null; // an alarm rings: the timer counts down to it
  // a request for work is not an event (owner's review, 2026-10-30: "Review what Verse's loop shipped since the last summary ..." was saved
  // as a calendar event): an ask that opens with a work verb, or runs past MAX_EVENT_WORDS words, has no event in it; the explicit forms
  // ("add X to my calendar", "remind me to ...") were taken above or below and keep any length
  if (/^(?:please\s+)?(?:review|summari[sz]e|list|explain|analy[sz]e|compare|audit|describe|tell\s+me|give\s+me|look\s+at|go\s+through|walk\s+me)\b/i.test(t)) return null;
  if (!/^(?:please\s+)?remind\s+me\b/i.test(t) && t.split(/\s+/).length > MAX_EVENT_WORDS) return null;
  const w = parseWhenText(t);
  // "remind me to call mom" with no when: it goes on today, so it is kept rather than lost
  if (!w) { const r = t.match(/^(?:please\s+)?remind\s+me\s+(?:to|about)\s+(.{2,80})$/i); if (r) { const d = new Date(); d.setHours(0, 0, 0, 0); return { kind: 'add', title: tidy(r[1]), at: d, allDay: true, raw: t }; } }
  if (!w || !w.title || w.title === 'Event' || w.title.length < 2) return null;
  return { kind: 'add', title: w.title, at: w.at, allDay: w.allDay, raw: t };
}

// one store: the /calendar/ page's (lib/agenda.js), so the card, the page and chat edits ("move the dentist to Tuesday") show the same events
const ONE_DAY = 864e5;
/** what is coming up, as rows { id, title, at, allDay }: from an hour ago (a day for an all-day one) to a year on, repeats included */
function load() {
  const now = Date.now();
  return A.rowsOf(A.events(), new Date(now - ONE_DAY), new Date(now + 400 * ONE_DAY)).filter((r) => new Date(r.at).getTime() + (r.allDay ? ONE_DAY : 36e5) >= now);
}

function fmtWhen(iso) {
  const at = new Date(iso);
  return new Intl.DateTimeFormat([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(at);
}

function draw(el, api) {
  const { esc } = api;
  const rows = load().slice(0, 8);
  let body;
  if (!rows.length) {
    body = '<div class="sub">Nothing coming up. Type something like "call Sam next Tuesday at 4".</div>';
  } else {
    body = rows.map((r) => '<div style="display:flex;gap:14px;align-items:baseline;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">'
      + '<div class="sub" style="min-width:9.5em">' + esc(fmtWhen(r.at)) + '</div>'
      + '<div>' + esc(r.title) + '</div></div>').join('');
  }
  el.innerHTML = '<h2>Coming up</h2>' + body
    + '<div class="src">Saved in this browser only</div>';
}

async function run(text, api) {
  const { showPage } = api;
  const q = parseCalendar(text);
  if (!q) return 'none';
  if (q.kind === 'hide') {
    if (api.summon) { api.summon('calendar', { hide: true }); api.say && api.say('calendar put away, your events are kept'); }
    else if (api.dismissPage) api.dismissPage();
    else if (api.closePage) api.closePage();
    return 'calendar';
  }
  if (q.kind === 'clear') {
    const n = A.events().length;
    if (!n) { if (api.say) api.say('your calendar is already empty'); return 'calendar'; }
    const el = showPage((p) => { p.innerHTML = '<h2>Clear your calendar?</h2><div class="sub">' + n + ' event' + (n === 1 ? '' : 's')
      + ' saved in this browser. This can\'t be undone.</div><button type="button" class="tr-copy cal-clear" style="margin-top:12px">clear all ' + n + '</button>'; });
    const b = el.querySelector('.cal-clear');
    if (b) b.addEventListener('click', () => { A.write([]); draw(el, api); if (api.say) api.say('calendar cleared'); if (api.summon) api.summon('calendar', { hide: true }); });
    return 'calendar';
  }
  if (q.kind === 'when') {
    if (api.say) api.say('when? e.g. "add ' + (q.title || 'dentist') + ' to my calendar Oct 12 at 3"');
    return 'calendar';
  }
  if (q.kind === 'add') {
    // into the Calendar page's own events, read by the page's quickAdd (length, repeat, reminder) and said in words so a wrong reading shows;
    // when the page reads nothing from it the card's own reading is kept as it is (an hour, or all day)
    const S = A.read(); let line = '';
    try { const m = mirror(S, q.raw || q.title, new Date(), navigator.language || 'en'); if (m) { A.write(m.store.events); line = m.line; } } catch (_) {}
    if (!line) { const dup = S.events.some((e) => e.title.toLowerCase() === q.title.toLowerCase() && Math.abs(new Date(e.start) - q.at) < 6e4); if (!dup) A.write(A.withNew(S.events, { title: q.title.slice(0, 160), at: q.at, allDay: q.allDay })); }
    if (api.say) api.say('on your calendar: ' + q.title + ', ' + fmtWhen(q.at.toISOString()) + (line ? ' (in the Calendar page: ' + line + ')' : ''));
  }
  if (api.summon) api.summon('calendar'); // the card on the stage (mount below)
  if (q.kind === 'show') show3d(api); // and the 3D wall calendar; an add only says so (the card shows it)
  return 'calendar';
}

// the card on the stage (moved out of void.html in cleanup step 6): upcoming events from this browser's agenda, a day
// header for each day, × to take one off (undo brings it back)
function mount(th, stageApi) {
  const up = load();
  const el = document.createElement('div');
  el.className = 'thing calendar-card';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px'; el.style.top = th.y + 'px'; // the planner look is the page's .thing.calendar-card
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  const head = document.createElement('div');
  head.className = 'cal-head';
  head.textContent = 'Calendar';
  el.appendChild(head);
  if (!up.length) {
    const none = document.createElement('div'); none.className = 'cal-none';
    none.textContent = 'Nothing coming up. Try “call Sam next Tuesday at 4”.'; el.appendChild(none);
  }
  let lastDay = '';
  up.slice(0, 30).forEach((ev) => {
    const t = new Date(ev.at), day = t.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    if (day !== lastDay) { const d = document.createElement('div'); d.className = 'cal-day'; d.textContent = t.toDateString() === new Date().toDateString() ? 'Today' : day; el.appendChild(d); lastDay = day; }
    const row = document.createElement('div'); row.className = 'cal-event';
    const when = document.createElement('span'); when.className = 'cal-when';
    when.textContent = ev.allDay ? 'all day' : t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const what = document.createElement('span'); what.className = 'cal-what'; what.textContent = ev.title || 'Event';
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'remove ' + (ev.title || 'event'));
    x.className = 'cal-x';
    x.addEventListener('pointerdown', (e) => e.stopPropagation());
    x.addEventListener('click', () => { stageApi.snapshot(); A.write(A.withoutRow(A.events(), ev.id)); stageApi.render(); });
    row.appendChild(when); row.appendChild(what); row.appendChild(x); el.appendChild(row);
  });
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** summon('calendar'): one card (shown again, never a second), { hide: true } takes it off; the events stay */
function summon(stageApi, opts = {}) {
  const things = stageApi.things(), st = stageApi.stage;
  let th = Object.values(things).find((t) => t && t.kind === 'calendar');
  if (opts.hide) { if (th) { delete things[th.id]; if (stageApi.selected() === th.id) stageApi.select(null); } stageApi.save(); stageApi.render(); return null; }
  if (!th) { th = { id: 'calendar_' + Math.random().toString(36).slice(2, 9), kind: 'calendar', x: Math.max(16, Math.min((st.clientWidth || 800) - 300, (st.clientWidth || 800) - 340)), y: 60 }; things[th.id] = th; }
  stageApi.select(th.id); stageApi.save(); stageApi.render(); return th;
}

export default {
  name: 'calendar',
  examples: ['my calendar', 'agenda', "what's next", 'call Sam next Tuesday at 4', 'dentist October 12 at 3pm', 'clear calender'],
  nearMisses: ['make a 5 minute timer', 'what is a calendar', 'schedule a meeting with Sam', 'book a call with Sam', 'time in Tokyo', 'clear the stage'],
  match(lower, text) { return !!parseCalendar(text); },
  run,
  stageKinds: { calendar: { mount, summon } },
};
