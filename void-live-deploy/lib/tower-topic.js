// A site Versus fights is matched to the Verse page that already does its job, by topic (owner, 2026-11-03: "still says no vat page on the
// card"): ndscalc.ru, a Russian VAT calculator, had /vat/ live since the same day while the card said "no Verse page yet", because only a page
// built for one host (lib/tower.js LANE_PAGES) counted. A frontier site's title and host are read against these topics, most specific first, and
// the first that names its job gives its page. A word must name the job itself ("vtuner internet radio" is not a tuner, "password recovery
// software" is not a strength checker), so each topic is a phrase, not a stray word. A job an existing page covers is a mode of that page, not a
// page of its own (owner, 2026-11-03: "always combine pages when possible"): VAT is the calculator's VAT mode. Only pages that exist are named (tools/tower-topic.test.mjs
// checks every one against lib/toolkit.js). Pure.
export const TOPICS = Object.freeze([
  ['vat', /\b(?:vat|gst|mwst|iva|tva|ust)\b|ндс|налог на добавленную|mehrwertsteuer|umsatzsteuer/i, '/calculator/?mode=vat'],
  ['currency converter', /currency conver|exchange rate|курс валют|конвертер валют/i, '/markets/currency-converter/'],
  ['password strength', /password (?:strength|checker|meter)|how secure is my password|надежност[ьи] парол/i, '/password-strength/'],
  ['password generator', /password generator|генератор парол|random password/i, '/password/'],
  ['unit converter', /unit conver|convert units|measurement (?:unit )?conver|конвертер величин/i, '/convert/'],
  ['emoji combos', /emoji comb/i, '/emoji-combos/'],
  ['emoji', /\bemoji/i, '/emojis/'],
  ['gradient', /gradient/i, '/gradient/'],
  ['colour codes', /\bhex colou?r|colou?r (?:code|picker|name|palette)|brand colou?r/i, '/color/'],
  ['word counter', /word count|character count|счетчик (?:слов|символов)/i, '/word-count/'],
  ['stopwatch and timer', /stopwatch|countdown timer|online timer|секундомер/i, '/stopwatch/'],
  ['random number', /random number|случайн(?:ое|ых) числ/i, '/random/'],
  ['made-up people', /random user|fake (?:name|person|identity)/i, '/random-user/'],
  ['wheel of names', /wheel of names|spin the wheel|name picker/i, '/wheel/'],
  ['coin flip', /coin flip|flip a coin/i, '/flip/'],
  ['base64', /base ?64/i, '/base64/'],
  ['base converter', /hex to binary|binary (?:to|converter)|base conver/i, '/base-converter/'],
  ['resize an image', /resize (?:an )?(?:image|photo|picture)|image resiz/i, '/resize-image/'],
  ['photo tools', /compress (?:image|photo)|image compress|photo editor|exif/i, '/photos/'],
  ['pdf', /\b(?:compress|merge|split|convert|edit|sign|rotate)\w* (?:\w+ )?pdf\b|\bpdf (?:compress|merge|split|convert|editor|tools?)/i, '/pdf/'],
  ['weather', /weather forecast|\bweather\b|прогноз погоды/i, '/weather/'],
  ['time zones', /time ?zone|world clock|meeting planner/i, '/time/'],
  ['translate', /\btranslat(?:e|or|ion)\b|переводчик/i, '/translate/'],
  ['recipes', /\brecipes?\b/i, '/recipes/'],
  ['kanban', /kanban/i, '/kanban/'],
  ['metronome', /metronome/i, '/metronome/'],
  ['bpm', /\bbpm\b|tap tempo/i, '/bpm/'],
  ['tuner', /guitar tuner|instrument tuner|online tuner|chromatic tuner/i, '/tuner/'],
  ['chords', /\bchords?\b/i, '/chords/'],
  ['piano', /\bpiano\b/i, '/piano/'],
  ['flight distance', /distance calculator|flight distance|air miles/i, '/flights/distance/'],
  ['remote jobs', /remote jobs?|job board/i, '/jobs/'],
  ['calculator', /^(?:online |free )?calculator\b|\bonline calculator\b|calculadora online|онлайн калькулятор$/i, '/calculator/'],
  ['formula calculators', /calculat|калькулятор|cálculo|calculo|rechner|calcul/i, '/calculators/'],
]);
/** the topic and Verse's page for a site, from its title and host: { topic, page } or null. Pure. */
export function topicOf(title, host = '') {
  const text = String(title || '') + ' ' + String(host || '').replace(/\.[a-z]+$/i, '').replace(/[.-]/g, ' ');
  for (const [topic, re, page] of TOPICS) if (re.test(text)) return { topic, page };
  return null;
}
export const topicPageOf = (title, host) => (topicOf(title, host) || {}).page || '';
