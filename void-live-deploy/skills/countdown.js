/**
 * countdown skill — days until a named date, starting with the new year.
 * Local calendar only. No stage object: an ask that is not a date stays empty.
 * "how many days until friday" stays with the page calculator.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

function nextNewYear(now) {
  const y = now.getFullYear();
  const today = new Date(y, now.getMonth(), now.getDate());
  const thisYear = new Date(y, 0, 1);
  const when = today.getTime() <= thisYear.getTime() ? thisYear : new Date(y + 1, 0, 1);
  const days = Math.round((when - today) / 864e5);
  const iso = when.getFullYear() + '-' + String(when.getMonth() + 1).padStart(2, '0') + '-' + String(when.getDate()).padStart(2, '0');
  return { name: "New Year's Day", when: iso, days };
}

export function countdownOf(text, now = new Date()) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?(?:how\s+many\s+)?days?\s+until\s+(?:the\s+)?new\s+years?(?:'s)?(?:\s+day)?$/i.test(t)) return nextNewYear(now);
  if (/^(?:please\s+)?countdown\s+to\s+(?:the\s+)?new\s+years?$/i.test(t)) return nextNewYear(now);
  if (/^(?:please\s+)?(?:how\s+long\s+)?(?:until|till)\s+(?:the\s+)?new\s+years?(?:'s)?(?:\s+day)?$/i.test(t)) return nextNewYear(now);
  return null;
}

export function countdownPage(hit) {
  if (!hit) return '';
  const n = hit.days === 1 ? '1 day' : hit.days + ' days';
  const note = hit.days === 0 ? 'today · ' + hit.when : 'until ' + hit.when;
  return '<h2>' + hit.name + '</h2><div class="count-out">' + n + '</div><p>' + note + '</p>';
}

async function run(text, api) {
  const hit = countdownOf(text);
  if (!hit) return 'none';
  const { showPage, esc } = api;
  const n = hit.days === 1 ? '1 day' : hit.days + ' days';
  const note = hit.days === 0 ? 'today · ' + hit.when : 'until ' + hit.when;
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(hit.name) + '</h2>'
      + '<div style="font-size:56px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(n) + '</div>'
      + '<p style="color:#8a8a8a">' + esc(note) + '</p>';
  });
  if (api.say) api.say(n + ' ' + note);
  return 'countdown';
}

export default {
  name: 'countdown',
  examples: ['days until new year', "days until new year's day", 'how many days until the new year', 'countdown to new year', 'days until new years'],
  nearMisses: ['how many days until friday', 'make a 5 minute timer', 'when is christmas', 'what is the new year'],
  countdownOf,
  countdownPage,
  match(lower, text) { return !!countdownOf(text); },
  run
};
