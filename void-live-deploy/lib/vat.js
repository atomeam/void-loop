/**
 * VAT (НДС) arithmetic for /vat/.
 * Pure: no DOM, no network. Money is kept to the kopeck at every step.
 */
export const RATES = Object.freeze([22, 20, 18, 10, 5, 0]);
export const DEFAULT_RATE = 22;
export const MODES = Object.freeze(['extract', 'add']);

const clean = (s) => String(s == null ? '' : s).replace(/[\s\u00a0\u2009\u202f]/g, '');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function parseAmount(v) {
  if (isNum(v)) return v >= 0 ? v : null;
  let s = clean(v).replace(/[^\d.,\-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return null;
  const dot = s.lastIndexOf('.');
  const comma = s.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) {
    if (dot > comma) s = s.replace(/,/g, '');
    else s = s.replace(/\./g, '').replace(/,/g, '.');
  } else if (comma >= 0) {
    s = s.replace(/,/g, '.');
  }
  if ((s.match(/\./g) || []).length > 1) return null;
  if (s.startsWith('-')) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseRate(v) {
  const n = parseAmount(v);
  return n != null && n <= 100 ? n : null;
}

export function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  return sign * (Math.round((a + Number.EPSILON) * 100) / 100);
}

export function compute({ amount, rate = DEFAULT_RATE, mode = 'extract' } = {}) {
  const a = parseAmount(amount);
  const r = parseRate(rate);
  if (a == null || r == null) return null;
  const sum = round2(a);
  if (mode === 'add') {
    const gross = round2(sum * (1 + r / 100));
    return { ok: true, mode: 'add', amount: sum, rate: r, net: sum, vat: round2(gross - sum), gross };
  }
  const net = round2(sum / (1 + r / 100));
  return { ok: true, mode: 'extract', amount: sum, rate: r, net, vat: round2(sum - net), gross: sum };
}

export function money(n, lang = 'ru') {
  const x = round2(n);
  const neg = x < 0;
  const [whole, frac] = Math.abs(x).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'ru' ? '\u00a0' : ',');
  return (neg ? '-' : '') + grouped + (lang === 'ru' ? ',' : '.') + frac;
}

export function rateText(rate) {
  const x = Number(rate);
  if (!Number.isFinite(x)) return String(DEFAULT_RATE);
  return String(Math.round(x * 1000) / 1000).replace('.', ',');
}

export function stateFromQuery(search) {
  const q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const raw = q.has('sum') ? q.get('sum') : q.get('amount');
  const rate = parseRate(q.get('rate'));
  return {
    amount: raw == null ? '' : String(raw).slice(0, 40),
    rate: rate == null ? DEFAULT_RATE : rate,
    mode: q.get('mode') === 'add' ? 'add' : 'extract',
    lang: q.get('lang') === 'en' ? 'en' : 'ru',
  };
}

export function queryFromState({ amount = '', rate = DEFAULT_RATE, mode = 'extract', lang = 'ru' } = {}) {
  const q = new URLSearchParams();
  const a = clean(amount);
  if (a) q.set('sum', a);
  if (rate !== DEFAULT_RATE) q.set('rate', String(rate));
  if (mode === 'add') q.set('mode', 'add');
  if (lang === 'en') q.set('lang', 'en');
  const s = q.toString();
  return s ? '?' + s : '';
}

export function workingOf(r, lang = 'ru') {
  if (!r || !r.ok) return [];
  const m = (n) => money(n, lang);
  const pct = rateText(r.rate);
  if (r.mode === 'add') {
    return lang === 'ru'
      ? ['НДС = ' + m(r.net) + ' × ' + pct + ' / 100 = ' + m(r.vat), 'Сумма с НДС = ' + m(r.net) + ' + ' + m(r.vat) + ' = ' + m(r.gross)]
      : ['VAT = ' + m(r.net) + ' × ' + pct + ' / 100 = ' + m(r.vat), 'Total with VAT = ' + m(r.net) + ' + ' + m(r.vat) + ' = ' + m(r.gross)];
  }
  return lang === 'ru'
    ? ['Сумма без НДС = ' + m(r.gross) + ' / (1 + ' + pct + ' / 100) = ' + m(r.net), 'НДС = ' + m(r.gross) + ' − ' + m(r.net) + ' = ' + m(r.vat)]
    : ['Net = ' + m(r.gross) + ' / (1 + ' + pct + ' / 100) = ' + m(r.net), 'VAT = ' + m(r.gross) + ' − ' + m(r.net) + ' = ' + m(r.vat)];
}
