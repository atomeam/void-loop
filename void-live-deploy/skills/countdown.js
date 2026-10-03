/**
 * countdown skill — days until a date (board Later: date countdown)
 * "days until new year", "countdown to christmas", "days until 2027-01-01".
 * Weekday counts ("how many days until friday") stay with the list path.
 * Nothing mounts until the ask; the blank surface stays blank.
 */
const FIXED = {
  'new year': [1, 1],
  "new year's day": [1, 1],
  'new years': [1, 1],
  christmas: [12, 25],
  'christmas day': [12, 25],
  halloween: [10, 31],
  "valentine's day": [2, 14],
  'valentines day': [2, 14]
};
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

export function countdownOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:please\s+)?(?:show\s+)?(?:a\s+)?(?:countdown\s+to|days\s+until)\s+(.+)$/i);
  if (!m) return null;
  const rest = m[1].trim().toLowerCase();
  if (/^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/.test(rest)) return null;
  const iso = rest.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { label: rest, y: +iso[1], month: +iso[2], day: +iso[3] };
  if (FIXED[rest]) return { label: rest, month: FIXED[rest][0], day: FIXED[rest][1] };
  const md = rest.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/);
  if (md && MONTHS[md[1]] && +md[2] >= 1 && +md[2] <= 31) return { label: rest, month: MONTHS[md[1]], day: +md[2], y: md[3] ? +md[3] : undefined };
  return null;
}

export function daysUntil(spec, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target;
  if (spec.y && spec.month && spec.day) target = new Date(spec.y, spec.month - 1, spec.day);
  else {
    const y = now.getFullYear();
    target = new Date(y, spec.month - 1, spec.day);
    if (target < today) target = new Date(y + 1, spec.month - 1, spec.day);
  }
  const days = Math.round((target - today) / 86400000);
  return { days, target };
}

async function run(text, api) {
  const spec = countdownOf(text);
  if (!spec) return 'none';
  const { showPage, esc } = api;
  const { days, target } = daysUntil(spec);
  const when = target.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const line = days === 0 ? 'That is today.' : days === 1 ? '1 day.' : days < 0 ? Math.abs(days) + ' days ago.' : days + ' days.';
  showPage((p) => {
    p.innerHTML = '<h2>Countdown</h2><p style="font-size:42px">' + esc(line) + '</p><p>' + esc(spec.label) + ' · ' + esc(when) + '</p><div class="src">Counted on this device. No outside source.</div>';
  });
  return 'countdown';
}

export default {
  name: 'countdown',
  examples: ['days until new year', 'countdown to christmas', 'days until 2027-01-01', 'countdown to january 1'],
  nearMisses: ['how many days until friday', 'make a timer', 'public holidays in japan'],
  countdownOf,
  daysUntil,
  match(lower, text) { return !!countdownOf(text); },
  run
};
