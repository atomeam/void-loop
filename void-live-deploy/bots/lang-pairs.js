// Language-pair phrasebook bots (owner, 2026-11-04: Verse builds a ridiculous number of its own bots, each from ones it has, each live
// only after a real test). One bot per ordered pair of 42 languages. Every word comes from Unicode CLDR (Unicode License v3) through the
// browser's own Intl data, so nothing is fetched and nothing is made up: weekdays, months, today/tomorrow/next week, date words,
// language names and country names. Checks per bot, never its own first answer: Monday and tomorrow match a known word list kept here
// by hand (a missing or wrong CLDR locale fails), every word survives the trip there and back (a word with two meanings, like Hindi कल for
// tomorrow and yesterday or Finnish saksa for German and Germany, is answered with both, and the original must be among them).
export const LANGS = 'en es fr de it pt nl sv da nb fi pl cs sk hu ro tr el ru uk bg sr hr sl lt lv et ja zh ko vi th id ms hi bn ta ar he fa sw fil ca'.split(' ');
const MON = 'monday lunes lundi montag lunedì segunda-feira maandag måndag mandag mandag maanantai poniedziałek pondělí pondelok hétfő luni pazartesi δευτέρα понедельник понеділок понеделник понедељак ponedjeljak ponedeljek pirmadienis pirmdiena esmaspäev 月曜日 星期一 월요일 thứ_hai วันจันทร์ senin isnin सोमवार সোমবার திங்கள் الاثنين יום_שני دوشنبه jumatatu lunes dilluns'.split(' ');
const TMR = 'tomorrow mañana demain morgen domani amanhã morgen i_morgon i_morgen i_morgen huomenna jutro zítra zajtra holnap mâine yarın αύριο завтра завтра утре сутра sutra jutri rytoj rīt homme 明日 明天 내일 ngày_mai พรุ่งนี้ besok esok कल আগামীকাল நாளை غدًا מחר فردا kesho bukas demà'.split(' ');
export const KNOWN = Object.fromEntries(LANGS.map((l, i) => [l, { monday: MON[i].replace(/_/g, ' '), tomorrow: TMR[i].replace(/_/g, ' ') }]));
const REGIONS = 'US GB FR DE ES IT JP CN IN BR MX CA RU KR NG EG ZA AR AU TR SA ID PK BD VN TH PH KE PL UA'.split(' ');
const REL = [['today', 0, 'day'], ['tomorrow', 1, 'day'], ['yesterday', -1, 'day'], ['next week', 1, 'week'], ['last week', -1, 'week'], ['next month', 1, 'month'], ['last month', -1, 'month'], ['next year', 1, 'year'], ['last year', -1, 'year'], ['now', 0, 'second']];
const FIELDS = ['year', 'month', 'day', 'hour', 'minute', 'second', 'weekday'];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const low = (s, l) => String(s).trim().toLocaleLowerCase(l);
const cache = {};
/** a language's phrasebook from CLDR: { words: { key: word }, index: Map(lowercased word -> [keys]) } */
export function book(l) {
  if (cache[l]) return cache[l];
  const words = {}, cal = l + '-u-ca-gregory-nu-latn';
  const wd = new Intl.DateTimeFormat(cal, { weekday: 'long', timeZone: 'UTC' }), mo = new Intl.DateTimeFormat(cal, { month: 'long', timeZone: 'UTC' });
  DAYS.forEach((d, i) => (words['day:' + d] = wd.format(new Date(Date.UTC(2026, 10, 2 + i)))));
  for (let m = 0; m < 12; m++) words['month:' + (m + 1)] = mo.format(new Date(Date.UTC(2026, m, 5)));
  const rt = new Intl.RelativeTimeFormat(l, { numeric: 'auto' });
  for (const [k, n, u] of REL) words['when:' + k] = rt.format(n, u);
  try { const f = new Intl.DisplayNames(l, { type: 'dateTimeField' }); for (const k of FIELDS) words['field:' + k] = f.of(k); } catch (_) { /* older engines: no date words */ }
  const ln = new Intl.DisplayNames(l, { type: 'language' }), rg = new Intl.DisplayNames(l, { type: 'region' });
  for (const k of LANGS) words['language:' + k] = ln.of(k);
  for (const k of REGIONS) words['country:' + k] = rg.of(k);
  const index = new Map();
  for (const [k, w] of Object.entries(words)) { const x = low(w, l); index.set(x, [...(index.get(x) || []), k]); }
  return (cache[l] = { words, index });
}
/** translate each comma- or line-separated item from a to b; an item not in the phrasebook comes back marked */
export function translate(a, b, s) {
  const A = book(a), B = book(b);
  // an item may itself be "a / b" (another phrasebook bot's answer with two meanings): every meaning is carried through
  return String(s).split(/\s*[,;\n]\s*/).filter(Boolean).map((w) => { const ks = w.split(/\s+\/\s+/).flatMap((x) => A.index.get(low(x, a)) || []); return ks.length ? [...new Set(ks.map((k) => B.words[k]))].join(' / ') : '(not in the phrasebook: ' + w + ')'; }).join(', ');
}
const EN = new Intl.DisplayNames('en', { type: 'language' }), name = (l) => EN.of(l);
const has = (out, want, l) => out.split(' / ').some((x) => low(x, l) === low(want, l));

/** every pair bot, same shape as bots/families.js variants */
export function langPairs() {
  const out = [];
  for (const a of LANGS) for (const b of LANGS) if (a !== b) {
    const f = (s) => translate(a, b, s);
    out.push({ id: 'phrase-' + a + '-to-' + b, cat: 'language', family: 'language pairs', job: 'Phrasebook ' + name(a) + ' to ' + name(b) + ': days, months, today and tomorrow, date words, languages, countries (Unicode CLDR)',
      from: ['skills/translate.js', 'bots/case-converter'], sample: book(a).words['day:monday'] + ', ' + book(a).words['when:tomorrow'], run: f,
      checks: [
        ['CLDR has both languages', () => [a, b].every((l) => l === 'en' || low(book(l).words['day:monday'], l) !== 'monday')],
        ['known answer', () => has(f(book(a).words['day:monday']), KNOWN[b].monday, b) && has(f(book(a).words['when:tomorrow']), KNOWN[b].tomorrow, b) && low(book(a).words['day:monday'], a) === KNOWN[a].monday],
        ['round trip, every word', () => Object.keys(book(a).words).every((k) => has(f(book(a).words[k]), book(b).words[k], b) && has(translate(b, a, book(b).words[k]), book(a).words[k], a))],
      ] });
  }
  return out;
}
