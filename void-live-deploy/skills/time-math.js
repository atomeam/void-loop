/**
 * time-math skill — four small time questions answered on the spot, from the words alone (no network, nothing saved or sent):
 * "how long is a meeting from 9:30 to 11:15" (and "meeting at 9:30 for 45 minutes" for the end time, "meeting length
 * calculator" for the two-box form), "what week number is it" / "week number of oct 25" (ISO 8601 weeks, Monday to Sunday),
 * "age calculator" (a date box that gives years, months, days, days lived and the next birthday; "how old am I if I was born
 * 1990-05-03" already has its answer in the page, a plain number of years, and keeps it),
 * and "days since I quit coffee" / "days since march 3": a card on the stage with the count and a Reset button, kept with the
 * stage in this browser. Asked for by the owner (2026-10-18, items 33, 38, 39, 40). World clock, time zone conversion, the
 * stopwatch, the pomodoro and the alarm already exist (worldtime, the page's stopwatch, timer).
 */
import { parseMeeting, meetingLines, isMeetingCalc, isAgeCalc, parseWeek, weekCard, parseSince, daysSince, ageCard } from '../lib/time-math.js';
import { isoOf, labelOf, validIso } from '../lib/date-words.js';
import { addThing, cardEl, keepOut, localDay } from '../lib/stage-pack.js';

const big = 'font-size:44px;font-weight:300;line-height:1.15;margin:6px 0 4px';

function kindOf(text, now = new Date()) {
  if (isMeetingCalc(text)) return { kind: 'meeting-calc' };
  if (isAgeCalc(text)) return { kind: 'age-calc' };
  let r = parseMeeting(text); if (r) return { kind: 'meeting', r };
  r = parseWeek(text, now); if (r) return { kind: 'week', r };
  r = parseSince(text, now); if (r) return { kind: 'since', r };
  return null;
}

function mountSince(th, stageApi) {
  const today = localDay(), n = daysSince(th.start, today);
  const el = cardEl(th, stageApi, 'days-since');
  el.dataset.days = String(n); el.style.textAlign = 'center'; el.style.minWidth = '190px';
  const num = document.createElement('div'); num.className = 'ds-count'; num.textContent = String(n); num.style.cssText = 'font-size:56px;font-weight:300;line-height:1.05';
  const lab = document.createElement('div'); lab.className = 'ds-label'; lab.textContent = (n === 1 ? 'day' : 'days') + ' since ' + th.label; lab.style.fontSize = '14px';
  const sub = document.createElement('div'); sub.className = 'ds-start'; sub.textContent = 'since ' + labelOf(th.start); sub.style.cssText = 'font-size:11px;opacity:.65;margin:2px 0 8px';
  const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'ds-reset'; reset.textContent = 'Reset to today';
  reset.style.cssText = 'padding:4px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#e8e8e8;cursor:pointer;font:12px system-ui';
  reset.addEventListener('click', (e) => { e.stopPropagation(); th.start = localDay(); stageApi.save(); stageApi.render(); });
  el.append(num, lab, sub, keepOut(reset));
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

function meetingCalc(api) {
  const el = api.showPage((p) => { p.innerHTML = '<h2>Meeting length</h2><div style="display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:center;max-width:300px;margin:10px 0">'
    + '<label for="ml-a">Starts</label><input id="ml-a" type="time" value="09:00"><label for="ml-b">Ends</label><input id="ml-b" type="time" value="10:00"></div>'
    + '<div id="ml-out" aria-live="polite" style="font-size:24px;line-height:1.5"></div>'; });
  const a = el.querySelector('#ml-a'), b = el.querySelector('#ml-b'), out = el.querySelector('#ml-out');
  const upd = () => {
    if (!a.value || !b.value) { out.textContent = 'pick both times'; return; }
    const [sh, sm] = a.value.split(':').map(Number), [eh, em] = b.value.split(':').map(Number); let len = (eh * 60 + em) - (sh * 60 + sm); if (len < 0) len += 1440;
    const h = Math.floor(len / 60), m = len % 60; out.textContent = (h ? h + ' h ' : '') + m + ' min · ' + len + ' minutes'; };
  a.addEventListener('input', upd); b.addEventListener('input', upd); upd();
  return 'time-math';
}

function ageCalc(api, now) {
  const el = api.showPage((p) => { p.innerHTML = '<h2>Age calculator</h2><div style="display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:center;max-width:320px;margin:10px 0">'
    + '<label for="ac-b">Born</label><input id="ac-b" type="date"></div><div id="ac-out" aria-live="polite" style="font-size:20px;line-height:1.5">pick a birth date</div>'; });
  const inp = el.querySelector('#ac-b'), out = el.querySelector('#ac-out');
  inp.max = isoOf(now);
  inp.addEventListener('input', () => { const c = validIso(inp.value) ? ageCard(inp.value, isoOf(new Date())) : null; out.textContent = c ? c.line + ' · ' + c.totalDays.toLocaleString() + ' days · next birthday in ' + c.nextBirthdayIn + ' days' : 'pick a birth date'; });
  return 'time-math';
}

async function run(text, api) {
  const now = new Date(), k = kindOf(text, now);
  if (!k) return 'none';
  if (k.kind === 'meeting-calc') return meetingCalc(api);
  if (k.kind === 'age-calc') return ageCalc(api, now);
  if (k.kind === 'since') {
    const th = addThing(api.stage, 'dayssince', { label: k.r.label, start: k.r.start });
    api.stage.save(); api.stage.render();
    api.stage.say(daysSince(k.r.start, localDay()) + ' days since ' + k.r.label);
    return th ? 'time-math' : 'none';
  }
  const { showPage, esc } = api;
  if (k.kind === 'meeting') {
    const L = meetingLines(k.r);
    showPage((p) => { p.innerHTML = '<h2>Meeting length</h2><div class="sub">' + esc(L.span) + '</div><div style="' + big + '">' + esc(L.length) + '</div><ul><li>' + esc(L.minutes) + '</li><li>' + esc(L.hours) + '</li></ul>'; });
  } else if (k.kind === 'week') {
    const w = weekCard(k.r.iso);
    showPage((p) => { p.innerHTML = '<h2>Week number</h2><div class="sub">' + esc(w.date + ' · ' + w.dayName) + '</div><div style="' + big + '">Week ' + w.week + '<span style="font-size:18px;color:#8a8a8a"> of ' + w.year + '</span></div><ul><li>' + esc(labelOf(w.monday) + ' to ' + labelOf(w.sunday) + ' (Monday to Sunday)') + '</li><li>Day ' + w.dayOfYear + ' of the year</li></ul><p style="color:#8a8a8a">ISO 8601 weeks: they start on Monday and week 1 holds the first Thursday of the year. Some calendars (US) number weeks from Sunday and differ by one.</p>'; });
  }
  return 'time-math';
}

export default {
  name: 'time-math',
  examples: ['how long is a meeting from 9:30 to 11:15', 'meeting at 9:30 for 45 minutes', 'meeting length calculator', 'what week number is it', 'week number of oct 25', 'age calculator', 'days since I quit coffee', 'days since march 3'],
  nearMisses: ['how long is a flight from 9 to 11', 'what week is it in the show', 'week number of pregnancy', 'how old is the universe', 'how old am I if I was born in 1990', 'days since the roman empire fell', 'how many days until christmas', 'what time is it in tokyo', 'set an alarm for 7am'],
  kindOf,
  match(lower, text) { return !!kindOf(text || lower); },
  run,
  stageKinds: { dayssince: { mount: mountSince } },
};
