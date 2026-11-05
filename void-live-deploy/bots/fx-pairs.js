// Currency-pair bots (one per ordered pair of ECB currencies). The rates are one real Frankfurter call kept by
// tools/open-data.mjs (MIT; the figures are the European Central Bank's reference rates). Each bot is checked, never by
// its own first answer: a round trip, linearity, a positive rate, and the rate equalling the kept table. Major pairs also
// have to sit in a wide published range, so a zero or an inverted table fails. Independent checks (a third currency) live
// in bots/cross-checks.js.
import { FX } from './open-data.js';

const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const WORDS = { dollar: 'usd', dollars: 'usd', euro: 'eur', euros: 'eur', pound: 'gbp', pounds: 'gbp', sterling: 'gbp', yen: 'jpy', yuan: 'cny', renminbi: 'cny', franc: 'chf', francs: 'chf', rupee: 'inr', rupees: 'inr', won: 'krw', peso: 'mxn', pesos: 'mxn', real: 'brl', reais: 'brl', rand: 'zar', krona: 'sek', krone: 'nok', forint: 'huf', zloty: 'pln', lira: 'try', shekel: 'ils', baht: 'thb', ringgit: 'myr' };
// wide ranges a real ECB rate has stayed inside for years; a broken table (0, or dollars and yen swapped) falls outside
const RANGE = { 'eur-usd': [0.5, 2.5], 'eur-jpy': [50, 500], 'eur-gbp': [0.4, 1.5], 'usd-eur': [0.4, 2] };

/** euros per 1 unit of `code` in the kept table (EUR is 1) */
export function perEuro(code) {
  const c = String(code || '').toUpperCase();
  if (c === 'EUR') return 1;
  const r = FX.rates && FX.rates[c];
  return typeof r === 'number' && r > 0 ? r : NaN;
}
/** how many `to` one `from` buys */
export function crossRate(from, to) {
  return perEuro(to) / perEuro(from);
}
/** a word or a 3-letter code Verse has a rate for, else null */
export function fxCode(word) {
  const k = String(word || '').toLowerCase().replace(/\.$/, '').trim();
  const code = WORDS[k] || (/^[a-z]{3}$/.test(k) ? k : '');
  return code && FX.names && FX.names[code.toUpperCase()] ? code : null;
}
export const FX_CODES = () => Object.keys(FX.names || {}).map((c) => c.toLowerCase()).sort();

export function fxPairs() {
  const codes = Object.keys(FX.names || {}).sort(), out = [];
  for (const a of codes) for (const b of codes) if (a !== b) {
    const A = a.toLowerCase(), B = b.toLowerCase();
    const f = (n) => n * crossRate(a, b);
    const range = RANGE[A + '-' + B];
    const checks = [
      ['kept a real ECB call', () => FX.status === 200 && FX.cors === '*' && /^\d{4}-\d\d-\d\d/.test(FX.date) && FX.rates && FX.rates.USD > 0 && Number.isFinite(perEuro(a)) && Number.isFinite(perEuro(b))],
      ['round trip', () => [1, 7.5, 1234].every((n) => near(f(n) * crossRate(b, a), n))],
      ['linear', () => near(f(6), 6 * f(1)) && f(0) === 0],
      ['matches the kept table', () => near(f(1), crossRate(a, b)) && f(1) > 0],
    ];
    if (range) checks.push(['in the published range', () => f(1) > range[0] && f(1) < range[1]]);
    out.push({ id: 'fx-' + A + '-to-' + B, cat: 'money', family: 'currency pairs', job: 'Converts ' + (FX.names[a] || a) + ' to ' + (FX.names[b] || b) + ' at the ECB rate of ' + FX.date + ' (Frankfurter)', from: ['bots/unit-converter', 'skills/convert.js'], sample: '1',
      run: (s) => { const n = parseFloat(String(s).replace(/,/g, '')); const x = Number.isFinite(n) ? n : 1; return (+f(x).toPrecision(10)) + ' ' + b; }, checks });
  }
  return out;
}
