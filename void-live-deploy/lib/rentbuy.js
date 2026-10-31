/**
 * rentbuy: rent or buy, worked out month by month on the visitor's own numbers. Both sides start with the same money. The buyer pays the
 * down payment and the buying costs, then the mortgage and a yearly share of the home's value for tax, insurance and upkeep. The renter
 * keeps the down payment and the buying costs invested, and pays the rent. Each month, whoever pays less invests the difference. After each
 * year, the buyer's wealth is the home's value less the selling costs and the loan still owed, plus the buyer's investments; the renter's
 * wealth is the renter's investments. The break-even year is the first year after which the buyer is ahead. It leaves out income tax
 * (the mortgage interest deduction, tax on investment gains) and any rent deposit. Used by skills/rentbuy.js and the rent-vs-buy
 * calculator of /calculators/. Pure. Tests: tools/rentbuy.test.mjs.
 */
import { payment } from './fincalc.js';

/** example values, shown as such and changed by the visitor: not today's market */
export const RENTBUY_DEFAULTS = Object.freeze({ price: 400000, downPct: 20, ratePct: 6.5, termYears: 30, rent: 2000, rentGrowthPct: 3, homeGrowthPct: 3, ownPct: 2.5, buyPct: 3, sellPct: 6, investPct: 5, years: 30 });

/** { breakEven: year or null, aheadAtEnd, years: [{ year, buy, rent }], pay, ownFirst, buyFirst, rentFirst, loan, upfront } or null. Pure. */
export function rentVsBuy(input = {}) {
  const o = { ...RENTBUY_DEFAULTS, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)))) };
  for (const k of Object.keys(o)) o[k] = Number(o[k]);
  const Y = Math.round(o.years), n = Math.round(o.termYears * 12);
  if (!(o.price > 0) || !(o.rent > 0) || !(o.downPct >= 0 && o.downPct <= 100) || !(Y >= 1 && Y <= 50) || !(n >= 1 && n <= 600) || !(o.ratePct >= 0 && o.ratePct < 100)) return null;
  const down = (o.price * o.downPct) / 100, loan = o.price - down, upfront = down + (o.price * o.buyPct) / 100;
  const pay = loan > 0 ? payment(loan, o.ratePct, n) : 0;
  if (pay === null) return null;
  const r = o.ratePct / 1200, inv = Math.pow(1 + o.investPct / 100, 1 / 12) - 1, hg = Math.pow(1 + o.homeGrowthPct / 100, 1 / 12) - 1;
  let bal = loan, value = o.price, renter = upfront, buyer = 0, breakEven = null, ownFirst = 0, rentFirst = 0;
  const years = [];
  for (let m = 1; m <= Y * 12; m++) {
    const own = (value * o.ownPct) / 100 / 12, rent = o.rent * Math.pow(1 + o.rentGrowthPct / 100, Math.floor((m - 1) / 12));
    let due = 0;
    if (bal > 1e-9 && m <= n) { const interest = bal * r; due = Math.min(pay, bal + interest); bal = Math.max(0, bal - (due - interest)); }
    const cost = due + own;
    if (m === 1) { ownFirst = own; rentFirst = rent; }
    renter *= 1 + inv; buyer *= 1 + inv; value *= 1 + hg;
    if (cost > rent) renter += cost - rent; else buyer += rent - cost;
    if (m % 12 === 0) {
      const b = value * (1 - o.sellPct / 100) - bal + buyer, y = m / 12;
      years.push({ year: y, buy: b, rent: renter });
      if (breakEven === null && b >= renter) breakEven = y;
    }
  }
  const last = years[years.length - 1];
  return { breakEven, aheadAtEnd: last.buy >= last.rent ? 'buy' : 'rent', years, pay, ownFirst, buyFirst: pay + ownFirst, rentFirst, loan, upfront, inputs: o };
}
