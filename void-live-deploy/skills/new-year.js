/**
 * new-year skill — days until New Year's Day.
 * Counts calendar days from a given date to the next 1 January. No network.
 * Does not publish. "when is the next holiday" stays with holidays.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function newYearOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?(?:how\s+many\s+)?days\s+until\s+(?:the\s+)?new\s+year$/i.test(t)) return { what: 'days' };
  if (/^(?:please\s+)?countdown\s+to\s+(?:the\s+)?new\s+year$/i.test(t)) return { what: 'days' };
  if (/^(?:please\s+)?(?:how\s+long\s+)?until\s+new\s+year(?:'s)?(?:\s+day)?$/i.test(t)) return { what: 'days' };
  if (/^(?:please\s+)?days\s+left\s+in\s+the\s+year$/i.test(t)) return { what: 'days' };
  return null;
}

/** Whole calendar days from `from` until the next 1 January. Same day is 0. */
export function daysUntilNewYear(from = new Date()) {
  const d = from instanceof Date ? from : new Date(from);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let year = start.getFullYear() + 1;
  if (start.getMonth() === 0 && start.getDate() === 1) year = start.getFullYear();
  const next = new Date(year, 0, 1);
  return Math.round((next - start) / 86400000);
}

export function newYearLine(from = new Date()) {
  const n = daysUntilNewYear(from);
  const when = from instanceof Date ? from : new Date(from);
  const year = (when.getMonth() === 0 && when.getDate() === 1) ? when.getFullYear() : when.getFullYear() + 1;
  if (n === 0) return 'New Year\'s Day is today.';
  if (n === 1) return '1 day until New Year\'s Day ' + year + '.';
  return n + ' days until New Year\'s Day ' + year + '.';
}

async function run(text, api) {
  const hit = newYearOf(text);
  if (!hit) return 'none';
  const { showPage, esc } = api;
  const line = newYearLine(new Date());
  if (showPage) {
    showPage((p) => {
      p.innerHTML = '<h2>New year</h2><p>' + esc(line) + '</p><div class="src">This browser\'s calendar. Nothing is published.</div>';
    });
  } else if (api.say) api.say(line);
  return 'new-year';
}

export default {
  name: 'new-year',
  examples: ['days until new year', 'how many days until the new year', 'countdown to new year', 'until new year\'s day', 'days left in the year'],
  nearMisses: ['when is the next holiday', 'what day is it today', 'new year recipes', 'remind me at 5'],
  newYearOf,
  daysUntilNewYear,
  newYearLine,
  match(lower, text) { return !!newYearOf(text); },
  run
};
