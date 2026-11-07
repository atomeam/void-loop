// VAT engine: integer kopeck arithmetic with a strict half-up rounding rule.
// The VAT amount is rounded half up to a whole kopeck, and the other side of the pair is derived
// by addition or subtraction so net + vat = gross always holds exactly.

const MAX_AMOUNT = 10n ** 15n;
const MAX_RATE = 10000n;

function toBigInt(value, kind) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value)) {
    if (value < 0 || value > Number.MAX_SAFE_INTEGER) return null;
    return BigInt(value);
  }
  return null;
}

function normalizeAmount(value) {
  const v = toBigInt(value, 'amount');
  if (v === null || v < 0n || v > MAX_AMOUNT) return null;
  return v;
}

function normalizeRate(value) {
  const v = toBigInt(value, 'rate');
  if (v === null || v < 0n || v > MAX_RATE) return null;
  return v;
}

function roundHalfUp(numerator, denominator) {
  const q = numerator / denominator;
  const r = numerator % denominator;
  return (r * 2n >= denominator) ? q + 1n : q;
}


export const RATE_PRESETS = [
  { id: '0', rate: 0n, note: 'zero rate' },
  { id: '10', rate: 1000n, note: '10% rate' },
  { id: '20', rate: 2000n, note: 'shipments before 2026-01-01 and corrections to them.' },
  { id: '22', rate: 2200n, note: 'standard rate since 2026-01-01.' },
];

export function vatFromNet(netKop, bp) {
  const net = normalizeAmount(netKop);
  const rate = normalizeRate(bp);
  if (net === null) return { error: 'invalid-amount' };
  if (rate === null) return { error: 'invalid-rate' };
  const vat = rate === 0n ? 0n : roundHalfUp(net * rate, 10000n);
  const gross = net + vat;
  return { net, vat, gross };
}

export function vatFromGross(grossKop, bp) {
  const gross = normalizeAmount(grossKop);
  const rate = normalizeRate(bp);
  if (gross === null) return { error: 'invalid-amount' };
  if (rate === null) return { error: 'invalid-rate' };
  if (rate === 0n) return { net: gross, vat: 0n, gross };
  const vat = roundHalfUp(gross * rate, 10000n + rate);
  const net = gross - vat;
  return { net, vat, gross };
}

// The page's API (/vat/app.js, lib/vat-ask.js, tools/vat.test.mjs): amounts in roubles and rates in percent, as typed. 2026-11-03: a loop lap
// had pointed these names at the kopeck engine (compute(net, rate) with BigInt kopecks, DEFAULT_RATE 2200n), so the page's compute({ amount,
// rate, mode }) got an error object, every ask parse returned null and tools/vat.test.mjs could not load. They are the first version's API
// again (a63b9e775), and compute now goes through the kopeck engine below, so net + vat = gross to the kopeck.
export const RATES = Object.freeze([22, 20, 18, 10, 5, 0]);
export const DEFAULT_RATE = 22;
export const MODES = Object.freeze(['extract', 'add']);

const clean = (s) => String(s == null ? '' : s).replace(/[\s\u00a0\u2009\u202f]/g, '');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** a typed amount ('1 000,50', '1000.5', 1000) as a number, or null when it is not one or is negative. Pure. */
export function parseAmount(v) {
  if (isNum(v)) return v >= 0 ? v : null;
  let s = clean(v).replace(/[^\d.,\-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return null;
  const dot = s.lastIndexOf('.'), comma = s.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) s = dot > comma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(/,/g, '.');
  else if (comma >= 0) s = s.replace(/,/g, '.');
  if ((s.match(/\./g) || []).length > 1 || s.startsWith('-')) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** a rate in percent, 0 to 100, or null. Pure. */
export function parseRate(v) { const n = parseAmount(v); return n != null && n <= 100 ? n : null; }

/** a number to the kopeck, half away from zero. Pure. */
export function round2(n) {
  const x = Number(n); if (!Number.isFinite(x)) return 0;
  return (x < 0 ? -1 : 1) * (Math.round((Math.abs(x) + Number.EPSILON) * 100) / 100);
}

const toKop = (n) => BigInt(Math.round(round2(n) * 100)), toBp = (r) => BigInt(Math.round(r * 100)), fromKop = (k) => Number(k) / 100;

/** { amount, rate, mode } as typed to { ok, mode, amount, rate, net, vat, gross } in roubles, through the kopeck engine; null when not valid. Pure. */
export function compute({ amount, rate = DEFAULT_RATE, mode = 'extract' } = {}) {
  const a = parseAmount(amount), r = parseRate(rate);
  if (a == null || r == null || a * 100 > Number.MAX_SAFE_INTEGER) return null;
  const add = mode === 'add', k = (add ? vatFromNet : vatFromGross)(toKop(a), toBp(r));
  if (!k || k.error) return null;
  return { ok: true, mode: add ? 'add' : 'extract', amount: round2(a), rate: r, net: fromKop(k.net), vat: fromKop(k.vat), gross: fromKop(k.gross) };
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function wordsUnder1000(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + wordsUnder1000(n % 100) : '');
}
/** a money amount in words, up to 999,999.99: 'one thousand' or 'eight hundred nineteen and 67/100'. Pure. Local: no rate table and no network. */
export function moneyWords(n) {
  const x = round2(n);
  if (!isNum(x) || x < 0 || x >= 1e6) return '';
  const cents = Math.round(Math.abs(x) * 100), whole = Math.floor(cents / 100), frac = cents % 100;
  const w = whole < 1000 ? wordsUnder1000(whole) : wordsUnder1000(Math.floor(whole / 1000)) + ' thousand' + (whole % 1000 ? ' ' + wordsUnder1000(whole % 1000) : '');
  return w + (frac ? ' and ' + String(frac).padStart(2, '0') + '/100' : '');
}

/** 1234.5 as '1 234,50' (ru) or '1,234.50'. Pure. */
export function money(n, lang = 'ru') {
  const x = round2(n), [whole, frac] = Math.abs(x).toFixed(2).split('.');
  return (x < 0 ? '-' : '') + whole.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'ru' ? '\u00a0' : ',') + (lang === 'ru' ? ',' : '.') + frac;
}

/** a rate as written, 22 or 7,5. Pure. */
export function rateText(rate) {
  const x = Number(rate); if (!Number.isFinite(x)) return String(DEFAULT_RATE);
  return String(Math.round(x * 1000) / 1000).replace('.', ',');
}

/** the page state a link's query carries (?sum=&rate=&mode=&lang=). Pure. */
export function stateFromQuery(search) {
  const q = new URLSearchParams(String(search || '').replace(/^\?/, '')), raw = q.has('sum') ? q.get('sum') : q.get('amount'), rate = parseRate(q.get('rate'));
  return { amount: raw == null ? '' : String(raw).slice(0, 40), rate: rate == null ? DEFAULT_RATE : rate, mode: q.get('mode') === 'add' ? 'add' : 'extract', lang: q.get('lang') === 'en' ? 'en' : 'ru' };
}

/** the shortest query for a state (a default rate and mode left out). Pure. */
export function queryFromState({ amount = '', rate = DEFAULT_RATE, mode = 'extract', lang = 'ru' } = {}) {
  const q = new URLSearchParams(), a = clean(amount);
  if (a) q.set('sum', a);
  if (rate !== DEFAULT_RATE) q.set('rate', String(rate));
  if (mode === 'add') q.set('mode', 'add');
  q.set('lang', lang === 'en' ? 'en' : 'ru'); // a shared link opens in the language it was made in
  return '?' + q.toString();
}

// The Russian VAT rates (ndscalc.ru's job, the calculator's VAT mode): the site's own title names 22%, and the Federal Tax Service's news says
// "С 1 января 2026 года ставка НДС составляет 22%" (Federal Law 425-FZ). 20% stays for shipments before 2026 and corrections to them, 10% is the
// reduced rate of the Tax Code (article 164: some food, children's goods, medical goods, books and periodicals), 0% is exports, and 5% and 7% are the
// special rates a business on the simplified tax system (USN) may choose. A list, never fetched: the sum is worked out on the device.
export const RU_RATES = Object.freeze([
  Object.freeze({ rate: 22, note: 'the standard rate from 1 January 2026' }),
  Object.freeze({ rate: 20, note: 'the standard rate before 2026, for earlier shipments and their corrections' }),
  Object.freeze({ rate: 10, note: 'the reduced rate: some food, children\'s goods, medical goods, books and periodicals' }),
  Object.freeze({ rate: 7, note: 'a special rate on the simplified tax system (USN)' }),
  Object.freeze({ rate: 5, note: 'a special rate on the simplified tax system (USN)' }),
  Object.freeze({ rate: 0, note: 'exports and the other zero-rated supplies' }),
]);
/** what a rate is, in words, or '' for a rate that is not one of Russia's. Pure. */
export const rateNote = (rate) => (RU_RATES.find((r) => r.rate === Number(rate)) || { note: '' }).note;

// The whole VAT state in a link's hash (owner's tower, ndscalc.ru: "share the result and reopen it from the link"): '#vat=extract&sum=1000&rate=22'.
// The first key names the panel, so a hash that is not about VAT (#loan) is left alone; the hash never reaches a server.
/** the hash for a state: always the mode, the sum as typed (spaces out, 40 characters at most) and the rate. Pure. */
export function hashFromState({ amount = '', rate = DEFAULT_RATE, mode = 'extract' } = {}) {
  const q = new URLSearchParams(), r = parseRate(rate);
  q.set('vat', mode === 'add' ? 'add' : 'extract');
  const a = clean(amount).slice(0, 40); if (a) q.set('sum', a);
  q.set('rate', String(r == null ? DEFAULT_RATE : r));
  return '#' + q.toString();
}
/** the state a hash carries ({ amount, rate, mode }), or null when the hash is not a VAT one. A rate out of range falls back to the default. Pure. */
export function stateFromHash(hash) {
  const h = String(hash || '').replace(/^#/, ''); if (!/^vat=/.test(h)) return null;
  const q = new URLSearchParams(h), r = parseRate(q.get('rate'));
  return { amount: q.has('sum') ? String(q.get('sum')).slice(0, 40) : '', rate: r == null ? DEFAULT_RATE : r, mode: q.get('vat') === 'add' ? 'add' : 'extract' };
}

/** the two lines of working for a compute() result. Pure. */
export function workingOf(r, lang = 'ru') {
  if (!r || !r.ok) return [];
  const m = (n) => money(n, lang), pct = rateText(r.rate), ru = lang === 'ru';
  if (r.mode === 'add') return ru ? ['НДС = ' + m(r.net) + ' × ' + pct + ' / 100 = ' + m(r.vat), 'Сумма с НДС = ' + m(r.net) + ' + ' + m(r.vat) + ' = ' + m(r.gross)]
    : ['VAT = ' + m(r.net) + ' × ' + pct + ' / 100 = ' + m(r.vat), 'Total with VAT = ' + m(r.net) + ' + ' + m(r.vat) + ' = ' + m(r.gross)];
  return ru ? ['Сумма без НДС = ' + m(r.gross) + ' / (1 + ' + pct + ' / 100) = ' + m(r.net), 'НДС = ' + m(r.gross) + ' − ' + m(r.net) + ' = ' + m(r.vat)]
    : ['Net = ' + m(r.gross) + ' / (1 + ' + pct + ' / 100) = ' + m(r.net), 'VAT = ' + m(r.gross) + ' − ' + m(r.net) + ' = ' + m(r.vat)];
}
