/**
 * fincalc: the money and health calculators on /calculator/ (the tower's calculator.net floor: its loan, mortgage, compound interest,
 * percentage, BMI and calorie calculators). A loan is paid monthly at rate/12 a month; the payment is the standard annuity formula, the
 * schedule rounds nothing until it is shown, and the last payment is what is left. Compound interest compounds `per` times a year with
 * contributions at each month's end. BMI is kg / m² with the WHO adult bands; calories are the Mifflin-St Jeor resting rate times an
 * activity factor. Pure. Tests: tools/fincalc.test.mjs.
 */

/** the monthly payment of a loan of `amount` at `ratePct` a year over `months`: amount × r / (1 − (1 + r)^−n), or amount / n at 0 %. Pure. */
export function payment(amount, ratePct, months) {
  const P = Number(amount), n = Math.round(Number(months)), r = Number(ratePct) / 1200;
  if (!(P > 0) || !(n > 0) || !(r >= 0)) return null;
  return r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
}

/** the loan month by month: { pay, months: [{ n, pay, interest, principal, balance }], years: [{ year, interest, principal, balance }],
 *  totalInterest, totalPaid, payoffMonths }. `extra` a month goes to the principal and ends the loan sooner. Pure. */
export function amortize(amount, ratePct, months, extra = 0) {
  const pay = payment(amount, ratePct, months); if (pay === null) return null;
  const r = Number(ratePct) / 1200, add = Math.max(0, Number(extra) || 0), rows = []; let bal = Number(amount);
  for (let n = 1; bal > 1e-9 && n <= Math.round(months); n++) {
    const interest = bal * r, due = Math.min(pay + add, bal + interest), principal = due - interest; bal = Math.max(0, bal - principal);
    rows.push({ n, pay: due, interest, principal, balance: bal });
  }
  const years = []; for (const m of rows) { const y = Math.ceil(m.n / 12); if (!years[y - 1]) years[y - 1] = { year: y, interest: 0, principal: 0, balance: 0 }; years[y - 1].interest += m.interest; years[y - 1].principal += m.principal; years[y - 1].balance = m.balance; }
  const totalInterest = rows.reduce((a, m) => a + m.interest, 0);
  return { pay, months: rows, years, totalInterest, totalPaid: Number(amount) + totalInterest, payoffMonths: rows.length };
}

/** a mortgage: the loan (price − down payment) plus the monthly share of property tax and insurance and the monthly HOA fee. Pure. */
export function mortgage({ price, down = 0, downPct = null, ratePct, years, taxYear = 0, insYear = 0, hoa = 0 }) {
  const dp = downPct !== null && downPct !== '' && Number.isFinite(Number(downPct)) ? (Number(price) * Number(downPct)) / 100 : Number(down) || 0, loan = Number(price) - dp;
  const a = amortize(loan, ratePct, Number(years) * 12); if (!a) return null;
  const tax = (Number(taxYear) || 0) / 12, ins = (Number(insYear) || 0) / 12, fees = Number(hoa) || 0;
  return { ...a, loan, down: dp, tax, ins, hoa: fees, monthly: a.pay + tax + ins + fees };
}

/** compound interest: `principal` grown at `ratePct` a year compounded `per` times a year (1, 4, 12 or 365), plus `monthly` added at each
 *  month's end, for `years`: { final, contributed, interest, years: [{ year, balance, contributed, interest }] }. Pure. */
export function compound({ principal = 0, monthly = 0, ratePct = 0, years = 10, per = 12 }) {
  const k = Math.max(1, Number(per) || 12), r = Number(ratePct) / 100, m = Number(monthly) || 0, Y = Math.max(0, Math.min(100, Math.round(Number(years) || 0)));
  const perMonth = Math.pow(1 + r / k, k / 12) - 1; // the same yearly growth, taken monthly
  let bal = Number(principal) || 0, put = bal; const out = [];
  for (let y = 1; y <= Y; y++) { for (let i = 0; i < 12; i++) { bal = bal * (1 + perMonth) + m; put += m; } out.push({ year: y, balance: bal, contributed: put, interest: bal - put }); }
  return { final: bal, contributed: put, interest: bal - put, years: out };
}

/** the three percentage questions: x % of y, x is what % of y, the % change from x to y. Pure. */
export const percentOf = (x, y) => (Number(x) / 100) * Number(y);
export const whatPercent = (x, y) => (Number(y) ? (Number(x) / Number(y)) * 100 : null);
export const change = (x, y) => (Number(x) ? ((Number(y) - Number(x)) / Math.abs(Number(x))) * 100 : null);

/** BMI from kilograms and centimetres, and the WHO adult band. Pure. */
export function bmi(kg, cm) { const m = Number(cm) / 100, v = Number(kg) / (m * m); return m > 0 && Number(kg) > 0 ? v : null; }
export const bmiBand = (v) => (v === null ? '' : v < 18.5 ? 'underweight' : v < 25 ? 'a healthy weight' : v < 30 ? 'overweight' : 'obese');
/** the weights (kg) that give a BMI of 18.5 and 24.9 at this height. Pure. */
export const healthyRange = (cm) => { const m = Number(cm) / 100; return [18.5 * m * m, 24.9 * m * m]; };

/** resting calories a day (Mifflin-St Jeor): 10 kg + 6.25 cm − 5 age, + 5 for a man, − 161 for a woman. Pure. */
export function bmr({ sex = 'female', kg, cm, age }) { const v = 10 * Number(kg) + 6.25 * Number(cm) - 5 * Number(age) + (sex === 'male' ? 5 : -161); return Number(kg) > 0 && Number(cm) > 0 && Number(age) > 0 ? v : null; }
/** the activity factors calculator.net offers, and the calories to keep, lose or gain weight (about 7,700 kcal a kilogram). */
export const ACTIVITY = Object.freeze([['Sedentary: little or no exercise', 1.2], ['Light: exercise 1 to 3 times a week', 1.375], ['Moderate: exercise 4 to 5 times a week', 1.55], ['Active: daily exercise or hard exercise 3 to 4 times a week', 1.725], ['Very active: hard exercise 6 to 7 times a week', 1.9]]);
export const calories = (rest, factor) => (rest === null ? null : rest * Number(factor));
export const goals = (keep) => (keep === null ? [] : [['Keep your weight', keep], ['Lose 0.25 kg a week', keep - 275], ['Lose 0.5 kg a week', keep - 550], ['Lose 1 kg a week', keep - 1100], ['Gain 0.25 kg a week', keep + 275], ['Gain 0.5 kg a week', keep + 550]]);
