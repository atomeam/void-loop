// The page's currency asks (void.html / index.html: parseCurrency, fxRateAsk, fxTries; asked by Verse, exam prices: "Fix the prices
// exam by solving failures in ethereum and currency conversion queries"). An amount, or the rate alone, reads as a pair; the answer
// comes from whichever of three sources answers first. Run: node --test tools/fx-ask.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const blockOf = (f) => {
  const src = readFileSync(new URL('../void-live-deploy/' + f, import.meta.url), 'utf8');
  const a = src.indexOf('    const FX_CODES = '), b = src.indexOf('    // Arithmetic in words:');
  assert.ok(a > 0 && b > a, 'the currency block is in ' + f);
  return src.slice(a, b);
};
const fx = new Function(blockOf('void.html') + '\nreturn { parseCurrency, fxRateAsk, fxTries };')();

test('both pages carry the same currency code', () => assert.equal(blockOf('void.html'), blockOf('index.html')));

test('an amount and a pair, said every way', () => {
  const cases = {
    '100 usd in eur': [100, 'USD', 'EUR'], '100 usd to eur': [100, 'USD', 'EUR'], 'convert 50 euros to dollars': [50, 'EUR', 'USD'],
    'how much is 100 dollars in euros': [100, 'USD', 'EUR'], '50 eur to usd': [50, 'EUR', 'USD'], '$20 in yen': [20, 'USD', 'JPY'], '1,000 rupees in dollars': [1000, 'INR', 'USD'],
  };
  for (const [a, [amount, from, to]] of Object.entries(cases)) assert.deepEqual(fx.parseCurrency(a), { amount, from, to }, a);
});

test('the rate alone: one of the first currency, in the second', () => {
  for (const a of ['exchange rate usd to eur', 'usd to eur exchange rate', 'the exchange rate of usd to eur', 'usd/eur', 'usd / eur', "today's usd to eur rate",
    'rate between dollars and euros', 'dollars to euros', 'usd vs eur exchange rate', 'current exchange rate usd in eur'])
    assert.deepEqual(fx.parseCurrency(a), { amount: 1, from: 'USD', to: 'EUR' }, a);
  assert.deepEqual(fx.parseCurrency('pounds to yen'), { amount: 1, from: 'GBP', to: 'JPY' });
  // not money: units, the same currency twice, a pair with no rate word and no "to", words that are not currencies
  for (const a of ['miles to km', 'pounds to kg', 'usd to usd', 'usd and eur', 'euro vs dollar', 'interest rate', 'exchange rate', 'heart rate to bpm', 'rate my photo', 'dollars to donuts'])
    assert.equal(fx.parseCurrency(a), null, a);
});

test('three sources, read their own answers: Frankfurter twice and Verse Markets', () => {
  const tries = fx.fxTries('USD', 'EUR', 100);
  assert.deepEqual(tries.map(([u]) => u), ['https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR&amount=100', 'https://api.frankfurter.app/latest?from=USD&to=EUR&amount=100', '/api/markets?w=USDEUR']);
  const direct = tries[0][1]({ amount: 100, base: 'USD', date: '2026-11-05', rates: { EUR: 86.82 } });
  assert.equal(direct.value, 86.82); assert.equal(direct.date, '2026-11-05'); assert.match(direct.src, /Frankfurter/);
  assert.equal(tries[1][1]({ rates: {} }), null);
  const own = tries[2][1]({ ok: true, quotes: [{ ok: true, sym: 'USD/EUR', price: 0.8682, asOf: Date.UTC(2026, 10, 5), source: 'ECB reference rates via frankfurter.dev' }] });
  assert.equal(own.value, 86.82); assert.equal(own.date, '2026-11-05'); assert.match(own.src, /Verse Markets/);
  assert.equal(tries[2][1]({ ok: false }), null); assert.equal(tries[2][1]({ ok: true, quotes: [{ ok: false }] }), null);
});
