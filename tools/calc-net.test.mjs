// tools/calc-net.test.mjs: the calculators added so /calculators/ covers every calculator on calculator.net's home page (docs/PARITY.md),
// each on known answers worked out by hand or from published tables, not from the code under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { run, BY_ID } from '../void-live-deploy/lib/calculators.js';
import { RNG, tvm, rateFor, bracketTax, US_TAX, subnet } from '../void-live-deploy/lib/calculators.js';

const near = (a, b, tol = 0.005, what = '') => assert.ok(Math.abs(a - b) <= tol, what + ' ' + a + ' is not ' + b);
const go = (id, given = {}, units = {}) => { const r = run(id, given, units); assert.equal(r.error, '', id + ': ' + r.error); const o = {}; for (const x of r.outputs) o[x.k] = x.kind === 'text' ? x.si : x.value; return { o, r }; };
const IDS = ['mortgage', 'auto-loan', 'amortization', 'payoff-time', 'interest-rate', 'retirement', 'investment', 'finance-tvm', 'income-tax-us', 'pregnancy', 'due-date', 'conception',
  'fraction-math', 'triangle-solve', 'random-number', 'password-generator', 'time-add', 'hours-worked', 'gpa', 'final-grade', 'ip-subnet'];

test('every gap-fill is there and works on its own defaults', () => { for (const id of IDS) { assert.ok(BY_ID.get(id), id); go(id); } });

test('mortgage: $320,000 at 6.5% for 30 years is $2,022.62 a month before tax and insurance', () => {
  const { o, r } = go('mortgage');
  near(o.pi, 2022.62); near(o.monthly, 2022.62 + 400 + 125); near(o.loan, 320000); near(o.pmimo, 0);
  assert.equal(r.table.rows.length, 360); near(r.table.rows[359][4], 0); near(r.table.rows[0][3], 1733.33); // first month's interest 320000 × 0.065 ÷ 12
  near(go('mortgage', { down: '10' }).o.pmimo, 150); // 0.5% of 360,000 a year
});
test('auto loan: tax on the price less the trade-in, and the payment on what is left', () => {
  const { o } = go('auto-loan'); near(o.stax, 2240); near(o.loan, 29740); near(o.pay, 561.23);
});
test('amortization: $200,000 at 6% for 30 years, the full schedule', () => {
  const { o, r } = go('amortization'); near(o.pay, 1199.10); near(o.interest, 231676.38, 0.02); assert.equal(o.n, 360);
  assert.deepEqual(r.table.head, ['Month', 'Payment', 'Principal', 'Interest', 'Balance']); near(r.table.rows[0][3], 1000); near(r.table.rows[0][2], 199.10);
  const x = go('amortization', { extra: '200' }); assert.ok(x.o.n < 360 && x.o.interest < 231676); near(x.r.table.rows.at(-1)[4], 0);
});
test('payoff time and the rate of a loan', () => {
  const { o } = go('payoff-time'), r = 0.07 / 12; near(o.n, -Math.log(1 - (r * 20000) / 500) / Math.log(1 + r), 1e-9); assert.equal(o.years, '3 years 10 months'); near(o.interest, 500 * o.n - 20000, 1);
  assert.match(run('payoff-time', { pay: '100' }).error, /never ends/);
  near(go('interest-rate', { pay: '386.6560305' }).o.rate, 6, 1e-4); // 20,000 over 60 months at 6% is 386.656…
  near(rateFor(12000, 1000, 12), 0, 1e-12); assert.equal(rateFor(12000, 900, 12), null);
});
test('retirement and investment growth', () => {
  const { o } = go('retirement'), r = 0.005, n = 384, g = (1 + r) ** n, nest = 50000 * g + 1000 * ((g - 1) / r);
  near(o.nest, nest, 0.01); near(o.put, 50000 + 384000); const q = 0.04 / 12; near(o.income, (nest * q) / (1 - (1 + q) ** -300), 0.01);
  near(go('investment', { P: '10000', monthly: '0', r: '7', t: '10', per: '1' }).o.end, 19671.51); // 10,000 × 1.07¹⁰
  const v = go('investment'); assert.equal(v.r.table.rows.length, 20);
});
test('time value of money: each of the five worked from the other four', () => {
  near(tvm('fv', { n: 10, i: 0.06, pv: -10000, pmt: 0, fv: 0 }), 17908.48);
  near(tvm('pv', { n: 10, i: 0.06, pv: 0, pmt: 0, fv: 17908.48 }), -10000);
  near(tvm('pmt', { n: 120, i: 0.005, pv: 0, pmt: 0, fv: 100000 }), -(100000 * 0.005) / (1.005 ** 120 - 1), 1e-9); // about −610.21
  near(tvm('n', { n: 0, i: 0.06, pv: -10000, pmt: 0, fv: 10000 * 1.06 ** 10 }), 10, 1e-9);
  near(tvm('i', { n: 10, i: 0, pv: -10000, pmt: 0, fv: 10000 * 1.06 ** 10 }), 0.06, 1e-10);
  near(go('finance-tvm', { want: 'i', n: '10', py: '1', pv: '-10000', pmt: '0', fv: '17908.48' }).o.ans, 6, 1e-5);
});
test('US federal income tax on the IRS brackets', () => {
  near(go('income-tax-us').o.tax, 13170); // 2026 single: 100,000 − 16,100 = 83,900 taxable
  near(go('income-tax-us', { st: 'mfj', inc: '133000' }).o.tax, 11600); // MFJ taxable 100,800, the top of the 12% band
  near(go('income-tax-us', { year: '2025' }).o.tax, 13449); // 2025 single: 84,250 taxable
  near(bracketTax(105700, US_TAX[2026].br.single).tax, 17966);
  const x = go('income-tax-us', { inc: '50000', pre: '5000', item: '20000' }); near(x.o.ded, 20000); near(x.o.taxable, 25000); near(x.o.marg, 12);
});
test('pregnancy, due date and conception', () => {
  assert.equal(go('pregnancy').o.due, '2027-03-08 (Monday)'); assert.equal(go('pregnancy').o.weeks, '21 weeks 2 days');
  assert.equal(go('pregnancy', { cycle: '30' }).o.due.slice(0, 10), '2027-03-10');
  assert.equal(go('due-date').o.due, '2027-03-08');
  assert.equal(go('due-date', { by: 'conc', d: '2026-06-15' }).o.due, '2027-03-08');
  assert.equal(go('due-date', { by: 'ivf5', d: '2026-06-20' }).o.due, '2027-03-08');
  assert.equal(go('due-date', { by: 'ivf3', d: '2026-06-18' }).o.due, '2027-03-08');
  const c = go('conception').o; assert.equal(c.conc, '2026-06-15'); assert.equal(c.from, '2026-06-10'); assert.equal(c.lmp, '2026-06-01');
});
test('fractions and triangles', () => {
  assert.equal(go('fraction-math').o.frac, '5/6');
  const d = go('fraction-math', { a: '3', b: '4', op: '/', c: '1', d: '2' }).o; assert.equal(d.frac, '3/2'); assert.equal(d.mixed, '1 1/2');
  assert.equal(go('fraction-math', { a: '2', b: '4', op: '-', c: '3', d: '4' }).o.frac, '-1/4');
  assert.match(run('fraction-math', { d: '0' }).error, /zero/);
  const t = go('triangle-solve').o; near(t.C, 90, 1e-9); near(t.area, 6, 1e-9);
  near(go('triangle-solve', { case: 'sas', A: '90' }).o.a, Math.sqrt(41), 1e-9);
  const e = go('triangle-solve', { case: 'asa', A: '60', B: '60', c: '10' }).o; near(e.a, 10, 1e-9); near(e.b, 10, 1e-9); near(e.C, 60, 1e-9);
  assert.match(run('triangle-solve', { a: '1', b: '2', c: '5' }).error, /not make a triangle/);
});
test('random numbers and passwords, on a fixed sequence', () => {
  const keep = RNG.next;
  try {
    RNG.next = () => 0; assert.equal(go('random-number').o.first, 1);
    RNG.next = () => 0.9999999; assert.equal(go('random-number').o.first, 100);
    let i = 0; const seq = [0.1, 0.1, 0.5, 0.9, 0.3, 0.7]; RNG.next = () => seq[i++ % seq.length];
    const all = go('random-number', { lo: '1', hi: '5', n: '5', uniq: 'y' }).o.all.split(', ').map(Number); assert.deepEqual([...all].sort(), [1, 2, 3, 4, 5]);
    RNG.next = Math.random; const p = go('password-generator').o; assert.equal(p.pw.length, 16); near(p.bits, 16 * Math.log2(87), 1e-9);
    for (const re of [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/]) assert.match(p.pw, re);
    assert.match(go('password-generator', { sym: 'n', upper: 'n', len: '12' }).o.pw, /^[a-z0-9]{12}$/);
    assert.doesNotMatch(go('password-generator', { amb: 'y', len: '200' }).o.pw, /[0O1lI]/);
  } finally { RNG.next = keep; }
});
test('time, hours, GPA and final grade', () => {
  const t = go('time-add').o; assert.equal(t.t, '2 days 7 h 15 min 15 s'); near(t.s, 198915, 0);
  assert.equal(go('time-add', { op: '-' }).o.t, '0 days 14 h 14 min 45 s');
  near(go('hours-worked').o.h, 8, 1e-12); near(go('hours-worked', { start: '10:00 pm', end: '6:00 am', brk: '0' }).o.h, 8, 1e-12);
  near(go('hours-worked', { wage: '20' }).o.pay, 160);
  near(go('gpa').o.gpa, 50 / 15, 1e-12); near(go('gpa', { g: '3.5, 4', cr: '2, 2' }).o.gpa, 3.75, 1e-12); assert.match(run('gpa', { cr: '3' }).error, /one credit number/);
  near(go('final-grade').o.need, 95, 1e-9);
});
test('IPv4 subnets', () => {
  const s = subnet('172.16.5.4 255.255.240.0'); assert.equal(s.network, '172.16.0.0/20'); assert.equal(s.broadcast, '172.16.15.255'); assert.equal(s.hosts, 4094); assert.equal(s.kind, 'private (RFC 1918)');
  const a = subnet('8.8.8.8/32'); assert.equal(a.hosts, 1); assert.equal(a.kind, 'public');
  const b = subnet('10.0.0.0/31'); assert.equal(b.hosts, 2); assert.equal(b.first, '10.0.0.0');
  assert.equal(subnet('10.1.2.3/8').wildcard, '0.255.255.255');
  assert.throws(() => subnet('300.1.1.1/24'), /not an IPv4/); assert.throws(() => subnet('1.2.3.4 255.0.255.0'), /not a subnet mask/);
});
