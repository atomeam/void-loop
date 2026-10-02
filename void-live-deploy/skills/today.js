/**
 * today skill — "what did you do today": Void's own recent actions from this device's loop log
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Reads localStorage a2m.void.loop.v1 only. No Wikipedia, no network.
 * Near-misses: "what day is it today" / "what's the date today" stay with wantsToday; "what did I do today", "history of today", "today's weather" stay out.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function isTodayLog(text) {
  const t = CLEAN(text);
  // Void's actions on this device (you / void / your log), never the visitor's day or the calendar date
  return /^(?:please\s+)?(?:what\s+(?:did|have)\s+(?:you|void)\s+(?:do(?:ne)?|been\s+doing)(?:\s+today)?|what\s+(?:did|have)\s+you\s+been\s+up\s+to(?:\s+today)?|show\s+(?:me\s+)?(?:your\s+)?(?:the\s+)?(?:loop\s+)?log|your\s+recent\s+actions|show\s+(?:me\s+)?your\s+recent\s+actions|what\s+have\s+you\s+been\s+doing(?:\s+today)?)$/i.test(t);
}

function localDayKey(d = new Date()) {
  // visitor's local calendar day as YYYY-MM-DD
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function entryDayKey(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return localDayKey(d);
}

function readLog() {
  try {
    const raw = localStorage.getItem('a2m.void.loop.v1');
    const log = JSON.parse(raw || '[]');
    return Array.isArray(log) ? log : [];
  } catch (_) {
    return [];
  }
}

function lineOf(e) {
  const ask = String(e.ask || '').trim();
  const note = String(e.note || '').trim();
  if (ask && note) return ask + ' — ' + note;
  return ask || note || '(empty)';
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!isTodayLog(text)) return 'none';
  const today = localDayKey();
  const all = readLog();
  const todays = all.filter((e) => e && e.t && entryDayKey(e.t) === today);
  // newest first, cap ~20
  const shown = todays.slice(-20).reverse();
  const el = showPage((p) => {
    if (!shown.length) {
      p.innerHTML = '<h2>Today</h2><p>Nothing is logged on this device yet.</p><div class="sub">Void writes a line here each time it answers on this browser.</div>';
      return;
    }
    const rows = shown.map((e) => {
      const when = (() => { try { return new Date(e.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (_) { return ''; } })();
      return '<li style="margin:6px 0"><span style="color:#8a8a8a">' + esc(when) + '</span> ' + esc(lineOf(e)) + '</li>';
    }).join('');
    p.innerHTML = '<h2>Today</h2><div class="sub">' + shown.length + (shown.length === 1 ? ' action' : ' actions') + ' on this device · from the local loop log</div>'
      + '<ol style="margin:10px 0 0 18px;padding:0;list-style:none">' + rows + '</ol>'
      + '<div class="src">Source: this device · a2m.void.loop.v1</div>';
  });
  return el ? 'today' : 'today';
}

export default {
  name: 'today',
  examples: [
    'what did you do today',
    'what have you done today',
    'what did void do today',
    'show your log',
    'your recent actions',
    'what have you been doing'
  ],
  nearMisses: [
    'what day is it today',
    "what's the date today",
    'what did I do today',
    'history of today',
    "today's weather"
  ],
  match(lower, text) { return isTodayLog(text); },
  run
};
