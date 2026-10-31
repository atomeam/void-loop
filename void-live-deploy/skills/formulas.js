/**
 * formulas skill — one of the 164 formula calculators of /calculators/ (lib/calculators.js) on a card: "pipe surface area calculator",
 * "ohms law current calculator", "calculator for molar mass", and "formula calculators" for the library. The card works the calculator
 * out with its everyday inputs, shows the formula, each input with its unit and the answer, and links to the full page with the same
 * calculator open, where every box takes units and the answer is a link. Late in the order, so the page's own answers (sums, tip, units,
 * dates) keep their asks; only a calculator whose name holds every word asked is taken. A few tools also go by an everyday name with no
 * "calculator" ("epoch converter", "url encoder"), and a few asks bring their own numbers ("unix timestamp 1700000000", "url encode hello world",
 * "compound interest 1000 at 5% for 10 years"): the card works those out and the page link opens on the same numbers. Tests: tools/calculators.test.mjs.
 */
import { CALCULATORS, BY_ID, run, search, writeQuery } from '../lib/calculators.js';

const fold = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '');
const FILLER = new Set(['a', 'an', 'the', 'for', 'of', 'online', 'free', 'my', 'me', 'open', 'show', 'calculator', 'calculators', 'calc', 'with', 'units', 'unit']);
// asks a skill earlier in the order answers with its own card (time-math the age calculator, nutrition bmi and calories, savings,
// home paint and flooring, walls wallpaper and drywall): formulas does not claim them, so the two never overlap (tools/skill-overlap.mjs)
const OWNED = new Set(['age', 'bmi', 'calorie', 'calories', 'savings', 'paint', 'flooring', 'wallpaper', 'drywall', 'gpa', 'due date', 'sleep']); // gpa: grades, due date: pregnancy, sleep: sleep (tools/skill-overlap.mjs)
const LIBRARY = /^(?:open (?:the )?)?(?:formula|engineering|science|physics|chemistry) calculators?(?: with units)?$/;

// a tool asked for by its everyday name, with no "calculator" in it (2026-10-30: each of these fell to an article)
const NAMES = {
  'unix-time': ['epoch converter', 'epoch time converter', 'epoch timestamp converter', 'unix time converter', 'unix timestamp converter', 'timestamp converter',
    'unix timestamp', 'unix time', 'epoch time', 'unix epoch', 'timestamp to date', 'unix timestamp to date', 'unix time to date', 'epoch to date', 'date to timestamp', 'date to unix timestamp', 'date to epoch'],
  'url-encode': ['url encoder', 'url decoder', 'url encode', 'url decode', 'url encoding', 'url decoding', 'url encoder decoder', 'url encode decode', 'percent encoding', 'percent encoder', 'urlencode', 'urldecode'],
  'roman-numerals': ['roman numeral converter', 'roman numerals converter', 'roman numeral translator', 'roman numerals translator'],
  'days-between': ['days between dates', 'days between two dates', 'date difference', 'date duration'],
};
const NAMED = new Map(Object.entries(NAMES).flatMap(([id, names]) => names.map((n) => [n, id])));
const N = '(-?\\d{9,16}(?:\\.\\d+)?)', DT = '(\\d{4}-\\d{1,2}-\\d{1,2}(?:[ t]\\d{1,2}:\\d{2}(?::\\d{2})?)?(?: ?(?:z|utc|gmt))?)', EP = '(?:unix|epoch|posix)(?: time(?:stamp)?)?';
const AMT = '\\$?(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|thousand|m|million)?', PCT = '(\\d+(?:\\.\\d+)?)\\s*(?:%|percent)', SPAN = '(\\d+(?:\\.\\d+)?) (years?|months?)';
const HOW = { daily: '365', weekly: '52', monthly: '12', quarterly: '4', 'semi-annually': '2', annually: '1', yearly: '1' };
const money = (n, k) => String(parseFloat(n.replace(/,/g, '')) * (/^(?:k|thousand)$/.test(k || '') ? 1e3 : /^(?:m|million)$/.test(k || '') ? 1e6 : 1));
/** a value ask a calculator answers with the asker's own numbers: { calc, given }, or null. "now" is passed in so a test gets one answer. Pure. */
// the shape void.html's calc answers itself ("compound interest on <number> at <rate>% for <whole> years", yearly or monthly)
const PAGE_COMPOUND = /^compound interest on \$?\d+(?:\.\d+)? (?:dollars )?at \d+(?:\.\d+)? ?% (?:interest )?(?:for|over) \d{1,3} years?(?: (?:monthly|yearly|annually|compounded monthly))?$/;

export function filled(text, now = Date.now()) {
  const raw = String(text || '').trim().replace(/[?!]+$/, '').replace(/\s+/g, ' '), t = fold(raw).replace(/\.$/, '');
  let m;
  // the epoch: a number to a date, a date to the number, and the time now
  if ((m = t.match(new RegExp('^(?:convert )?(?:the )?' + EP + ' (?:of |for )?' + N + '(?: to (?:a )?(?:date|utc|human date|readable date))?$')))
    || (m = t.match(new RegExp('^(?:convert |what (?:date|time) is )?' + N + '(?: ' + EP + ')? (?:to|as|in|into) (?:a )?(?:date|utc|human date|readable date|date and time)$')))
    || (m = t.match(new RegExp('^what (?:date|time) is ' + EP + ' ' + N + '$')))
    // the tool by its name with the number after it: "timestamp converter 1700000000", "convert timestamp 1700000000", "epoch converter: 1700000000"
    || (m = t.match(new RegExp('^(?:convert (?:the |this |a )?)?(?:(?:unix|epoch|posix) )?(?:time ?stamp|epoch|unix time)(?: (?:converter|to date))?:? ' + N + '$')))) return { calc: BY_ID.get('unix-time'), given: { v: m[1] } };
  if ((m = t.match(new RegExp('^(?:convert )?' + DT + ' (?:to|in|into|as) ' + EP + '$')))
    || (m = t.match(new RegExp('^(?:what is )?(?:the )?' + EP + ' (?:of|for) ' + DT + '$')))) return { calc: BY_ID.get('unix-time'), given: { v: m[1].toUpperCase().replace(/ ?(?:Z|UTC|GMT)$/, '') } };
  if (/^(?:what(?:s| is) )?(?:the )?(?:current|now|todays?) (?:unix|epoch|posix)(?: time(?:stamp)?)?(?: now)?$|^(?:unix|epoch) time(?:stamp)? (?:now|right now|today)$/.test(t)) return { calc: BY_ID.get('unix-time'), given: { v: String(Math.floor(now / 1000)) } };
  // percent-encoding: "url encode hello world", "url decode a%20b" (the text keeps its own case)
  if ((m = raw.match(/^(?:url|uri|percent)[ -]?(encode|decode)\s*:?\s+(.+)$/i)) || (m = raw.match(/^(encode|decode) (?:for (?:a )?url|url)\s*:?\s+(.+)$/i)))
    return { calc: BY_ID.get('url-encode'), given: { s: m[2], how: /^decode$/i.test(m[1]) ? 'dec' : 'part' } };
  // the page's own sum keeps "compound interest on 1000 at 5% for 10 years" (void.html: a plain number, whole years): formulas leaves it,
  // as the header says, so the two never answer the same ask (main's verify, 2026-10-30: "money/GPA near misses (#110)" red)
  if (PAGE_COMPOUND.test(t)) return null;
  // interest: "compound interest 1000 at 5% for 10 years", "simple interest on 5000 at 4% for 3 years", "compound interest on $10k at 6% for 18 months compounded daily"
  if ((m = t.match(new RegExp('^(?:what is )?(?:the )?(compound|simple) interest (?:on |for |of )?' + AMT + ' (?:at|@) ' + PCT + '(?: (?:a year|per year|annually|apr|apy|interest))? (?:for|over) ' + SPAN + '(?:,? compounded (daily|weekly|monthly|quarterly|semi-annually|annually|yearly))?$')))) {
    const given = { P: money(m[2], m[3]), r: m[4], t: m[5], 't.u': /^month/.test(m[6]) ? 'month' : 'yr' };
    if (m[7]) { if (m[1] === 'simple') return null; given.n = HOW[m[7]]; }
    return { calc: BY_ID.get(m[1] + '-interest'), given };
  }
  return null;
}

/** the calculator an ask names: "<name> calculator" or "calculator for <name>", every word in its name; null otherwise. Pure. */
export function pick(text) {
  const t = fold(text).trim().replace(/[?.!]+$/, '');
  if (NAMED.has(t)) return BY_ID.get(NAMED.get(t)) || null;
  const m = t.match(/^(?:open (?:the |a )?)?(.+?) calc(?:ulator)?$/) || t.match(/^(?:open (?:the |a )?)?calc(?:ulator)? for (?:the |a )?(.+)$/);
  if (!m) return null;
  const words = m[1].split(/[^a-z0-9²³]+/).filter((w) => w && !FILLER.has(w));
  if (!words.length) return null;
  const top = search(words.join(' '))[0]; if (!top) return null;
  const name = fold(top.name + ' ' + top.id.replace(/-/g, ' '));
  return words.every((w) => name.includes(w)) ? top : null;
}
/** the words an ask names its calculator by, fillers dropped ("age calculator" gives "age"); '' when it names none. Pure. */
function asked(text) {
  const t = fold(text).trim().replace(/[?.!]+$/, '');
  const m = t.match(/^(?:open (?:the |a )?)?(.+?) calc(?:ulator)?$/) || t.match(/^(?:open (?:the |a )?)?calc(?:ulator)? for (?:the |a )?(.+)$/);
  return m ? m[1].split(/[^a-z0-9²³]+/).filter((w) => w && !FILLER.has(w)).join(' ') : '';
}
/** whether an ask opens the whole library. Pure. */
export const isLibrary = (text) => LIBRARY.test(fold(text).trim().replace(/[?.!]+$/, ''));

function card(calc, api, given) {
  // with the asker's own numbers the full page opens on them too (lib/calculators.js readQuery)
  const { showPage, esc } = api, r = run(calc, given || {}), href = given ? '/calculators/' + writeQuery({ calc: calc.id, given }) : '/calculators/?calc=' + encodeURIComponent(calc.id);
  showPage((p) => {
    p.dataset.page = href; // the full-page link opens this calculator, not the list of all of them
    p.innerHTML = '<h2>' + esc(calc.name) + '</h2><div class="sub">' + esc(calc.cat + ' · ' + calc.formula) + '</div>'
      + '<ul>' + r.inputs.map((i) => '<li><b>' + esc(i.label) + '</b> ' + esc(i.raw + (i.unit ? ' ' + i.unit : '')) + '</li>').join('') + '</ul>'
      + r.outputs.map((o, n) => '<div style="' + (n ? 'font-size:18px;margin:2px 0' : 'font-size:40px;font-weight:300;line-height:1.15;margin:6px 0 4px') + '">' + (n ? '<b>' + esc(o.label) + '</b> ' : '') + esc(r.error ? r.error : o.text) + '</div>').join('')
      + '<p><a href="' + esc(href) + '">Change the numbers and units</a> · every box takes units, and the answer is a link you can share.</p>';
  });
  return 'formulas';
}
function library(api) {
  const { showPage, esc } = api, cats = new Map();
  for (const c of CALCULATORS) cats.set(c.cat, (cats.get(c.cat) || 0) + 1);
  showPage((p) => {
    p.dataset.page = '/calculators/';
    p.innerHTML = '<h2>Formula calculators</h2><div class="sub">' + esc(CALCULATORS.length + ' calculators, every box takes units') + '</div>'
      + '<ul>' + [...cats].map(([c, n]) => '<li>' + esc(c + ' (' + n + ')') + '</li>').join('') + '</ul>'
      + '<p><a href="/calculators/">Open the calculators</a>, or <a href="/calculators/#build">build your own formula</a>.</p>';
  });
  return 'formulas';
}

export default {
  name: 'formulas',
  examples: ['pipe surface area calculator', 'ohms law current calculator', 'calculator for molar mass', 'kinetic energy calculator', 'formula calculators',
    'unix timestamp 1700000000', 'timestamp converter 1700000000', 'epoch converter', 'url encode hello world', 'compound interest 1000 at 5% for 10 years', 'roman numeral converter'],
  nearMisses: ['calculator', 'open a calculator', 'what is 17% of 240', 'how do calculators work', 'calculator watch',
    'what is unix', 'what is compound interest', 'url of the calculators page', 'encode', 'roman numerals for 1994', 'compound interest on 1000 at 5% for 10 years'],
  pick, isLibrary, filled,
  match(lower, text) { const t = text || lower; return isLibrary(t) || !!filled(t) || (!!pick(t) && !OWNED.has(asked(t))); },
  async run(text, api) {
    if (isLibrary(text)) return library(api);
    const f = filled(text); if (f && f.calc) return card(f.calc, api, f.given);
    const c = pick(text); return c ? card(c, api) : 'none';
  },
};
