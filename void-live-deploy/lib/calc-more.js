// Pure maths and ask parsing for tools pack 3 (owner, 2026-10-18, list items 45 and 47): pixels <-> cm, mm, inches at a DPI, and
// a currency conversion at a rate the person types. No live rates, nothing fetched, nothing sent. Run: node --test tools/tools-pack3.test.mjs

export const DEFAULT_DPI = 96; // CSS pixels: 96 per inch
const tidy = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[?!.]+$/, '').replace(/,?\s+please$/i, '').toLowerCase();
const NUM = '(\\d+(?:[.,]\\d+)?)';
const toNum = (s) => Number(String(s).replace(',', '.'));

const UNIT_RE = { px: 'px|pixels?', cm: 'cm|centimet(?:er|re)s?', mm: 'mm|millimet(?:er|re)s?', in: 'in|inch(?:es)?' };
const unitOf = (w) => Object.keys(UNIT_RE).find((k) => new RegExp('^(?:' + UNIT_RE[k] + ')$').test(w)) || null;
const ANY_UNIT = '(?:' + Object.values(UNIT_RE).join('|') + ')';
const DPI_PART = '(?:\\s+(?:at|@|with|using|for)\\s+(?:a\\s+)?(?:resolution\\s+of\\s+)?' + NUM + '\\s*(?:dpi|ppi))?';

/** value in unit `from` as unit `to` at `dpi` dots per inch (px, cm, mm, in). Pure; null for a unit it doesn't know or a dpi <= 0. */
export function pxConvert(value, from, to, dpi = DEFAULT_DPI) {
  const v = Number(value), d = Number(dpi);
  if (!Number.isFinite(v) || !Number.isFinite(d) || d <= 0) return null;
  const perInch = { cm: 2.54, mm: 25.4, in: 1 };
  const inches = from === 'px' ? v / d : perInch[from] ? v / perInch[from] : NaN;
  const out = to === 'px' ? inches * d : perInch[to] ? inches * perInch[to] : NaN;
  return Number.isFinite(out) ? out : null;
}

/** "pixels to cm at 96 dpi", "300 px in cm at 150 dpi", "how many pixels in 5 cm at 300 dpi": { value|null, from, to, dpi, dpiGiven }
 *  with exactly one side in pixels, or null. A missing number means "open the converter". Pure. */
export function parsePx(text) {
  const t = tidy(text).replace(/^(?:please\s+)?(?:convert\s+)?/, '');
  let m = new RegExp('^(?:' + NUM + '\\s*)?(' + ANY_UNIT + ')\\s+(?:to|in|into|as)\\s+(' + ANY_UNIT + ')' + DPI_PART + '$').exec(t);
  let value = null, a, b, dpi;
  if (m) { value = m[1] ? toNum(m[1]) : null; a = unitOf(m[2]); b = unitOf(m[3]); dpi = m[4]; } else {
    m = new RegExp('^how\\s+many\\s+(' + ANY_UNIT + ')\\s+(?:is|are|in)\\s+' + NUM + '\\s*(' + ANY_UNIT + ')' + DPI_PART + '$').exec(t);
    if (!m) return null;
    b = unitOf(m[1]); value = toNum(m[2]); a = unitOf(m[3]); dpi = m[4];
  }
  if (!a || !b || a === b || (a !== 'px') === (b !== 'px')) return null; // pixels on exactly one side
  const d = dpi ? toNum(dpi) : DEFAULT_DPI;
  if (!(d >= 1 && d <= 2400) || (value !== null && !Number.isFinite(value))) return null;
  return { value, from: a, to: b, dpi: d, dpiGiven: !!dpi };
}

// the codes a person means when they say a currency; a three-letter code that is not here is not taken for money ("5 kgs to lbs")
export const CODES = new Set('usd eur gbp jpy cad aud chf cny inr mxn brl krw sek nok dkk nzd sgd hkd zar try pln czk huf ils thb aed sar php idr myr vnd twd rub ars clp cop egp ngn kes pkr bdt uah ron'.split(' '));
const WORDS = { dollar: 'usd', dollars: 'usd', buck: 'usd', bucks: 'usd', euro: 'eur', euros: 'eur', pound: 'gbp', pounds: 'gbp', sterling: 'gbp', yen: 'jpy', franc: 'chf', francs: 'chf', rupee: 'inr', rupees: 'inr', peso: 'mxn', pesos: 'mxn', yuan: 'cny', rand: 'zar', krona: 'sek', kronor: 'sek', loonie: 'cad' };
const SYMBOLS = { '$': 'usd', '€': 'eur', '£': 'gbp', '¥': 'jpy' };
const curOf = (w) => { const k = String(w || '').toLowerCase(); return SYMBOLS[k] || WORDS[k] || (CODES.has(k) ? k : null); };
const CUR = '([a-z]{3,8}|[$€£¥])';
const RATE_LEAD = '(?:at|@|with|using|if|when)\\s+(?:a\\s+|an\\s+|my\\s+|the\\s+)?(?:exchange\\s+|conversion\\s+)?(?:rate|fx)?\\s*(?:of\\s+|is\\s+|=\\s*)?';

/** currency conversion at a typed rate: "convert 100 usd to eur at 0.92", "100 dollars in euros at a rate of 0.9", "if 1 usd is 0.92 eur, what is
 *  250 usd". rate = units of the "to" currency for one of the "from". { amount, from, to, rate } or null (also null for a rate <= 0). Pure. */
export function parseFx(text) {
  const t = tidy(text).replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/([$\u20ac\u00a3\u00a5])\s*(\d+(?:\.\d+)?)/g, '$2 $1').replace(/,\s+/g, ' ').replace(/^(?:please\s+)?/, ''); // 1,000 and $100 read as 1000 and 100 $
  const head = '(?:convert\\s+|exchange\\s+|change\\s+|what\\s+is\\s+|how\\s+much\\s+is\\s+)?(?:' + NUM + '\\s*)?' + CUR + '\\s+(?:to|in|into|as|=)\\s+' + CUR;
  let m = new RegExp('^' + head + '\\s+' + RATE_LEAD + NUM + '(?:\\s*(?:per|a|each|to\\s+the)\\s+\\S+)?$').exec(t);
  let r;
  if (m) r = { amount: m[1] ? toNum(m[1]) : 1, from: curOf(m[2]), to: curOf(m[3]), rate: toNum(m[4]) };
  else if ((m = new RegExp('^(?:if\\s+)?(?:the\\s+)?(?:exchange\\s+)?rate\\s+(?:is|of)\\s+' + NUM + '\\s+(?:then\\s+)?' + head + '$').exec(t))) r = { amount: m[2] ? toNum(m[2]) : 1, from: curOf(m[3]), to: curOf(m[4]), rate: toNum(m[1]) };
  else if ((m = new RegExp('^(?:if\\s+)?1\\s*' + CUR + '\\s*(?:=|is|equals|costs)\\s*' + NUM + '\\s*' + CUR + '\\s+(?:then\\s+)?(?:what\\s+is\\s+|how\\s+much\\s+is\\s+|convert\\s+)?' + NUM + '\\s*' + CUR + '(?:\\s+(?:in|to|into)\\s+' + CUR + ')?$').exec(t))) {
    const a = curOf(m[1]), b = curOf(m[3]), c = curOf(m[5]), d = m[6] ? curOf(m[6]) : null;
    if (!a || !b || !c) return null;
    const rate = toNum(m[2]);
    if (c === a && (!d || d === b)) r = { amount: toNum(m[4]), from: a, to: b, rate };
    else if (c === b && (!d || d === a)) r = { amount: toNum(m[4]), from: b, to: a, rate: 1 / rate };
    else return null;
  }
  if (!r || !r.from || !r.to || r.from === r.to) return null;
  if (!(r.rate > 0) || !Number.isFinite(r.rate) || !Number.isFinite(r.amount) || r.amount < 0 || r.amount > 1e12) return null;
  return r;
}

/** "open a currency converter with my own rate" / "dpi converter": which converter page to open, or null. Pure. */
export function openerOf(text) {
  const t = tidy(text).replace(/^(?:please\s+)?(?:(?:open|show|make|start|give)\s+(?:me\s+)?)?(?:a\s+|an\s+|the\s+|my\s+)?/, '');
  if (/^(?:(?:manual|fixed|custom|own)[\s-]rate\s+currency\s+(?:converter|calculator)|currency\s+(?:converter|calculator)\s+(?:with|using)\s+(?:a\s+|my\s+|my\s+own\s+|an?\s+own\s+)?(?:manual\s+|own\s+|custom\s+|fixed\s+)?(?:exchange\s+)?rates?)$/.test(t)) return 'fx';
  if (/^(?:(?:dpi|ppi|pixel)\s+(?:converter|calculator)|pixels?\s+(?:to|and|<->)\s+(?:cm|centimet(?:er|re)s?|inch(?:es)?)\s+(?:converter|calculator))$/.test(t)) return 'px';
  return null;
}

/** a number for a card: at most 4 decimals, no trailing zeros, thousands separated. Pure. */
export function fmt(n) {
  if (!Number.isFinite(n)) return '';
  const s = Math.abs(n) >= 1000 ? n.toFixed(2) : n.toFixed(4);
  return Number(s).toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/** amount at a rate: { out, inverse } where inverse is the rate the other way round. Pure. */
export function fxConvert(amount, rate) {
  const a = Number(amount), r = Number(rate);
  if (!Number.isFinite(a) || !(r > 0)) return null;
  return { out: Math.round(a * r * 100) / 100, inverse: 1 / r };
}
