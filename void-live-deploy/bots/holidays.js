// Public-holiday bots, one per country Nager.Date lists (MIT). tools/open-data.mjs keeps one real call per country for
// 2026. A bot is checked by a second reading of that call (the date split into numbers, not the bot's own string match)
// and, for countries whose holidays are fixed by law, by the English name written here by hand. A country whose call
// failed stays in the family and fails its check, so the factory files a fix job instead of dropping it.
import { HOLIDAYS } from './open-data.js';

// English names of holidays whose date is set by law, not by the API's first answer. A different name from Nager fails the bot.
export const KNOWN_DAYS = {
  US: [['2026-01-01', "New Year's Day"], ['2026-12-25', 'Christmas Day']],
  DE: [['2026-01-01', "New Year's Day"], ['2026-10-03', 'German Unity Day'], ['2026-12-25', 'Christmas Day']],
  FR: [['2026-01-01', "New Year's Day"], ['2026-07-14', 'Bastille Day'], ['2026-12-25', 'Christmas Day']],
  JP: [['2026-01-01', "New Year's Day"]],
  BR: [['2026-01-01', "New Year's Day"], ['2026-09-07', 'Independence Day'], ['2026-12-25', 'Christmas Day']],
  AU: [['2026-01-26', 'Australia Day'], ['2026-12-25', 'Christmas Day']],
  CA: [['2026-07-01', 'Canada Day'], ['2026-12-25', 'Christmas Day']],
  MX: [['2026-09-16', 'Independence Day'], ['2026-12-25', 'Christmas Day']],
  IT: [['2026-06-02', 'Republic Day'], ['2026-12-25', 'Christmas Day']],
  GB: [['2026-12-25', 'Christmas Day']],
};

const rowOf = (code) => HOLIDAYS.countries && HOLIDAYS.countries[String(code || '').toUpperCase()];
/** the holiday on an ISO date, read by splitting the date into numbers. Pure. */
export function holidayOn(code, input) {
  const m = String(input || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 'send a date like 2026-07-04';
  const y = +m[1], mo = +m[2], da = +m[3];
  const row = rowOf(code);
  if (!row || row.status !== 200) return 'no holiday list for ' + String(code).toUpperCase();
  for (const [d, name] of row.days || []) {
    const p = String(d).split('-').map(Number);
    if (p[0] === y && p[1] === mo && p[2] === da) return name;
  }
  return 'not a public holiday';
}
const NAMES = () => {
  const m = {};
  for (const [code, row] of Object.entries(HOLIDAYS.countries || {})) {
    if (row.status !== 200) continue;
    m[code.toLowerCase()] = code.toLowerCase();
    if (row.name) m[String(row.name).toLowerCase()] = code.toLowerCase();
  }
  if (m.gb) { m.uk = m.gb; m.britain = m.gb; m['great britain'] = m.gb; }
  if (m.us) { m.usa = m.us; m.america = m.us; }
  return m;
};
let nameMap = null;
/** a country code or English name Nager listed, else null */
export function holidayCode(word) {
  if (!nameMap) nameMap = NAMES();
  const k = String(word || '').toLowerCase().replace(/^the /, '').trim();
  return nameMap[k] || null;
}

export function holidayBots() {
  const out = [];
  for (const [code, row] of Object.entries(HOLIDAYS.countries || {}).sort(([a], [b]) => a.localeCompare(b))) {
    const id = code.toLowerCase(), known = KNOWN_DAYS[code] || [];
    const days = row.days || [];
    const checks = [
      ['kept a real call', () => row.status === 200 && HOLIDAYS.cors === '*' && HOLIDAYS.year === 2026 && /^\d{4}-\d\d-\d\d/.test(row.at || HOLIDAYS.at) && Array.isArray(days)],
      ['dates are real and unique', () => { const s = new Set(); return days.every(([d, name]) => /^\d{4}-\d\d-\d\d$/.test(d) && d.startsWith('2026-') && name && !s.has(d) && s.add(d)); }],
      ['a date round-trips to its name', () => days.every(([d, name]) => holidayOn(code, d) === name) && (days[0] ? holidayOn(code, '2026-02-02') === (days.some(([d]) => d === '2026-02-02') ? days.find(([d]) => d === '2026-02-02')[1] : 'not a public holiday') : holidayOn(code, '2026-02-02') === 'not a public holiday')],
    ];
    if (known.length) checks.push(['known answer', () => known.every(([d, name]) => holidayOn(code, d) === name)]);
    // July 4 2026 is a Saturday, so the federal holiday is observed on the Friday. The date is worked out here, not copied from the call.
    if (code === 'US') checks.push(['Juneteenth is June 19', () => holidayOn('US', '2026-06-19').includes('Juneteenth')], ['Independence Day observance', () => { const dow = new Date(Date.UTC(2026, 6, 4)).getUTCDay(); const observed = dow === 6 ? '2026-07-03' : dow === 0 ? '2026-07-05' : '2026-07-04'; return holidayOn('US', observed) === 'Independence Day'; }]);
    out.push({ id: 'holiday-' + id, cat: 'dates', family: 'public holidays', job: 'Public holidays in 2026 for ' + (row.name || code) + ' (Nager.Date)', from: ['skills/date-calc.js', 'bots/unix-time'], sample: (known[0] && known[0][0]) || (days[0] && days[0][0]) || '2026-01-01',
      run: (s) => holidayOn(code, s), checks });
  }
  return out;
}
