/**
 * drive-share skill — split a drive's distance and cost. Built by calling two skills Verse already had:
 * the calculator (skills/calc.js evaluate, the same sum tools/calc.test.mjs checks) and the unit converter
 * (skills/convert.js pairOf, convert and fmt). "split a 90 mile drive costing 36 dollars between 3 people",
 * "share a 40 km trip that cost 24 dollars 4 ways". A one-off conversion and a bare sum stay with those skills.
 */
import { evaluate, formatResult } from './calc.js';
import { pairOf, convert, fmt } from './convert.js';

export const builtWith = ['calc', 'convert'];

const otherOf = (unit) => (/^mi/.test(unit) ? 'km' : 'miles');
const wordOf = (unit) => (/^mi/.test(unit) ? 'miles' : 'km');

/** { distance, unit, money, people } when the ask is a drive split both ways, or null. Pure. */
export function shareOf(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const t = raw.toLowerCase();
  if (/\b(?:tip|gratuity|gas|fuel|petrol|diesel|mpg)\b/.test(t)) return null;
  if (!/\b(?:split|share)\b/.test(t)) return null;
  const dist = t.match(/(\d+(?:\.\d+)?)\s*(miles?|mi|kilometers?|kilometres?|kms?|km)\b/);
  const money = t.match(/\$\s*(\d+(?:\.\d+)?)|\b(\d+(?:\.\d+)?)\s*dollars?\b/);
  const people = t.match(/\b(?:between|among)\s+(\d{1,3})\s+people\b/) || t.match(/\b(\d{1,3})\s+ways\b/) || t.match(/\b(\d{1,3})\s+people\b/);
  if (!dist || !money || !people) return null;
  const n = +people[1], miles = /^mi/.test(dist[2]);
  if (!Number.isInteger(n) || n < 2 || n > 100) return null;
  const distance = +dist[1], cost = +(money[1] || money[2]);
  if (!(distance > 0) || !(cost > 0)) return null;
  return { distance, unit: miles ? 'mi' : 'km', money: cost, people: n, raw };
}

function shown(n) {
  const r = formatResult(n);
  return r;
}

export function answerOf(q) {
  const eachMoney = evaluate(q.money + ' / ' + q.people);
  const eachDist = evaluate(q.distance + ' / ' + q.people);
  const from = wordOf(q.unit), to = otherOf(q.unit);
  const pair = pairOf(from, to);
  const totalOther = pair ? convert(pair.kind, pair.from, pair.to, q.distance) : null;
  const eachOther = pair && eachDist.ok ? convert(pair.kind, pair.from, pair.to, eachDist.value) : null;
  const unit = q.unit === 'mi' ? 'miles' : 'km';
  const other = q.unit === 'mi' ? 'km' : 'miles';
  const money = eachMoney.ok ? '$' + shown(eachMoney.value) : '';
  const distEach = eachDist.ok ? shown(eachDist.value) : '';
  const totalBit = totalOther == null ? q.distance + ' ' + unit : q.distance + ' ' + unit + ' (' + fmt(totalOther) + ' ' + other + ')';
  const eachBit = distEach ? distEach + ' ' + unit + (eachOther == null ? '' : ' (' + fmt(eachOther) + ' ' + other + ')') : '';
  return totalBit + ' costing $' + shown(q.money) + ', split ' + q.people + ' ways: ' + eachBit + ' and ' + money + ' each.';
}

function run(text, api) {
  const q = shareOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  const line = answerOf(q);
  showPage((el) => {
    el.innerHTML = '<h2>Drive share</h2><p>' + esc(line) + '</p>'
      + '<p class="built-with">Built with the calculator and the unit converter.</p>'
      + '<p class="src">Source: the calculator\'s own sum and the unit converter\'s miles and kilometres (NIST SP 811).</p>';
  });
  return 'drive-share';
}

export default {
  name: 'drive-share',
  builtWith,
  examples: [
    'split a 90 mile drive costing 36 dollars between 3 people',
    'share a 40 km trip that cost 24 dollars 4 ways',
  ],
  nearMisses: [
    '5 miles in km',
    'what is 36 / 3',
    'unit converter',
    'open a calculator',
    'split 120 between 4 people',
    'gas cost for 320 miles at 28 mpg $3.59 a gallon',
  ],
  match(lower, text) { return !!shareOf(text || lower); },
  run,
};
