/**
 * calendar skill — a quiet timeline on the stage, from the same input as everything else.
 * No date picker, no account, no third-party script. Events live in this browser only.
 * Contract: { name, examples, match(lower, text), run(text, api) }
 *
 * Gated asks ("add X to my calendar", "schedule a meeting with …") stay on the confirm line.
 * This file only shows the local agenda and adds events that are not those gated sentences.
 */
const KEY = 'a2m.void.agenda.v1';
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};
const DAY = DAYS.join('|');
const MON = Object.keys(MONTHS).join('|');
const TIME = '(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)?)';

const CLEAN = (s) => String(s || '').replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();

function gated(text) {
  const s = CLEAN(text).replace(/^(?:please\s+)/i, '');
  if (/^(?:add|put)\s+.++\s+(?:to|on|in)\s+my calendar\b/i.test(s)) return true;
  if (/^schedule\s+(?:a\s+|an\s+)?(?:meeting|call)\s+with\b/i.test(s)) return true;
  if (/^book\s+(?:a\s+|an\s+)?(?:meeting|call)\s+with\b/i.test(s)) return true;
  return false;
}

function parseClock(s) {
  if (!s) return [9, 0];
  const t = s.toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return [9, 0];
  let h = +m[1];
  const mi = +(m[2] || 0);
  if (m[3]) {
    if (h < 1 || h > 12) return [9, 0];
    h = (h % 12) + (m[3] === 'pm' ? 12 : 0);
  } else if (h <= 7) h += 12;
  if (h > 23 || mi > 59) return [9, 0];
  return [h, mi];
}

function nextWeekday(name, from) {
  const want = DAYS.indexOf(name.toLowerCase());
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let add = (want - d.getDay() + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  return d;
}

function parseWhen(when, time) {
  const now = new Date();
  const [h, mi] = parseClock(time);
  const w = CLEAN(when).toLowerCase();
  let day = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, mi);
  if (w === 'today') { /* same day */ }
  else if (w === 'tomorrow') day.setDate(day.getDate() + 1);
  else if (DAYS.includes(w) || w.startsWith('next ')) {
    const name = w.replace(/^next\s+/, '');
    day = nextWeekday(name, now);
    day.setHours(h, mi, 0, 0);
  } else {
    const m = w.match(new RegExp('^(' + MON + ')\\s+(\\d{1,2})$', 'i')) || w.match(new RegExp('^(\\d{1,2})\\s+(' + MON + ')$', 'i'));
    if (!m) return null;
    const mon = MONTHS[(m[1].match(/[a-z]+/i) ? m[1] : m[2]).toLowerCase()];
    const date = +(m[1].match(/\d/) ? m[1] : m[2]);
    day = new Date(now.getFullYear(), mon, date, h, mi);
    if (day < now) day.setFullYear(day.getFullYear() + 1);
  }
  return day;
}

export function parseCalendar(text) {
  if (gated(text)) return null;
  const t = CLEAN(text);
  if (/^(?:show\s+(?:me\s+)?)?(?:my\s+)?(?:the\s+)?(?:calender|calendar|agenda)\b/i.test(t)
    || /^(?:what'?s|whats)\s+(?:next|on(?:\s+today)?|coming\s+up)\b/i.test(t)
    || /^(?:upcoming|my agenda)\b/i.test(t)) {
    return { kind: 'show' };
  }
  if (/^(?:remove|close|hide|dismiss)\s+(?:my\s+)?(?:the\s+)?(?:calender|calendar|agenda)\b/i.test(t)) {
    return { kind: 'hide' };
  }
  let m = t.match(new RegExp('^(?:remind me to |i have |put )?(.+?)\\s+(next\\s+)?(' + DAY + '|today|tomorrow|' + MON + '\\s+\\d{1,2}|\\d{1,2}\\s+' + MON + ')(?:\\s+at\\s+' + TIME + ')?$', 'i'));
  if (m) {
    const title = CLEAN(m[1]).replace(/^(?:a|an|the)\s+/i, '');
    if (!title || /^(timer|clock|sticky|note|list)\b/i.test(title)) return null;
    const when = (m[2] ? 'next ' : '') + m[3];
    const at = parseWhen(when, m[4]);
    if (!at || !title) return null;
    return { kind: 'add', title, at, raw: t };
  }
  m = t.match(new RegExp('^(.+?)\\s+at\\s+' + TIME + '\\s+(tomorrow|today|next\\s+(?:' + DAY + ')|' + DAY + ')$', 'i'));
  if (m) {
    const title = CLEAN(m[1]);
    const at = parseWhen(m[3], m[2]);
    if (!at || !title) return null;
    return { kind: 'add', title, at, raw: t };
  }
  return null;
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
}
function save(rows) {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (_) {}
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function fmtWhen(iso) {
  const at = new Date(iso);
  return new Intl.DateTimeFormat([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(at);
}

function draw(el, api) {
  const { esc } = api;
  const now = Date.now();
  const rows = load().filter((r) => new Date(r.at).getTime() + 60 * 60 * 1000 >= now).sort((a, b) => a.at.localeCompare(b.at)).slice(0, 8);
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
    if (api.dismissPage) api.dismissPage();
    else if (api.closePage) api.closePage();
    return 'calendar';
  }
  if (q.kind === 'add') {
    const rows = load();
    rows.push({ id: uid(), title: q.title.slice(0, 160), at: q.at.toISOString(), text: q.raw.slice(0, 200) });
    save(rows);
  }
  const el = showPage((p) => { p.innerHTML = '<h2>Coming up</h2><div class="sub">…</div>'; });
  draw(el, api);
  return 'calendar';
}

export default {
  name: 'calendar',
  examples: ['my calendar', 'agenda', "what's next", 'call Sam next Tuesday at 4', 'dentist October 12 at 3pm'],
  nearMisses: ['make a 5 minute timer', 'what is a calendar', 'add this to my calendar', 'schedule a meeting with Sam', 'time in Tokyo'],
  match(lower, text) { return !!parseCalendar(text); },
  run
};
