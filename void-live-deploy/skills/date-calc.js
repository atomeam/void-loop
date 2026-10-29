/**
 * date-calc skill — date math answered as a small card (tools pack 11, owner 2026-10-18, DATES & CALENDARS 341-400): "30 days
 * after 2026-03-01", "10 business days from today", "next monday", "end of this quarter", "iso week start", "format 2026-10-03 as us",
 * "do oct 1 to oct 10 and oct 8 to oct 20 overlap", "every 10 days from 2026-10-01 skipping 2026-10-10", "days since 2026-01-01",
 * "next birthday 1990-05-03", "zodiac sign for march 3", "moon phase on 2026-10-18", "time until midnight", "round 47 minutes to 15",
 * "deadline risk 2026-10-20", "snooze until monday", "do 10-11 and 10:30-12 conflict", "convert 9am new york to tokyo",
 * "meeting 9am new york across london and tokyo", "visa expires 2027-03-01", "subscription renews monthly from 2026-01-31",
 * "warranty 24 months from 2025-11-01", "lease from 2026-01-01 for 12 months", "school term 2026-09-01 to 2026-12-18",
 * "biweekly payday 2026-10-09", "sprint 2 weeks starting 2026-10-05", "fiscal year starting april".
 * All the math is lib/date-math.js (pure, UTC day numbers, "today" passed in) and the wording is lib/date-ask.js. Nothing is looked up
 * or sent; dates only, never money. It sits ahead of dates (calendar, countdown) and deadlines in the routing order, but takes only asks
 * that carry their own dates or numbers, so "days until christmas", "days between ..." (the calculator) and a calendar event pass by.
 */
import { dateAsk } from '../lib/date-ask.js';
import { localDay } from '../lib/stage-pack.js';

const nowMinutes = (d = new Date()) => d.getHours() * 60 + d.getMinutes();
const ctx = () => ({ today: localDay(), nowMin: nowMinutes() });

const CSS = '.dc-rows{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:8px 0 0}'
  + '.dc-k{font-size:var(--fs-s,13px);color:var(--d-ink-3,#8e94a8)}'
  + '.dc-v{font-size:var(--fs-m,15px);color:var(--d-ink,#f2f4fb);font-variant-numeric:tabular-nums}'
  + '.dc-light{display:inline-block;width:14px;height:14px;border-radius:50%;margin-right:8px;vertical-align:-2px;border:1px solid rgba(255,255,255,.3)}'
  + '.dc-light[data-light="red"]{background:#e5534b}.dc-light[data-light="amber"]{background:#e3a63a}.dc-light[data-light="green"]{background:#4caf6e}';

function run(text, api) {
  const { showPage, esc } = api;
  const r = dateAsk(text, ctx());
  if (!r) return 'none';
  showPage((el) => {
    el.classList.add('date-calc-card');
    el.dataset.kind = r.kind;
    el.innerHTML = '<style>' + CSS + '</style><h2>' + (r.light ? '<span class="dc-light" data-light="' + esc(r.light) + '" role="img" aria-label="' + esc(r.light) + '"></span>' : '') + esc(r.title) + '</h2>'
      + '<div class="dc-rows">' + r.rows.map(([k, v]) => '<div class="dc-k">' + esc(k) + '</div><div class="dc-v">' + esc(v) + '</div>').join('') + '</div>'
      + (r.note ? '<div class="sub">' + esc(r.note) + '</div>' : '')
      + '<div class="src">Worked out here from the dates you gave and your clock · nothing looked up or sent · dates only</div>';
  });
  return 'date-calc';
}

export default {
  name: 'date-calc',
  examples: [
    '30 days after 2026-03-01',
    '10 business days from today',
    'what date is next friday',
    'end of this quarter',
    'format 2026-10-03 as us',
    'every 10 days from 2026-10-01 for 4 times',
    'next birthday 1990-05-03',
    'zodiac sign for march 3',
    'deadline risk 2026-10-20',
    'meeting 9am new york across london and tokyo', // not "convert 9am new york to tokyo": worldtime (the time family) takes that one too, and an example is an ask only this skill claims
    'visa expires 2027-03-01',
    'sprint 2 weeks starting 2026-10-05',
    'fiscal year starting april'
  ],
  nearMisses: [
    'what is a sprint',
    'days until christmas',
    'lease a car',
    'what time is it in tokyo',
    'time in tokyo when it is 9am in new york',
    'call sam next tuesday at 4',
    'holidays in japan',
    'set a timer for 10 minutes',
    'how old am i'
  ],
  match(lower, text) { return !!dateAsk(text || lower, ctx()); },
  run
};
