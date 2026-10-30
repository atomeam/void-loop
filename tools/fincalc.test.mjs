// lib/fincalc.js: loan payments and schedules, a mortgage, compound interest, percentages, BMI and calories, against worked values
import test from 'node:test';
import assert from 'node:assert/strict';
import { payment, amortize, mortgage, compound, percentOf, whatPercent, change, bmi, bmiBand, healthyRange, bmr, calories, goals, yearsMonths } from '../void-live-deploy/lib/fincalc.js';
const near = (a, b, d = 0.01) => assert.ok(Math.abs(a - b) <= d, a + ' ≈ ' + b);

test('a loan: the annuity payment, the schedule pays it off, extra a month ends it sooner', () => {
  near(payment(200000, 6, 360), 1199.10); near(payment(12000, 0, 12), 1000); assert.equal(payment(0, 5, 12), null);
  const a = amortize(200000, 6, 360); assert.equal(a.months.length, 360); near(a.months[0].interest, 1000); near(a.months[359].balance, 0, 1e-6); near(a.totalInterest, 231676.38, 0.05);
  assert.equal(a.years.length, 30); near(a.years.reduce((s, y) => s + y.principal, 0), 200000, 1e-6);
  const b = amortize(200000, 6, 360, 200); assert.ok(b.payoffMonths < 300 && b.totalInterest < a.totalInterest - 60000, b.payoffMonths);
});
test('a mortgage: the loan after the down payment, plus tax, insurance and fees each month', () => {
  const m = mortgage({ price: 400000, downPct: 20, ratePct: 6.5, years: 30, taxYear: 4800, insYear: 1200, hoa: 50 });
  near(m.loan, 320000); near(m.pay, 2022.62); near(m.monthly, 2022.62 + 400 + 100 + 50);
});
test('compound interest: monthly compounding, contributions, and the yearly rows', () => {
  const c = compound({ principal: 10000, monthly: 0, ratePct: 5, years: 10, per: 12 }); near(c.final, 16470.09);
  const d = compound({ principal: 10000, ratePct: 5, years: 10, per: 1 }); near(d.final, 16288.95);
  const e = compound({ principal: 0, monthly: 100, ratePct: 0, years: 2 }); near(e.final, 2400); assert.equal(e.years.length, 2); near(e.interest, 0);
});
test('percentages, BMI and calories', () => {
  near(percentOf(17, 240), 40.8); near(whatPercent(30, 120), 25); near(change(80, 100), 25); near(change(100, 80), -20); assert.equal(change(0, 5), null);
  near(bmi(70, 175), 22.857, 0.001); assert.equal(bmiBand(22.9), 'a healthy weight'); assert.equal(bmiBand(31), 'obese'); assert.equal(bmiBand(17), 'underweight');
  const [lo, hi] = healthyRange(175); near(lo, 56.66, 0.01); near(hi, 76.26, 0.01);
  near(bmr({ sex: 'male', kg: 80, cm: 180, age: 30 }), 1780); near(bmr({ sex: 'female', kg: 60, cm: 165, age: 30 }), 1320.25);
  near(calories(1780, 1.55), 2759); assert.equal(goals(2000)[2][1], 1450);
});

test('yearsMonths: whole words, no "1 years" and no "0 years"', () => {
  assert.equal(yearsMonths(46), '3 years 10 months');
  assert.equal(yearsMonths(12), '1 year');
  assert.equal(yearsMonths(9), '9 months');
  assert.equal(yearsMonths(13), '1 year 1 month');
  assert.equal(yearsMonths(1), '1 month');
  assert.equal(yearsMonths(360), '30 years');
});
