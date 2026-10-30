// The loan skill answers how long a fixed monthly payment takes to pay off a balance (skills/loan.js payoffOf and payoff):
// the parse, the month-by-month sum against the payoff-time calculator of /calculators/, and the asks it must leave alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { payoffOf, payoff } from '../void-live-deploy/skills/loan.js';
import { BY_ID, run } from '../void-live-deploy/lib/calculators.js';

test('payoffOf reads the balance, the rate and the monthly payment', () => {
  assert.deepEqual(payoffOf('how long to pay off 1000 at 5% paying 200 a month'), { principal: 1000, apr: 5, pay: 200, kind: 'debt' });
  assert.deepEqual(payoffOf('how many months to pay off a $5,000 credit card at 22% paying $150 a month'), { principal: 5000, apr: 22, pay: 150, kind: 'credit card' });
  assert.deepEqual(payoffOf('how long to pay off my car loan of 12000 at 6% with 400 a month'), { principal: 12000, apr: 6, pay: 400, kind: 'car loan' });
  assert.deepEqual(payoffOf('how long to pay off 10k at 24% paying 150 per month'), { principal: 10000, apr: 24, pay: 150, kind: 'debt' });
  assert.deepEqual(payoffOf('when will my 8000 student loan at 5% be paid off paying 100 a month'), { principal: 8000, apr: 5, pay: 100, kind: 'student loan' });
});

test('payoffOf leaves asks without a payment, a rate or a payoff alone', () => {
  for (const a of ['how long does it take to pay off a mortgage', 'how long to save 1000 at 200 a month', 'how long to pay off 1000 paying 200 a month',
    'monthly payment on a $250000 mortgage at 6.5% for 30 years', 'how long to pay off 1000 at 5%']) assert.equal(payoffOf(a), null, a);
});

test('payoff counts the months, the last payment and the interest', () => {
  const o = payoff(1000, 5, 200);
  assert.equal(o.months, 6);
  assert.equal(o.last.toFixed(2), '12.69');
  assert.equal(o.interest.toFixed(2), '12.69');
  assert.equal(payoff(1200, 0, 100).months, 12);
  assert.deepEqual(payoff(10000, 24, 150), { never: true, firstInterest: 200 });
});

test('payoff agrees with the payoff-time calculator of /calculators/', () => {
  const calc = BY_ID.get('payoff-time');
  for (const [P, rate, pay] of [[1000, 5, 200], [20000, 7, 500], [5000, 22, 150], [3000, 18, 50]]) {
    const o = payoff(P, rate, pay), r = run(calc, { P: String(P), rate: String(rate), pay: String(pay) });
    const months = Math.ceil(parseFloat(r.outputs.find((x) => x.k === 'n').text) - 1e-9);
    assert.equal(o.months, months, P + ' at ' + rate);
    assert.equal(r.outputs.find((x) => x.k === 'interest').text, '$' + o.interest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), P + ' at ' + rate);
  }
});

test('the payoff card opens the payoff calculator on its numbers, and so does the frame\'s full-page link', async () => {
  const { default: loan } = await import('../void-live-deploy/skills/loan.js'), { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  let el = null; const api = { esc: (s) => String(s), showPage: (f) => { el = { dataset: {} }; f(el); return el; }, _pageStill: () => true };
  await loan.run('how long to pay off 1000 at 4.5% paying 200 a month', api);
  assert.equal(el.dataset.page, '/calculators/?calc=payoff-time&P=1000&rate=4.5&pay=200');
  assert.match(el.innerHTML, /href="\/calculators\/\?calc=payoff-time&P=1000&rate=4\.5&pay=200"/);
  assert.equal(pageOfCard(loan.name, el.dataset.page)[0], el.dataset.page);
});
