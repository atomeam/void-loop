/**
 * calculators: the formula library behind /calculators/ (the tower's vcalc.com floor). Each calculator is its inputs (each a quantity of a
 * kind, typed in any unit of that kind), its outputs (each shown in any unit of its kind) and one function on SI values, so a pipe's diameter
 * in inches and its length in feet give its surface area in square feet, square metres or acres alike. Everyday ones first (percent, tip,
 * loan, unit price, BMI, dates), then money, health, geometry, maths, statistics, physics, chemistry, electrical and engineering. run() works
 * one out, fmt() writes a number for people, and the query helpers make every answer a link. Pure. Tests: tools/calculators.test.mjs.
 */
import { KINDS, unitOf, findUnit, toSI, fromSI } from './calc-units.js';
import { payment, amortize, compound, yearsMonths } from './fincalc.js';
import { rentVsBuy } from './rentbuy.js';
import { daysBetween, addDays, businessDaysBetween, ageParts, isDay, DAY_NAMES, parseClock } from './date-math.js';
import { compileAll, compile } from './formula-engine.js';
import { FORMULA_BATCHES } from './formulas.js';

export const CATEGORIES = ['Everyday', 'Money', 'Health', 'Conversions', 'Geometry', 'Maths', 'Statistics', 'Physics', 'Chemistry', 'Electrical', 'Engineering',
  // the formula library's domains (lib/formulas-*.js), each formula defined once and worked for any of its variables
  'Construction', 'Cooking', 'Auto', 'Astronomy', 'Biology', 'Fluids', 'Thermodynamics', 'Optics', 'Earth science', 'Sports'];
const PI = Math.PI, G0 = 9.80665, GRAV = 6.6743e-11, C = 299792458, H = 6.62607015e-34, R_GAS = 8.314462618, NA = 6.02214076e23, SIGMA = 5.670374419e-8;

// 'k|Label|kind|unit|default' for a quantity; kind 'date', 'text', 'list:<kind>' and { k, label, kind:'choice', opts:[[v, label]], v } too
const inp = (s) => { if (typeof s !== 'string') return s; const [k, label, kind, unit = '', v = ''] = s.split('|'); return kind.startsWith('list') ? { k, label, kind: 'list', of: kind.split(':')[1] || 'number', unit, v } : { k, label, kind, unit, v }; };
// 'k|Label|kind|unit' for an output; kind 'text' for words, 'number|suffix' for a plain count with a word after it
const out = (s) => { const [k, label, kind, unit = ''] = s.split('|'); return kind === 'number' ? { k, label, kind, unit: '', sfx: unit } : { k, label, kind, unit }; };
const make = (id, name, cat, formula, ins, outs, f, more = {}) => ({ id, name, cat, formula, inputs: ins.map(inp), outputs: outs.map(out), f, ...more });
const need = (ok, why) => { if (!ok) throw new Error(why); };
const pos = (x, what) => need(x > 0, what + ' must be more than zero');

// --- statistics helpers
const sum = (a) => a.reduce((s, x) => s + x, 0);
const mean = (a) => sum(a) / a.length;
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const variance = (a, sample) => { const m = mean(a); return sum(a.map((x) => (x - m) ** 2)) / (a.length - (sample ? 1 : 0)); };
/** erf to about 1e-15: the Taylor series near zero, a continued fraction for erfc further out. Pure. */
export function erf(x) {
  if (x < 0) return -erf(-x);
  if (x < 2.5) { let term = x, s = x; for (let n = 1; n < 100; n++) { term *= (-x * x) / n; const t = term / (2 * n + 1); s += t; if (Math.abs(t) < 1e-17 * Math.abs(s)) break; } return (2 / Math.sqrt(PI)) * s; }
  let f = 0; for (let n = 60; n >= 1; n--) f = (n / 2) / (x + f); return 1 - Math.exp(-x * x) / Math.sqrt(PI) / (x + f);
}
export const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
const Z = { 80: 1.2815515655446004, 90: 1.6448536269514722, 95: 1.959963984540054, 98: 2.3263478740408408, 99: 2.5758293035489004, 99.9: 3.2905267314918945 };
const CONF = { k: 'conf', label: 'Confidence level', kind: 'choice', opts: [['80', '80%'], ['90', '90%'], ['95', '95%'], ['98', '98%'], ['99', '99%'], ['99.9', '99.9%']], v: '95' };
const lnFact = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
const isInt = (x) => Number.isInteger(x) && x >= 0;
export function choose(n, k) { need(isInt(n) && isInt(k), 'n and r must be whole numbers, 0 or more'); if (k > n) return 0; k = Math.min(k, n - k); let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r > 9e15 ? r : Math.round(r); }
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

// --- chemistry: molar mass of a formula like H2O, Ca(OH)2 or CuSO4·5H2O (IUPAC abridged standard atomic weights)
export const ATOMIC = { H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.18, Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.95,
  K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996, Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Ga: 69.723, Ge: 72.63, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798,
  Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224, Nb: 92.906, Mo: 95.95, Ru: 101.07, Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41, In: 114.82, Sn: 118.71, Sb: 121.76, Te: 127.6, I: 126.9, Xe: 131.29,
  Cs: 132.91, Ba: 137.33, La: 138.91, Ce: 140.12, Nd: 144.24, Gd: 157.25, Hf: 178.49, Ta: 180.95, W: 183.84, Re: 186.21, Os: 190.23, Ir: 192.22, Pt: 195.08, Au: 196.97, Hg: 200.59, Tl: 204.38, Pb: 207.2, Bi: 208.98, Th: 232.04, U: 238.03 };
/** grams per mole of a chemical formula, or throws naming the part it cannot read. Pure. */
export function molarMass(formula) {
  const parts = String(formula ?? '').replace(/\s+/g, '').split(/[·•*.]/).filter(Boolean); need(parts.length, 'type a formula such as H2O');
  let total = 0;
  for (const part of parts) {
    const lead = /^(\d+)(.*)$/.exec(part), times = lead ? Number(lead[1]) : 1, src = lead ? lead[2] : part; let i = 0;
    const group = () => {
      let m = 0;
      while (i < src.length && src[i] !== ')' && src[i] !== ']') {
        let v;
        if (src[i] === '(' || src[i] === '[') { i++; v = group(); need(src[i] === ')' || src[i] === ']', 'a bracket is not closed in ' + formula); i++; }
        else { const el = /^[A-Z][a-z]?/.exec(src.slice(i)); need(el && ATOMIC[el[0]] !== undefined, 'no element "' + (el ? el[0] : src[i]) + '" in ' + formula); v = ATOMIC[el[0]]; i += el[0].length; }
        const n = /^\d+/.exec(src.slice(i)); if (n) { v *= Number(n[0]); i += n[0].length; }
        m += v;
      }
      return m;
    };
    const m = group(); need(i >= src.length, 'a bracket closes too soon in ' + formula); total += times * m;
  }
  return total;
}

const daysText = (n) => n + (Math.abs(n) === 1 ? ' day' : ' days');
const weekday = (iso) => DAY_NAMES[new Date(iso + 'T00:00:00Z').getUTCDay()];
const isoDay = (s) => { need(isDay(String(s)), 'write the date as YYYY-MM-DD'); return String(s); };
const paceText = (secPerM, per) => { const s = Math.round(secPerM * per); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export const CALCULATORS = [];

// ---------------- Everyday
CALCULATORS.push(
  make('percent-of', 'Percent of a number', 'Everyday', 'result = p × x', ['p|Percent|ratio|%|17', 'x|Number|number||240'], ['r|Result|number'], (x) => ({ r: x.p * x.x }), { everyday: true }),
  make('what-percent', 'What percent is x of y', 'Everyday', 'percent = x ÷ y', ['x|Part|number||45', 'y|Whole|number||180'], ['p|Percent|ratio|%'], (x) => { need(x.y !== 0, 'the whole cannot be zero'); return { p: x.x / x.y }; }, { everyday: true }),
  make('percent-change', 'Percent change', 'Everyday', 'change = (new − old) ÷ old', ['a|Old value|number||80', 'b|New value|number||100'], ['p|Change|ratio|%', 'd|Difference|number'], (x) => { need(x.a !== 0, 'the old value cannot be zero'); return { p: (x.b - x.a) / Math.abs(x.a), d: x.b - x.a }; }, { everyday: true }),
  make('tip', 'Tip and split the bill', 'Everyday', 'tip = bill × rate; each = (bill + tip) ÷ people', ['bill|Bill|money|$|45', 'rate|Tip|ratio|%|20', 'people|People|number||2'], ['tip|Tip|money|$', 'total|Total|money|$', 'each|Each person pays|money|$'], (x) => { pos(x.people, 'People'); const tip = x.bill * x.rate; return { tip, total: x.bill + tip, each: (x.bill + tip) / x.people }; }, { everyday: true }),
  make('discount', 'Discount (percent off)', 'Everyday', 'sale price = price × (1 − off)', ['price|Price|money|$|80', 'off|Percent off|ratio|%|25'], ['save|You save|money|$', 'sale|Sale price|money|$'], (x) => ({ save: x.price * x.off, sale: x.price * (1 - x.off) }), { everyday: true }),
  make('sales-tax', 'Sales tax', 'Everyday', 'total = price × (1 + tax rate)', ['price|Price before tax|money|$|50', 'rate|Tax rate|ratio|%|8.875'], ['tax|Tax|money|$', 'total|Total|money|$'], (x) => ({ tax: x.price * x.rate, total: x.price * (1 + x.rate) }), { everyday: true }),
  make('unit-price', 'Unit price (by weight)', 'Everyday', 'unit price = price ÷ weight', ['price|Price|money|$|4.99', 'm|Weight|mass|oz|16'], ['up|Unit price|pricemass|$/lb'], (x) => { pos(x.m, 'Weight'); return { up: x.price / x.m }; }, { everyday: true }),
  make('unit-price-volume', 'Unit price (by volume)', 'Everyday', 'unit price = price ÷ volume', ['price|Price|money|$|3.49', 'v|Volume|volume|fl oz|64'], ['up|Unit price|pricevolume|$/L'], (x) => { pos(x.v, 'Volume'); return { up: x.price / x.v }; }, { everyday: true }),
  make('fuel-cost', 'Fuel cost of a trip', 'Everyday', 'fuel = distance ÷ economy; cost = fuel × price', ['d|Distance|length|mi|300', 'econ|Fuel economy|fuel|mpg|30', 'price|Fuel price|pricevolume|$/gal|3.5'], ['fuel|Fuel used|volume|gal', 'cost|Cost|money|$'], (x) => { pos(x.econ, 'Fuel economy'); const fuel = x.d / x.econ; return { fuel, cost: fuel * x.price }; }, { everyday: true }),
  make('electricity-cost', 'Electricity cost', 'Everyday', 'energy = power × hours a day × days; cost = energy × price', ['p|Power|power|W|1500', 't|Hours a day|time|h|3', 'days|Days|number||30', 'price|Price|priceenergy|$/kWh|0.17'], ['e|Energy used|energy|kWh', 'cost|Cost|money|$'], (x) => { const e = x.p * x.t * x.days; return { e, cost: e * x.price }; }, { everyday: true }),
  make('rectangle-area', 'Area of a room or rectangle', 'Everyday', 'area = length × width', ['l|Length|length|ft|12', 'w|Width|length|ft|10'], ['a|Area|area|ft²', 'p|Perimeter|length|ft'], (x) => ({ a: x.l * x.w, p: 2 * (x.l + x.w) }), { everyday: true }),
  make('bmi', 'Body mass index (BMI)', 'Everyday', 'BMI = mass ÷ height²', ['m|Weight|mass|kg|70', 'h|Height|length|cm|175'], ['bmi|BMI|number|kg/m²', 'band|Adult band (WHO)|text'], (x) => { pos(x.h, 'Height'); pos(x.m, 'Weight'); const b = x.m / (x.h * x.h); return { bmi: b, band: b < 18.5 ? 'underweight' : b < 25 ? 'healthy weight' : b < 30 ? 'overweight' : 'obesity' }; }, { everyday: true }),
  make('days-between', 'Days between two dates', 'Everyday', 'days = to − from', ['from|From|date||2026-01-01', 'to|To|date||2026-12-25'], ['days|Days|number|days', 'weeks|Weeks and days|text', 'work|Weekdays (Mon–Fri, end day not counted)|number|days'], (x) => { const a = isoDay(x.from), b = isoDay(x.to), n = daysBetween(a, b); return { days: n, weeks: Math.trunc(n / 7) + ' weeks ' + daysText(Math.abs(n % 7)), work: n >= 0 ? businessDaysBetween(a, b) : -businessDaysBetween(b, a) }; }, { everyday: true }),
  make('add-days', 'Add days to a date', 'Everyday', 'date + days', ['from|Start date|date||2026-10-28', 'n|Days to add (negative to go back)|number||90'], ['date|Date|text', 'day|Day of the week|text'], (x) => { const d = addDays(isoDay(x.from), Math.round(x.n)); return { date: d, day: weekday(d) }; }, { everyday: true }),
  make('age', 'Age from a birth date', 'Everyday', 'age = on date − birth date', ['birth|Birth date|date||1990-05-15', 'on|On|date||2026-10-28'], ['age|Age|text', 'days|Days alive|number|days', 'born|Day of the week born|text'], (x) => { const p = ageParts(isoDay(x.birth), isoDay(x.on)); need(p, 'the birth date is after the other date'); return { age: p.years + ' years, ' + p.months + ' months, ' + daysText(p.days), days: p.totalDays, born: weekday(x.birth) }; }, { everyday: true }),
  make('convert', 'Unit converter', 'Everyday', 'value × factor (every unit of the kind)', ['v|Value|length|ft|6'], ['r|Value in|length|m'], (x) => ({ r: x.v }), { everyday: true, convert: true }),
  make('temperature', 'Temperature converter', 'Conversions', '°C = (°F − 32) × 5/9; K = °C + 273.15', ['t|Temperature|temperature|°F|98.6'], ['c|Celsius|temperature|°C', 'k|Kelvin|temperature|K', 'f|Fahrenheit|temperature|°F'], (x) => ({ c: x.t, k: x.t, f: x.t }), { everyday: true }),
);
// ---------------- Money
CALCULATORS.push(
  make('loan-payment', 'Loan payment', 'Money', 'payment = P × r ÷ (1 − (1 + r)^−n), r = rate ÷ 12', ['P|Loan amount|money|$|25000', 'rate|Interest rate (a year)|ratio|%|6', 'term|Term|time|month|60'], ['pay|Monthly payment|money|$', 'total|Total paid|money|$', 'interest|Total interest|money|$'], (x) => { const n = Math.round(x.term / 2629800); pos(n, 'Term'); const p = payment(x.P, x.rate * 100, n); need(p !== null, 'check the amount and rate'); return { pay: p, total: p * n, interest: p * n - x.P }; }, { everyday: true }),
  make('compound-interest', 'Compound interest', 'Money', 'A = P × (1 + r ÷ n)^(n × t)', ['P|Starting amount|money|$|10000', 'r|Interest rate (a year)|ratio|%|5', 't|Time|time|yr|10', 'n|Compounds a year|number||12'], ['A|Final amount|money|$', 'i|Interest earned|money|$'], (x) => { pos(x.n, 'Compounds a year'); const A = x.P * Math.pow(1 + x.r / x.n, x.n * (x.t / 31557600)); return { A, i: A - x.P }; }),
  make('simple-interest', 'Simple interest', 'Money', 'I = P × r × t', ['P|Principal|money|$|5000', 'r|Interest rate (a year)|ratio|%|4', 't|Time|time|yr|3'], ['i|Interest|money|$', 'A|Total|money|$'], (x) => { const i = x.P * x.r * (x.t / 31557600); return { i, A: x.P + i }; }),
  make('savings-goal', 'Monthly saving for a goal', 'Money', 'deposit = goal × r ÷ ((1 + r)^n − 1), r = rate ÷ 12', ['goal|Goal|money|$|20000', 'rate|Interest rate (a year)|ratio|%|4', 't|Time|time|yr|5'], ['dep|Save each month|money|$'], (x) => { const n = Math.round(x.t / 2629800), r = x.rate / 12; pos(n, 'Time'); return { dep: r === 0 ? x.goal / n : (x.goal * r) / (Math.pow(1 + r, n) - 1) }; }),
  make('roi', 'Return on investment (ROI)', 'Money', 'ROI = (value − cost) ÷ cost', ['cost|Cost|money|$|1000', 'value|Value now|money|$|1250'], ['roi|ROI|ratio|%', 'gain|Gain|money|$'], (x) => { need(x.cost !== 0, 'the cost cannot be zero'); return { roi: (x.value - x.cost) / x.cost, gain: x.value - x.cost }; }),
  make('cagr', 'Growth rate a year (CAGR)', 'Money', 'CAGR = (end ÷ start)^(1 ÷ years) − 1', ['a|Start value|money|$|1000', 'b|End value|money|$|2000', 't|Time|time|yr|6'], ['g|Growth a year|ratio|%'], (x) => { pos(x.a, 'Start value'); pos(x.t, 'Time'); return { g: Math.pow(x.b / x.a, 1 / (x.t / 31557600)) - 1 }; }),
  make('margin', 'Profit margin and markup', 'Money', 'margin = (price − cost) ÷ price; markup = (price − cost) ÷ cost', ['cost|Cost|money|$|60', 'price|Selling price|money|$|100'], ['profit|Profit|money|$', 'margin|Margin|ratio|%', 'markup|Markup|ratio|%'], (x) => { pos(x.price, 'Price'); pos(x.cost, 'Cost'); return { profit: x.price - x.cost, margin: (x.price - x.cost) / x.price, markup: (x.price - x.cost) / x.cost }; }),
  make('break-even', 'Break-even point', 'Money', 'units = fixed costs ÷ (price − cost per unit)', ['fixed|Fixed costs|money|$|12000', 'price|Price per unit|money|$|40', 'var|Cost per unit|money|$|25'], ['n|Units to break even|number|units', 'rev|Revenue at break-even|money|$'], (x) => { need(x.price > x.var, 'the price must be more than the cost per unit'); const n = x.fixed / (x.price - x.var); return { n, rev: n * x.price }; }),
  make('salary', 'Hourly wage to salary', 'Money', 'a year = wage × hours a week × weeks', ['w|Hourly wage|money|$|25', 'h|Hours a week|number||40', 'wk|Weeks a year|number||52'], ['year|A year|money|$', 'month|A month|money|$', 'week|A week|money|$'], (x) => ({ year: x.w * x.h * x.wk, month: (x.w * x.h * x.wk) / 12, week: x.w * x.h })),
  make('inflation', 'Future cost with inflation', 'Money', 'future = cost × (1 + rate)^years', ['cost|Cost today|money|$|100', 'rate|Inflation a year|ratio|%|3', 't|Years|time|yr|10'], ['fut|Future cost|money|$', 'power|What today\'s money buys then|ratio|%'], (x) => { const k = Math.pow(1 + x.rate, x.t / 31557600); return { fut: x.cost * k, power: 1 / k }; }),
);
// ---------------- Health
CALCULATORS.push(
  make('bmr', 'Calories a day (Mifflin-St Jeor)', 'Health', 'BMR = 10 × kg + 6.25 × cm − 5 × age + 5 (men) or − 161 (women)', [{ k: 'sex', label: 'Sex', kind: 'choice', opts: [['m', 'male'], ['f', 'female']], v: 'm' }, 'age|Age (years)|number||30', 'm|Weight|mass|kg|70', 'h|Height|length|cm|175',
    { k: 'act', label: 'Activity', kind: 'choice', opts: [['1.2', 'little or none'], ['1.375', 'light, 1–3 days a week'], ['1.55', 'moderate, 3–5 days'], ['1.725', 'hard, 6–7 days'], ['1.9', 'very hard or a physical job']], v: '1.2' }],
    ['bmr|Resting (BMR)|number|kcal a day', 'tdee|With activity|number|kcal a day'], (x) => { const b = 10 * x.m + 625 * x.h - 5 * x.age + (x.sex === 'f' ? -161 : 5); return { bmr: b, tdee: b * Number(x.act) }; }),
  make('one-rep-max', 'One-rep max (Epley)', 'Health', '1RM = weight × (1 + reps ÷ 30)', ['w|Weight lifted|mass|lb|185', 'reps|Reps|number||5'], ['max|One-rep max|mass|lb'], (x) => { pos(x.reps, 'Reps'); return { max: x.reps === 1 ? x.w : x.w * (1 + x.reps / 30) }; }),
  make('heart-rate', 'Target heart rate (Karvonen)', 'Health', 'target = (220 − age − resting) × intensity + resting', ['age|Age (years)|number||40', 'rest|Resting heart rate|frequency|/min|65', 'lo|Low intensity|ratio|%|50', 'hi|High intensity|ratio|%|85'], ['max|Maximum heart rate|frequency|/min', 'low|Zone from|frequency|/min', 'high|Zone to|frequency|/min'], (x) => { const max = (220 - x.age) / 60; return { max, low: (max - x.rest) * x.lo + x.rest, high: (max - x.rest) * x.hi + x.rest }; }),
  make('body-surface-area', 'Body surface area (Mosteller)', 'Health', 'BSA = √(cm × kg ÷ 3600) m²', ['h|Height|length|cm|175', 'm|Weight|mass|kg|70'], ['bsa|Body surface area|area|m²'], (x) => ({ bsa: Math.sqrt((x.h * 100 * x.m) / 3600) })),
  make('ideal-weight', 'Ideal body weight (Devine)', 'Health', '50 kg (men) or 45.5 kg (women) + 2.3 kg per inch over 5 ft', [{ k: 'sex', label: 'Sex', kind: 'choice', opts: [['m', 'male'], ['f', 'female']], v: 'm' }, 'h|Height|length|in|70'], ['w|Ideal body weight|mass|kg'], (x) => ({ w: (x.sex === 'f' ? 45.5 : 50) + 2.3 * (x.h / 0.0254 - 60) })),
  make('pace', 'Running pace', 'Health', 'pace = time ÷ distance', ['d|Distance|length|km|10', 't|Time|time|min|50'], ['km|Pace per kilometre (min:s)|text', 'mi|Pace per mile (min:s)|text', 'v|Speed|speed|km/h'], (x) => { pos(x.d, 'Distance'); pos(x.t, 'Time'); return { km: paceText(x.t / x.d, 1000), mi: paceText(x.t / x.d, 1609.344), v: x.d / x.t }; }),
);
// ---------------- Conversions
CALCULATORS.push(
  make('feet-inches', 'Decimal feet to feet and inches', 'Conversions', 'inches = (feet − whole feet) × 12, to the nearest 1/16', ['l|Length|length|ft|5.79'], ['fi|Feet and inches|text', 'in|Inches|length|in'], (x) => { const s16 = Math.round((x.l / 0.0254) * 16), ft = Math.floor(s16 / 192), rest = s16 - ft * 192, inch = Math.floor(rest / 16); let fr = rest % 16, den = 16; while (fr && fr % 2 === 0) { fr /= 2; den /= 2; } return { fi: ft + ' ft ' + inch + (fr ? ' ' + fr + '/' + den : '') + ' in', in: x.l }; }),
  make('fuel-economy', 'Fuel economy (mpg and L/100 km)', 'Conversions', 'L/100 km = 100 ÷ (km per litre)', ['e|Fuel economy|fuel|mpg|30'], ['l100|Litres per 100 km|number|L/100 km', 'kml|Kilometres per litre|fuel|km/L', 'mpg|Miles per US gallon|fuel|mpg'], (x) => { pos(x.e, 'Fuel economy'); return { l100: 100 / (x.e / 1e6), kml: x.e, mpg: x.e }; }),
  make('cooking', 'Cooking measures', 'Conversions', 'one volume in cups, spoons, millilitres and ounces', ['v|Amount|volume|cup|1.5'], ['ml|Millilitres|volume|mL', 'tbsp|Tablespoons|volume|tbsp', 'tsp|Teaspoons|volume|tsp', 'floz|Fluid ounces|volume|fl oz'], (x) => ({ ml: x.v, tbsp: x.v, tsp: x.v, floz: x.v })),
);
// ---------------- Geometry
CALCULATORS.push(
  make('circle', 'Circle', 'Geometry', 'A = π r²; C = 2 π r', ['r|Radius|length|cm|5'], ['a|Area|area|cm²', 'c|Circumference|length|cm', 'd|Diameter|length|cm'], (x) => ({ a: PI * x.r * x.r, c: 2 * PI * x.r, d: 2 * x.r })),
  make('triangle-area', 'Triangle area (base and height)', 'Geometry', 'A = base × height ÷ 2', ['b|Base|length|m|6', 'h|Height|length|m|4'], ['a|Area|area|m²'], (x) => ({ a: (x.b * x.h) / 2 })),
  make('heron', 'Triangle from three sides (Heron)', 'Geometry', 'A = √(s(s−a)(s−b)(s−c)), s = (a+b+c) ÷ 2', ['a|Side a|length|m|3', 'b|Side b|length|m|4', 'c|Side c|length|m|5'], ['area|Area|area|m²', 'per|Perimeter|length|m', 'A|Angle opposite a|angle|°', 'B|Angle opposite b|angle|°', 'C|Angle opposite c|angle|°'], (x) => { const s = (x.a + x.b + x.c) / 2, q = s * (s - x.a) * (s - x.b) * (s - x.c); need(q > 0, 'those sides do not make a triangle'); const ang = (o, p, r) => Math.acos((p * p + r * r - o * o) / (2 * p * r)); return { area: Math.sqrt(q), per: 2 * s, A: ang(x.a, x.b, x.c), B: ang(x.b, x.a, x.c), C: ang(x.c, x.a, x.b) }; }),
  make('right-triangle', 'Right triangle (Pythagoras)', 'Geometry', 'c = √(a² + b²)', ['a|Leg a|length|ft|3', 'b|Leg b|length|ft|4'], ['c|Hypotenuse|length|ft', 'A|Angle opposite a|angle|°', 'B|Angle opposite b|angle|°', 'area|Area|area|ft²'], (x) => ({ c: Math.hypot(x.a, x.b), A: Math.atan2(x.a, x.b), B: Math.atan2(x.b, x.a), area: (x.a * x.b) / 2 })),
  make('trapezoid', 'Trapezoid area', 'Geometry', 'A = (a + b) ÷ 2 × h', ['a|Top side|length|m|4', 'b|Bottom side|length|m|6', 'h|Height|length|m|3'], ['area|Area|area|m²'], (x) => ({ area: ((x.a + x.b) / 2) * x.h })),
  make('ellipse', 'Ellipse', 'Geometry', 'A = π a b; perimeter ≈ π(3(a+b) − √((3a+b)(a+3b))) (Ramanujan)', ['a|Semi-major axis|length|m|5', 'b|Semi-minor axis|length|m|3'], ['area|Area|area|m²', 'per|Perimeter (Ramanujan)|length|m'], (x) => ({ area: PI * x.a * x.b, per: PI * (3 * (x.a + x.b) - Math.sqrt((3 * x.a + x.b) * (x.a + 3 * x.b))) })),
  make('annulus', 'Ring (annulus) area', 'Geometry', 'A = π (R² − r²)', ['R|Outer radius|length|in|5', 'r|Inner radius|length|in|3'], ['area|Area|area|in²'], (x) => { need(x.R >= x.r, 'the outer radius must be the larger'); return { area: PI * (x.R * x.R - x.r * x.r) }; }),
  make('regular-polygon', 'Regular polygon', 'Geometry', 'A = n s² ÷ (4 tan(π ÷ n))', ['n|Number of sides|number||6', 's|Side length|length|cm|10'], ['area|Area|area|cm²', 'per|Perimeter|length|cm', 'ang|Interior angle|angle|°'], (x) => { need(Number.isInteger(x.n) && x.n >= 3, 'a polygon has 3 or more whole sides'); return { area: (x.n * x.s * x.s) / (4 * Math.tan(PI / x.n)), per: x.n * x.s, ang: PI - (2 * PI) / x.n }; }),
  make('sector', 'Arc and sector of a circle', 'Geometry', 'arc = r θ; area = r² θ ÷ 2', ['r|Radius|length|m|2', 'th|Angle|angle|°|60'], ['arc|Arc length|length|m', 'area|Sector area|area|m²', 'chord|Chord|length|m'], (x) => ({ arc: x.r * x.th, area: (x.r * x.r * x.th) / 2, chord: 2 * x.r * Math.sin(x.th / 2) })),
  make('sphere', 'Sphere', 'Geometry', 'V = 4/3 π r³; A = 4 π r²', ['r|Radius|length|cm|10'], ['v|Volume|volume|cm³', 'a|Surface area|area|cm²'], (x) => ({ v: (4 / 3) * PI * x.r ** 3, a: 4 * PI * x.r * x.r })),
  make('cylinder', 'Cylinder (or round tank)', 'Geometry', 'V = π r² h; A = 2 π r (r + h)', ['d|Diameter|length|ft|4', 'h|Height|length|ft|6'], ['v|Volume|volume|gal', 'side|Side area|area|ft²', 'a|Total surface area|area|ft²'], (x) => { const r = x.d / 2; return { v: PI * r * r * x.h, side: 2 * PI * r * x.h, a: 2 * PI * r * (r + x.h) }; }),
  make('pipe-surface-area', 'Pipe surface area', 'Geometry', 'A = π × d × l', ['d|Diameter of pipe|length|in|2', 'l|Length of pipe|length|ft|10'], ['a|Surface area|area|ft²'], (x) => ({ a: PI * x.d * x.l })),
  make('pipe-volume', 'Pipe volume (what it holds)', 'Geometry', 'V = π × (d ÷ 2)² × l', ['d|Inside diameter|length|in|2', 'l|Length|length|ft|100'], ['v|Volume|volume|gal'], (x) => ({ v: PI * (x.d / 2) ** 2 * x.l })),
  make('cone', 'Cone', 'Geometry', 'V = π r² h ÷ 3; slant = √(r² + h²)', ['r|Base radius|length|cm|3', 'h|Height|length|cm|4'], ['v|Volume|volume|cm³', 's|Slant height|length|cm', 'a|Surface area|area|cm²'], (x) => { const s = Math.hypot(x.r, x.h); return { v: (PI * x.r * x.r * x.h) / 3, s, a: PI * x.r * (x.r + s) }; }),
  make('box', 'Box (cuboid)', 'Geometry', 'V = l × w × h', ['l|Length|length|in|12', 'w|Width|length|in|10', 'h|Height|length|in|8'], ['v|Volume|volume|in³', 'a|Surface area|area|in²', 'diag|Space diagonal|length|in'], (x) => ({ v: x.l * x.w * x.h, a: 2 * (x.l * x.w + x.l * x.h + x.w * x.h), diag: Math.hypot(x.l, x.w, x.h) })),
  make('pyramid', 'Square pyramid', 'Geometry', 'V = b² h ÷ 3', ['b|Base side|length|m|230', 'h|Height|length|m|146'], ['v|Volume|volume|m³', 'a|Surface area (with base)|area|m²'], (x) => ({ v: (x.b * x.b * x.h) / 3, a: x.b * x.b + 2 * x.b * Math.hypot(x.b / 2, x.h) })),
  make('torus', 'Torus (ring)', 'Geometry', 'V = 2 π² R r²; A = 4 π² R r', ['R|Centre radius|length|cm|10', 'r|Tube radius|length|cm|2'], ['v|Volume|volume|cm³', 'a|Surface area|area|cm²'], (x) => ({ v: 2 * PI * PI * x.R * x.r * x.r, a: 4 * PI * PI * x.R * x.r })),
  make('distance-points', 'Distance and slope between two points', 'Geometry', 'd = √((x₂−x₁)² + (y₂−y₁)²); slope = (y₂−y₁) ÷ (x₂−x₁)', ['x1|x₁|number||1', 'y1|y₁|number||2', 'x2|x₂|number||4', 'y2|y₂|number||6'], ['d|Distance|number', 'm|Slope|number', 'mid|Midpoint|text'], (x) => ({ d: Math.hypot(x.x2 - x.x1, x.y2 - x.y1), m: (x.y2 - x.y1) / (x.x2 - x.x1), mid: '(' + fmt((x.x1 + x.x2) / 2) + ', ' + fmt((x.y1 + x.y2) / 2) + ')' })),
  make('slope-grade', 'Slope, grade and pitch', 'Geometry', 'grade = rise ÷ run; angle = atan(rise ÷ run)', ['rise|Rise|length|in|6', 'run|Run|length|in|12'], ['g|Grade|ratio|%', 'ang|Angle|angle|°', 'pitch|Roof pitch|text'], (x) => { pos(x.run, 'Run'); return { g: x.rise / x.run, ang: Math.atan2(x.rise, x.run), pitch: fmt((x.rise / x.run) * 12, 4) + ' in 12' }; }),
);
// ---------------- Maths
CALCULATORS.push(
  make('quadratic', 'Quadratic equation', 'Maths', 'x = (−b ± √(b² − 4ac)) ÷ 2a', ['a|a|number||1', 'b|b|number||-3', 'c|c|number||2'], ['x1|x₁|text', 'x2|x₂|text', 'disc|Discriminant b² − 4ac|number'], (x) => { need(x.a !== 0, 'a cannot be zero (that is a straight line)'); const D = x.b * x.b - 4 * x.a * x.c, re = -x.b / (2 * x.a); if (D >= 0) { const q = -(x.b + (x.b < 0 ? -1 : 1) * Math.sqrt(D)) / 2, r1 = q / x.a, r2 = q !== 0 ? x.c / q : re; const [a, b] = [r1, r2].sort((m, n) => n - m); return { x1: fmt(a, 10), x2: fmt(b, 10), disc: D }; } const im = Math.sqrt(-D) / Math.abs(2 * x.a); return { x1: fmt(re, 10) + ' + ' + fmt(im, 10) + 'i', x2: fmt(re, 10) + ' − ' + fmt(im, 10) + 'i', disc: D }; }),
  make('logarithm', 'Logarithm', 'Maths', 'log_b(x) = ln x ÷ ln b', ['x|x|number||1000', 'b|Base|number||10'], ['log|Logarithm|number', 'ln|Natural log ln x|number'], (x) => { pos(x.x, 'x'); need(x.b > 0 && x.b !== 1, 'the base must be positive and not 1'); return { log: Math.log(x.x) / Math.log(x.b), ln: Math.log(x.x) }; }),
  make('root', 'Nth root and power', 'Maths', 'root = x^(1 ÷ n); power = xⁿ', ['x|x|number||27', 'n|n|number||3'], ['root|Nth root|number', 'pow|x to the n|number'], (x) => { need(x.n !== 0, 'n cannot be zero'); const odd = Number.isInteger(x.n) && Math.abs(x.n) % 2 === 1; return { root: x.x < 0 && odd ? -Math.pow(-x.x, 1 / x.n) : Math.pow(x.x, 1 / x.n), pow: Math.pow(x.x, x.n) }; }),
  make('gcd-lcm', 'Greatest common divisor and least common multiple', 'Maths', 'lcm = a × b ÷ gcd(a, b)', ['a|a|number||84', 'b|b|number||36'], ['gcd|GCD|number', 'lcm|LCM|number'], (x) => { need(Number.isInteger(x.a) && Number.isInteger(x.b) && (x.a || x.b), 'use whole numbers'); const g = gcd(x.a, x.b); return { gcd: g, lcm: Math.abs((x.a / g) * x.b) }; }),
  make('factorial', 'Factorial', 'Maths', 'n! = 1 × 2 × … × n', ['n|n|number||10'], ['f|n!|number'], (x) => { need(isInt(x.n) && x.n <= 170, 'n must be a whole number from 0 to 170'); let r = 1; for (let i = 2; i <= x.n; i++) r *= i; return { f: r }; }),
  make('interpolate', 'Linear interpolation', 'Maths', 'y = y₁ + (x − x₁)(y₂ − y₁) ÷ (x₂ − x₁)', ['x1|x₁|number||10', 'y1|y₁|number||100', 'x2|x₂|number||20', 'y2|y₂|number||180', 'x|x|number||14'], ['y|y|number'], (x) => { need(x.x2 !== x.x1, 'x₁ and x₂ must differ'); return { y: x.y1 + ((x.x - x.x1) * (x.y2 - x.y1)) / (x.x2 - x.x1) }; }),
  make('fraction', 'Fraction to decimal and percent', 'Maths', 'decimal = numerator ÷ denominator', ['n|Numerator|number||3', 'd|Denominator|number||8'], ['dec|Decimal|number', 'pct|Percent|ratio|%', 'simple|Simplest form|text'], (x) => { need(x.d !== 0, 'the denominator cannot be zero'); const whole = Number.isInteger(x.n) && Number.isInteger(x.d), g = whole ? gcd(x.n, x.d) || 1 : 1, s = x.d < 0 ? -1 : 1; return { dec: x.n / x.d, pct: x.n / x.d, simple: whole ? (s * x.n) / g + '/' + (s * x.d) / g : fmt(x.n) + '/' + fmt(x.d) }; }),
);
// ---------------- Statistics
CALCULATORS.push(
  make('descriptive', 'Mean, median, mode and standard deviation', 'Statistics', 'mean = Σx ÷ n; s = √(Σ(x − mean)² ÷ (n − 1))', ['data|Numbers (commas or spaces)|list:number||2, 4, 4, 4, 5, 5, 7, 9'], ['n|Count|number', 'sum|Sum|number', 'mean|Mean|number', 'median|Median|number', 'mode|Mode|text', 'min|Smallest|number', 'max|Largest|number', 'range|Range|number', 'sd|Standard deviation (sample)|number', 'psd|Standard deviation (population)|number', 'var|Variance (sample)|number'],
    (x) => { const a = x.data; need(a.length, 'type some numbers'); const counts = new Map(); for (const v of a) counts.set(v, (counts.get(v) || 0) + 1); const top = Math.max(...counts.values()), modes = [...counts].filter(([, c]) => c === top).map(([v]) => v).sort((p, q) => p - q);
      return { n: a.length, sum: sum(a), mean: mean(a), median: median(a), mode: top === 1 ? 'none (every number once)' : modes.map((v) => fmt(v)).join(', '), min: Math.min(...a), max: Math.max(...a), range: Math.max(...a) - Math.min(...a), sd: a.length > 1 ? Math.sqrt(variance(a, true)) : NaN, psd: Math.sqrt(variance(a, false)), var: a.length > 1 ? variance(a, true) : NaN }; }),
  make('z-score', 'Z-score and percentile', 'Statistics', 'z = (x − mean) ÷ standard deviation', ['x|Value|number||85', 'mu|Mean|number||70', 'sd|Standard deviation|number||10'], ['z|Z-score|number', 'below|Share below (percentile)|ratio|%', 'above|Share above|ratio|%'], (x) => { pos(x.sd, 'Standard deviation'); const z = (x.x - x.mu) / x.sd, p = normalCdf(z); return { z, below: p, above: 1 - p }; }),
  make('normal-probability', 'Normal distribution probability', 'Statistics', 'P(a < X < b) = Φ((b − μ) ÷ σ) − Φ((a − μ) ÷ σ)', ['mu|Mean μ|number||100', 'sd|Standard deviation σ|number||15', 'a|From a|number||85', 'b|To b|number||115'], ['p|P(a < X < b)|ratio|%', 'pa|P(X < a)|ratio|%', 'pb|P(X > b)|ratio|%'], (x) => { pos(x.sd, 'σ'); const A = normalCdf((x.a - x.mu) / x.sd), B = normalCdf((x.b - x.mu) / x.sd); return { p: B - A, pa: A, pb: 1 - B }; }),
  make('combinations', 'Combinations and permutations', 'Statistics', 'C(n, r) = n! ÷ (r! (n − r)!); P(n, r) = n! ÷ (n − r)!', ['n|n (items)|number||52', 'r|r (chosen)|number||5'], ['c|Combinations (order does not matter)|number', 'p|Permutations (order matters)|number'], (x) => { const c = choose(x.n, x.r); let p = 1; for (let i = 0; i < x.r; i++) p *= x.n - i; return { c, p: x.r > x.n ? 0 : p }; }),
  make('binomial', 'Binomial probability', 'Statistics', 'P(X = k) = C(n, k) pᵏ (1 − p)ⁿ⁻ᵏ', ['n|Trials n|number||10', 'k|Successes k|number||3', 'p|Chance of success p|ratio|%|50'], ['eq|P(X = k)|ratio|%', 'le|P(X ≤ k)|ratio|%', 'ge|P(X ≥ k)|ratio|%', 'mean|Expected successes|number'],
    (x) => { need(isInt(x.n) && isInt(x.k) && x.k <= x.n, 'n and k are whole numbers with k ≤ n'); need(x.p >= 0 && x.p <= 1, 'p is between 0% and 100%'); const pmf = (k) => (x.p === 0 ? (k === 0 ? 1 : 0) : x.p === 1 ? (k === x.n ? 1 : 0) : Math.exp(lnFact(x.n) - lnFact(k) - lnFact(x.n - k) + k * Math.log(x.p) + (x.n - k) * Math.log(1 - x.p)));
      let le = 0; for (let i = 0; i <= x.k; i++) le += pmf(i); const eq = pmf(x.k); return { eq, le: Math.min(1, le), ge: Math.min(1, 1 - le + eq), mean: x.n * x.p }; }),
  make('margin-of-error', 'Margin of error (a poll)', 'Statistics', 'MOE = z × √(p (1 − p) ÷ n)', ['n|Sample size|number||1000', 'p|Share answering yes|ratio|%|50', CONF], ['moe|Margin of error|ratio|%', 'lo|Interval from|ratio|%', 'hi|Interval to|ratio|%'], (x) => { pos(x.n, 'Sample size'); const m = Z[x.conf] * Math.sqrt((x.p * (1 - x.p)) / x.n); return { moe: m, lo: x.p - m, hi: x.p + m }; }),
  make('sample-size', 'Sample size for a survey', 'Statistics', 'n = z² p (1 − p) ÷ MOE²', ['moe|Margin of error|ratio|%|3', 'p|Expected share|ratio|%|50', CONF], ['n|Sample size (rounded up)|number|people'], (x) => { pos(x.moe, 'Margin of error'); return { n: Math.ceil((Z[x.conf] ** 2 * x.p * (1 - x.p)) / (x.moe * x.moe) - 1e-9) }; }),
  make('confidence-interval', 'Confidence interval for a mean', 'Statistics', 'mean ± z × s ÷ √n', ['mean|Sample mean|number||50', 'sd|Standard deviation|number||8', 'n|Sample size|number||64', CONF], ['lo|From|number', 'hi|To|number', 'se|Standard error|number'], (x) => { pos(x.n, 'Sample size'); const se = x.sd / Math.sqrt(x.n), m = Z[x.conf] * se; return { lo: x.mean - m, hi: x.mean + m, se }; }),
  make('percent-error', 'Percent error', 'Statistics', 'error = |measured − true| ÷ |true|', ['m|Measured|number||9.6', 't|True value|number||9.80665'], ['e|Percent error|ratio|%'], (x) => { need(x.t !== 0, 'the true value cannot be zero'); return { e: Math.abs(x.m - x.t) / Math.abs(x.t) }; }),
  make('weighted-average', 'Weighted average (grades)', 'Statistics', 'Σ(value × weight) ÷ Σ weight', ['v|Values|list:number||90, 80, 70', 'w|Weights|list:number||50, 30, 20'], ['avg|Weighted average|number'], (x) => { need(x.v.length && x.v.length === x.w.length, 'give one weight for each value'); const W = sum(x.w); need(W !== 0, 'the weights add to zero'); return { avg: sum(x.v.map((v, i) => v * x.w[i])) / W }; }),
  make('linear-regression', 'Line of best fit and correlation', 'Statistics', 'y = a + b x (least squares); r = Pearson correlation', ['x|x values|list:number||1, 2, 3, 4, 5', 'y|y values|list:number||2, 4, 5, 4, 5'], ['b|Slope b|number', 'a|Intercept a|number', 'r|Correlation r|number', 'r2|R²|number'],
    (x) => { const n = x.x.length; need(n >= 2 && n === x.y.length, 'give two or more x values and as many y values'); const mx = mean(x.x), my = mean(x.y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x.x[i] - mx) * (x.y[i] - my); sxx += (x.x[i] - mx) ** 2; syy += (x.y[i] - my) ** 2; } need(sxx > 0, 'the x values are all the same'); const b = sxy / sxx, r = syy ? sxy / Math.sqrt(sxx * syy) : NaN; return { b, a: my - b * mx, r, r2: r * r }; }),
);
// ---------------- Physics
CALCULATORS.push(
  make('speed', 'Speed from distance and time', 'Physics', 'v = d ÷ t', ['d|Distance|length|mi|120', 't|Time|time|h|2'], ['v|Speed|speed|mph'], (x) => { pos(x.t, 'Time'); return { v: x.d / x.t }; }, { everyday: true }),
  make('travel-time', 'Travel time', 'Physics', 't = d ÷ v', ['d|Distance|length|km|450', 'v|Speed|speed|km/h|90'], ['t|Time|time|h'], (x) => { pos(x.v, 'Speed'); return { t: x.d / x.v }; }),
  make('distance', 'Distance from speed and time', 'Physics', 'd = v × t', ['v|Speed|speed|mph|65', 't|Time|time|h|3'], ['d|Distance|length|mi'], (x) => ({ d: x.v * x.t })),
  make('acceleration', 'Acceleration', 'Physics', 'a = (v − u) ÷ t', ['u|Starting speed|speed|m/s|0', 'v|Final speed|speed|m/s|27.78', 't|Time|time|s|8'], ['a|Acceleration|acceleration|m/s²', 'd|Distance covered|length|m'], (x) => { pos(x.t, 'Time'); return { a: (x.v - x.u) / x.t, d: ((x.u + x.v) / 2) * x.t }; }),
  make('force', 'Force (Newton\'s second law)', 'Physics', 'F = m × a', ['m|Mass|mass|kg|1200', 'a|Acceleration|acceleration|m/s²|3'], ['F|Force|force|N'], (x) => ({ F: x.m * x.a })),
  make('weight', 'Weight from mass', 'Physics', 'W = m × g', ['m|Mass|mass|kg|70', 'g|Gravity|acceleration|m/s²|9.80665'], ['W|Weight|force|N'], (x) => ({ W: x.m * x.g })),
  make('kinetic-energy', 'Kinetic energy', 'Physics', 'KE = ½ m v²', ['m|Mass|mass|kg|1500', 'v|Speed|speed|km/h|100'], ['ke|Kinetic energy|energy|kJ'], (x) => ({ ke: 0.5 * x.m * x.v * x.v })),
  make('potential-energy', 'Gravitational potential energy', 'Physics', 'PE = m g h', ['m|Mass|mass|kg|10', 'h|Height|length|m|5', 'g|Gravity|acceleration|m/s²|9.80665'], ['pe|Potential energy|energy|J'], (x) => ({ pe: x.m * x.g * x.h })),
  make('work', 'Work done', 'Physics', 'W = F d cos θ', ['F|Force|force|N|50', 'd|Distance|length|m|10', 'th|Angle between them|angle|°|0'], ['w|Work|energy|J'], (x) => ({ w: x.F * x.d * Math.cos(x.th) })),
  make('power', 'Power from work and time', 'Physics', 'P = W ÷ t', ['w|Energy or work|energy|J|3600', 't|Time|time|s|60'], ['p|Power|power|W'], (x) => { pos(x.t, 'Time'); return { p: x.w / x.t }; }),
  make('momentum', 'Momentum', 'Physics', 'p = m v', ['m|Mass|mass|kg|0.145', 'v|Speed|speed|mph|90'], ['p|Momentum|momentum|kg·m/s'], (x) => ({ p: x.m * x.v })),
  make('free-fall', 'Free fall (no air)', 'Physics', 't = √(2h ÷ g); v = g t', ['h|Height|length|m|20', 'g|Gravity|acceleration|m/s²|9.80665'], ['t|Time to fall|time|s', 'v|Speed at the bottom|speed|m/s'], (x) => { pos(x.g, 'Gravity'); const t = Math.sqrt((2 * x.h) / x.g); return { t, v: x.g * t }; }),
  make('projectile', 'Projectile range (level ground, no air)', 'Physics', 'range = v² sin 2θ ÷ g; height = (v sin θ)² ÷ 2g', ['v|Launch speed|speed|m/s|20', 'th|Launch angle|angle|°|45', 'g|Gravity|acceleration|m/s²|9.80665'], ['r|Range|length|m', 'h|Highest point|length|m', 't|Time in the air|time|s'], (x) => { pos(x.g, 'Gravity'); return { r: (x.v * x.v * Math.sin(2 * x.th)) / x.g, h: (x.v * Math.sin(x.th)) ** 2 / (2 * x.g), t: (2 * x.v * Math.sin(x.th)) / x.g }; }),
  make('pendulum', 'Pendulum period', 'Physics', 'T = 2π √(L ÷ g)', ['L|Length|length|m|1', 'g|Gravity|acceleration|m/s²|9.80665'], ['T|Period|time|s', 'f|Frequency|frequency|Hz'], (x) => { pos(x.L, 'Length'); const T = 2 * PI * Math.sqrt(x.L / x.g); return { T, f: 1 / T }; }),
  make('centripetal', 'Centripetal force', 'Physics', 'F = m v² ÷ r', ['m|Mass|mass|kg|1000', 'v|Speed|speed|m/s|20', 'r|Radius|length|m|50'], ['F|Force|force|N', 'a|Acceleration|acceleration|m/s²'], (x) => { pos(x.r, 'Radius'); return { F: (x.m * x.v * x.v) / x.r, a: (x.v * x.v) / x.r }; }),
  make('hooke', 'Spring force (Hooke\'s law)', 'Physics', 'F = k x; energy = ½ k x²', ['k|Spring constant|stiffness|N/m|200', 'x|Stretch|length|cm|5'], ['F|Force|force|N', 'e|Stored energy|energy|J'], (x) => ({ F: x.k * x.x, e: 0.5 * x.k * x.x * x.x })),
  make('gravity-force', 'Gravitational force (Newton)', 'Physics', 'F = G m₁ m₂ ÷ r²', ['m1|Mass 1|mass|kg|5.972e24', 'm2|Mass 2|mass|kg|7.348e22', 'r|Distance|length|km|384400'], ['F|Force|force|N'], (x) => { pos(x.r, 'Distance'); return { F: (GRAV * x.m1 * x.m2) / (x.r * x.r) }; }),
  make('escape-velocity', 'Escape velocity', 'Physics', 'v = √(2 G M ÷ r)', ['M|Mass of the body|mass|kg|5.972e24', 'r|Radius|length|km|6371'], ['v|Escape velocity|speed|km/s'], (x) => { pos(x.r, 'Radius'); return { v: Math.sqrt((2 * GRAV * x.M) / x.r) }; }),
  make('orbital-period', 'Orbital period (Kepler)', 'Physics', 'T = 2π √(a³ ÷ G M)', ['a|Orbit radius|length|km|42164', 'M|Central mass|mass|kg|5.972e24'], ['T|Period|time|h', 'v|Orbital speed|speed|km/s'], (x) => { pos(x.M, 'Mass'); pos(x.a, 'Orbit radius'); return { T: 2 * PI * Math.sqrt(x.a ** 3 / (GRAV * x.M)), v: Math.sqrt((GRAV * x.M) / x.a) }; }),
  make('wave-speed', 'Wave speed', 'Physics', 'v = f λ', ['f|Frequency|frequency|Hz|440', 'l|Wavelength|length|m|0.78'], ['v|Speed|speed|m/s'], (x) => ({ v: x.f * x.l })),
  make('wavelength', 'Wavelength from frequency', 'Physics', 'λ = v ÷ f', ['f|Frequency|frequency|MHz|100', 'v|Wave speed|speed|m/s|299792458'], ['l|Wavelength|length|m'], (x) => { pos(x.f, 'Frequency'); return { l: x.v / x.f }; }),
  make('photon-energy', 'Photon energy', 'Physics', 'E = h c ÷ λ', ['l|Wavelength|length|nm|550'], ['e|Energy|energy|eV', 'f|Frequency|frequency|THz'], (x) => { pos(x.l, 'Wavelength'); return { e: (H * C) / x.l, f: C / x.l }; }),
  make('snell', 'Refraction (Snell\'s law)', 'Physics', 'n₁ sin θ₁ = n₂ sin θ₂', ['n1|Index n₁|number||1', 'th|Angle in θ₁|angle|°|30', 'n2|Index n₂|number||1.5'], ['th2|Angle out θ₂|angle|°', 'crit|Critical angle (n₁ > n₂)|text'], (x) => { const s = (x.n1 * Math.sin(x.th)) / x.n2; need(Math.abs(s) <= 1, 'total internal reflection: no refracted ray'); return { th2: Math.asin(s), crit: x.n1 > x.n2 ? fmt((Math.asin(x.n2 / x.n1) * 180) / PI) + '°' : 'none' }; }),
  make('thin-lens', 'Thin lens', 'Physics', '1/f = 1/dₒ + 1/dᵢ', ['f|Focal length|length|cm|10', 'do|Object distance|length|cm|30'], ['di|Image distance|length|cm', 'mag|Magnification|number'], (x) => { need(x.do !== x.f, 'the object is at the focal point: no image'); const di = 1 / (1 / x.f - 1 / x.do); return { di, mag: -di / x.do }; }),
  make('buoyancy', 'Buoyant force (Archimedes)', 'Physics', 'F = ρ g V', ['rho|Fluid density|density|kg/m³|1000', 'v|Volume under water|volume|L|10', 'g|Gravity|acceleration|m/s²|9.80665'], ['F|Buoyant force|force|N', 'm|Mass it holds up|mass|kg'], (x) => ({ F: x.rho * x.g * x.v, m: x.rho * x.v })),
  make('friction', 'Friction force', 'Physics', 'F = μ N', ['mu|Friction coefficient μ|number||0.4', 'm|Mass|mass|kg|20', 'g|Gravity|acceleration|m/s²|9.80665'], ['F|Friction force|force|N'], (x) => ({ F: x.mu * x.m * x.g })),
  make('torque', 'Torque', 'Physics', 'τ = r F sin θ', ['r|Lever arm|length|ft|1.5', 'F|Force|force|lbf|50', 'th|Angle|angle|°|90'], ['t|Torque|torque|N·m'], (x) => ({ t: x.r * x.F * Math.sin(x.th) })),
  make('heat', 'Heat to warm something', 'Physics', 'Q = m c ΔT', ['m|Mass|mass|kg|1', 'c|Specific heat|specificheat|J/(kg·K)|4186', 'dt|Temperature rise|tempdiff|K|80'], ['q|Heat|energy|kJ'], (x) => ({ q: x.m * x.c * x.dt })),
  make('doppler', 'Doppler shift (sound)', 'Physics', 'f′ = f (c + v_listener) ÷ (c − v_source)', ['f|Source frequency|frequency|Hz|500', 'vs|Source speed toward you|speed|m/s|30', 'vo|Your speed toward it|speed|m/s|0', 'c|Speed of sound|speed|m/s|343'], ['f2|Heard frequency|frequency|Hz'], (x) => { need(x.c > x.vs, 'the source is at or above the speed of sound'); return { f2: (x.f * (x.c + x.vo)) / (x.c - x.vs) }; }),
  make('lorentz', 'Time dilation (special relativity)', 'Physics', 'γ = 1 ÷ √(1 − v² ÷ c²)', ['v|Speed|ratio|%|90', 't|Proper time|time|yr|1'], ['g|Lorentz factor γ|number', 't2|Time for the observer|time|yr'], (x) => { need(x.v >= 0 && x.v < 1, 'the speed is a share of light speed under 100%'); const g = 1 / Math.sqrt(1 - x.v * x.v); return { g, t2: g * x.t }; }),
  make('mass-energy', 'Mass–energy (E = mc²)', 'Physics', 'E = m c²', ['m|Mass|mass|g|1'], ['e|Energy|energy|J', 'kwh|Energy|energy|kWh'], (x) => ({ e: x.m * C * C, kwh: x.m * C * C })),
  make('density', 'Density', 'Physics', 'ρ = m ÷ V', ['m|Mass|mass|g|500', 'v|Volume|volume|cm³|185'], ['rho|Density|density|g/cm³'], (x) => { pos(x.v, 'Volume'); return { rho: x.m / x.v }; }),
  make('mass-from-density', 'Mass from density and volume', 'Physics', 'm = ρ V', ['rho|Density|density|g/cm³|7.85', 'v|Volume|volume|cm³|1000'], ['m|Mass|mass|kg'], (x) => ({ m: x.rho * x.v })),
  make('pressure', 'Pressure from force and area', 'Physics', 'p = F ÷ A', ['F|Force|force|N|1000', 'a|Area|area|cm²|10'], ['p|Pressure|pressure|kPa'], (x) => { pos(x.a, 'Area'); return { p: x.F / x.a }; }),
  make('radiation', 'Thermal radiation (Stefan–Boltzmann)', 'Physics', 'P = ε σ A T⁴', ['e|Emissivity ε|number||1', 'a|Area|area|m²|1', 't|Temperature|temperature|°C|100'], ['p|Power radiated|power|W'], (x) => ({ p: x.e * SIGMA * x.a * x.t ** 4 })),
);
// ---------------- Chemistry
CALCULATORS.push(
  make('molar-mass', 'Molar mass of a formula', 'Chemistry', 'M = Σ (atoms × atomic weight)', ['f|Formula|text||C6H12O6'], ['M|Molar mass|molarmass|g/mol'], (x) => ({ M: molarMass(x.f) / 1000 })),
  make('moles', 'Moles from mass', 'Chemistry', 'n = m ÷ M', ['m|Mass|mass|g|36', 'M|Molar mass|molarmass|g/mol|18.015'], ['n|Amount|amount|mol', 'N|Particles|number'], (x) => { pos(x.M, 'Molar mass'); return { n: x.m / x.M, N: (x.m / x.M) * NA }; }),
  make('mass-from-moles', 'Mass from moles', 'Chemistry', 'm = n × M', ['n|Amount|amount|mol|2', 'M|Molar mass|molarmass|g/mol|58.44'], ['m|Mass|mass|g'], (x) => ({ m: x.n * x.M })),
  make('molarity', 'Molarity (concentration)', 'Chemistry', 'c = n ÷ V = m ÷ (M V)', ['m|Mass of solute|mass|g|5.844', 'M|Molar mass|molarmass|g/mol|58.44', 'v|Solution volume|volume|L|0.5'], ['c|Concentration|concentration|M', 'n|Amount|amount|mmol'], (x) => { pos(x.v, 'Volume'); pos(x.M, 'Molar mass'); return { c: x.m / x.M / x.v, n: x.m / x.M }; }),
  make('dilution', 'Dilution (C₁V₁ = C₂V₂)', 'Chemistry', 'V₁ = C₂ V₂ ÷ C₁', ['c1|Stock concentration C₁|concentration|M|2', 'c2|Wanted concentration C₂|concentration|M|0.5', 'v2|Wanted volume V₂|volume|mL|500'], ['v1|Stock to use V₁|volume|mL', 'w|Water to add|volume|mL'], (x) => { pos(x.c1, 'C₁'); need(x.c2 <= x.c1, 'the wanted concentration must not be above the stock'); const v1 = (x.c2 * x.v2) / x.c1; return { v1, w: x.v2 - v1 }; }),
  make('ph', 'pH from hydrogen ion concentration', 'Chemistry', 'pH = −log₁₀[H⁺]; pOH = 14 − pH', ['h|[H⁺]|concentration|M|1e-7'], ['ph|pH|number', 'poh|pOH (25 °C)|number', 'oh|[OH⁻]|concentration|M'], (x) => { pos(x.h, '[H⁺]'); const ph = -Math.log10(x.h / 1000); return { ph, poh: 14 - ph, oh: Math.pow(10, ph - 14) * 1000 }; }),
  make('ph-to-concentration', 'Hydrogen ion concentration from pH', 'Chemistry', '[H⁺] = 10^−pH', ['ph|pH|number||3.5'], ['h|[H⁺]|concentration|M', 'oh|[OH⁻] (25 °C)|concentration|M'], (x) => ({ h: Math.pow(10, -x.ph) * 1000, oh: Math.pow(10, x.ph - 14) * 1000 })),
  make('henderson-hasselbalch', 'Buffer pH (Henderson–Hasselbalch)', 'Chemistry', 'pH = pKa + log₁₀([A⁻] ÷ [HA])', ['pka|pKa|number||4.76', 'a|Base [A⁻]|concentration|M|0.2', 'ha|Acid [HA]|concentration|M|0.1'], ['ph|pH|number'], (x) => { pos(x.a, '[A⁻]'); pos(x.ha, '[HA]'); return { ph: x.pka + Math.log10(x.a / x.ha) }; }),
  make('ideal-gas-pressure', 'Ideal gas law: pressure', 'Chemistry', 'P = n R T ÷ V', ['n|Amount|amount|mol|1', 't|Temperature|temperature|°C|0', 'v|Volume|volume|L|22.414'], ['p|Pressure|pressure|atm'], (x) => { pos(x.v, 'Volume'); return { p: (x.n * R_GAS * x.t) / x.v }; }),
  make('ideal-gas-volume', 'Ideal gas law: volume', 'Chemistry', 'V = n R T ÷ P', ['n|Amount|amount|mol|1', 't|Temperature|temperature|°C|25', 'p|Pressure|pressure|atm|1'], ['v|Volume|volume|L'], (x) => { pos(x.p, 'Pressure'); return { v: (x.n * R_GAS * x.t) / x.p }; }),
  make('ideal-gas-moles', 'Ideal gas law: moles', 'Chemistry', 'n = P V ÷ R T', ['p|Pressure|pressure|kPa|101.325', 'v|Volume|volume|L|10', 't|Temperature|temperature|°C|20'], ['n|Amount|amount|mol'], (x) => { pos(x.t, 'Temperature (kelvin)'); return { n: (x.p * x.v) / (R_GAS * x.t) }; }),
  make('combined-gas', 'Combined gas law', 'Chemistry', 'V₂ = V₁ (P₁ ÷ P₂)(T₂ ÷ T₁)', ['p1|P₁|pressure|atm|1', 'v1|V₁|volume|L|2', 't1|T₁|temperature|°C|20', 'p2|P₂|pressure|atm|2', 't2|T₂|temperature|°C|80'], ['v2|V₂|volume|L'], (x) => { pos(x.p2, 'P₂'); pos(x.t1, 'T₁ (kelvin)'); return { v2: (x.v1 * x.p1 * x.t2) / (x.p2 * x.t1) }; }),
  make('boyle', 'Boyle\'s law', 'Chemistry', 'P₁ V₁ = P₂ V₂', ['p1|P₁|pressure|kPa|100', 'v1|V₁|volume|L|6', 'p2|P₂|pressure|kPa|300'], ['v2|V₂|volume|L'], (x) => { pos(x.p2, 'P₂'); return { v2: (x.p1 * x.v1) / x.p2 }; }),
  make('charles', 'Charles\'s law', 'Chemistry', 'V₁ ÷ T₁ = V₂ ÷ T₂', ['v1|V₁|volume|L|2', 't1|T₁|temperature|°C|25', 't2|T₂|temperature|°C|100'], ['v2|V₂|volume|L'], (x) => { pos(x.t1, 'T₁ (kelvin)'); return { v2: (x.v1 * x.t2) / x.t1 }; }),
  make('half-life', 'Radioactive decay (half-life)', 'Chemistry', 'N = N₀ × ½^(t ÷ t½)', ['n0|Starting amount|mass|g|100', 'hl|Half-life|time|yr|5730', 't|Time passed|time|yr|10000'], ['n|Amount left|mass|g', 'left|Share left|ratio|%', 'k|Decay constant|frequency|/yr'], (x) => { pos(x.hl, 'Half-life'); const s = Math.pow(0.5, x.t / x.hl); return { n: x.n0 * s, left: s, k: Math.LN2 / x.hl }; }),
  make('percent-yield', 'Percent yield', 'Chemistry', 'yield = actual ÷ theoretical', ['a|Actual yield|mass|g|8.2', 't|Theoretical yield|mass|g|10'], ['y|Percent yield|ratio|%'], (x) => { pos(x.t, 'Theoretical yield'); return { y: x.a / x.t }; }),
  make('mass-percent', 'Mass percent of an element in a formula', 'Chemistry', 'share = (atoms × atomic weight) ÷ molar mass', ['f|Formula|text||H2O', 'el|Element|text||O'], ['p|Mass percent|ratio|%', 'M|Molar mass|molarmass|g/mol'], (x) => { const el = String(x.el).trim(); need(ATOMIC[el] !== undefined, 'no element "' + el + '"'); const M = molarMass(x.f), w = ATOMIC[el]; let without; try { ATOMIC[el] = 0; without = molarMass(x.f); } finally { ATOMIC[el] = w; } const part = M - without; need(part > 0, el + ' is not in ' + x.f); return { p: part / M, M: M / 1000 }; }),
);
// ---------------- Electrical
CALCULATORS.push(
  make('ohms-law-voltage', 'Ohm\'s law: voltage', 'Electrical', 'V = I R', ['i|Current|current|A|2', 'r|Resistance|resistance|Ω|6'], ['v|Voltage|voltage|V', 'p|Power|power|W'], (x) => ({ v: x.i * x.r, p: x.i * x.i * x.r })),
  make('ohms-law-current', 'Ohm\'s law: current', 'Electrical', 'I = V ÷ R', ['v|Voltage|voltage|V|12', 'r|Resistance|resistance|Ω|4'], ['i|Current|current|A', 'p|Power|power|W'], (x) => { pos(x.r, 'Resistance'); return { i: x.v / x.r, p: (x.v * x.v) / x.r }; }),
  make('ohms-law-resistance', 'Ohm\'s law: resistance', 'Electrical', 'R = V ÷ I', ['v|Voltage|voltage|V|120', 'i|Current|current|A|0.5'], ['r|Resistance|resistance|Ω', 'p|Power|power|W'], (x) => { need(x.i !== 0, 'the current cannot be zero'); return { r: x.v / x.i, p: x.v * x.i }; }),
  make('electric-power', 'Electric power', 'Electrical', 'P = V I', ['v|Voltage|voltage|V|120', 'i|Current|current|A|10'], ['p|Power|power|W'], (x) => ({ p: x.v * x.i })),
  make('power-current', 'Current from power (amps from watts)', 'Electrical', 'I = P ÷ V', ['p|Power|power|W|1800', 'v|Voltage|voltage|V|120'], ['i|Current|current|A', 'r|Load resistance|resistance|Ω'], (x) => { pos(x.v, 'Voltage'); pos(x.p, 'Power'); return { i: x.p / x.v, r: (x.v * x.v) / x.p }; }),
  make('resistors-series', 'Resistors in series', 'Electrical', 'R = R₁ + R₂ + …', ['r|Resistances|list:resistance|Ω|100, 220, 330'], ['r|Total resistance|resistance|Ω'], (x) => { need(x.r.length, 'type the resistances'); return { r: sum(x.r) }; }),
  make('resistors-parallel', 'Resistors in parallel', 'Electrical', '1/R = 1/R₁ + 1/R₂ + …', ['r|Resistances|list:resistance|Ω|100, 220, 330'], ['r|Total resistance|resistance|Ω'], (x) => { need(x.r.length && x.r.every((v) => v > 0), 'type resistances above zero'); return { r: 1 / sum(x.r.map((v) => 1 / v)) }; }),
  make('capacitors-series', 'Capacitors in series', 'Electrical', '1/C = 1/C₁ + 1/C₂ + …', ['c|Capacitances|list:capacitance|µF|10, 22'], ['c|Total capacitance|capacitance|µF'], (x) => { need(x.c.length && x.c.every((v) => v > 0), 'type capacitances above zero'); return { c: 1 / sum(x.c.map((v) => 1 / v)) }; }),
  make('capacitors-parallel', 'Capacitors in parallel', 'Electrical', 'C = C₁ + C₂ + …', ['c|Capacitances|list:capacitance|µF|10, 22'], ['c|Total capacitance|capacitance|µF'], (x) => { need(x.c.length, 'type the capacitances'); return { c: sum(x.c) }; }),
  make('voltage-divider', 'Voltage divider', 'Electrical', 'Vout = Vin × R₂ ÷ (R₁ + R₂)', ['vin|Input voltage|voltage|V|12', 'r1|R₁ (top)|resistance|kΩ|10', 'r2|R₂ (bottom)|resistance|kΩ|4.7'], ['vout|Output voltage|voltage|V', 'i|Current|current|mA'], (x) => { pos(x.r1 + x.r2, 'R₁ + R₂'); return { vout: (x.vin * x.r2) / (x.r1 + x.r2), i: x.vin / (x.r1 + x.r2) }; }),
  make('rc-time', 'RC time constant', 'Electrical', 'τ = R C; f꜀ = 1 ÷ (2π R C)', ['r|Resistance|resistance|kΩ|10', 'c|Capacitance|capacitance|µF|100'], ['tau|Time constant τ|time|s', 'full|Time to 99.3% (5τ)|time|s', 'fc|Cut-off frequency|frequency|Hz'], (x) => { const t = x.r * x.c; pos(t, 'R × C'); return { tau: t, full: 5 * t, fc: 1 / (2 * PI * t) }; }),
  make('capacitor-energy', 'Energy in a capacitor', 'Electrical', 'E = ½ C V²; Q = C V', ['c|Capacitance|capacitance|µF|470', 'v|Voltage|voltage|V|25'], ['e|Energy|energy|J', 'q|Charge|charge|mC'], (x) => ({ e: 0.5 * x.c * x.v * x.v, q: x.c * x.v })),
  make('inductor-energy', 'Energy in an inductor', 'Electrical', 'E = ½ L I²', ['l|Inductance|inductance|mH|10', 'i|Current|current|A|2'], ['e|Energy|energy|mJ'], (x) => ({ e: 0.5 * x.l * x.i * x.i })),
  make('lc-resonance', 'LC resonant frequency', 'Electrical', 'f = 1 ÷ (2π √(L C))', ['l|Inductance|inductance|µH|10', 'c|Capacitance|capacitance|nF|100'], ['f|Resonant frequency|frequency|kHz'], (x) => { pos(x.l * x.c, 'L × C'); return { f: 1 / (2 * PI * Math.sqrt(x.l * x.c)) }; }),
  make('reactance', 'Reactance of a capacitor and an inductor', 'Electrical', 'X꜀ = 1 ÷ (2π f C); Xₗ = 2π f L', ['f|Frequency|frequency|Hz|60', 'c|Capacitance|capacitance|µF|10', 'l|Inductance|inductance|mH|100'], ['xc|Capacitive reactance|resistance|Ω', 'xl|Inductive reactance|resistance|Ω'], (x) => { pos(x.f, 'Frequency'); return { xc: x.c > 0 ? 1 / (2 * PI * x.f * x.c) : NaN, xl: 2 * PI * x.f * x.l }; }),
  make('wire-resistance', 'Wire resistance and voltage drop', 'Electrical', 'R = ρ L ÷ A; drop = I R (both wires)', ['rho|Resistivity (copper 1.68e-8)|resistivity|Ω·m|1.68e-8', 'l|One-way length|length|ft|100', 'd|Wire diameter|length|mm|2.05', 'i|Current|current|A|15'], ['r|Resistance (there and back)|resistance|Ω', 'drop|Voltage drop|voltage|V'], (x) => { pos(x.d, 'Diameter'); const r = (x.rho * 2 * x.l) / (PI * (x.d / 2) ** 2); return { r, drop: x.i * r }; }),
  make('led-resistor', 'LED resistor', 'Electrical', 'R = (Vsupply − Vled) ÷ I', ['vs|Supply voltage|voltage|V|5', 'vf|LED forward voltage|voltage|V|2', 'i|LED current|current|mA|20'], ['r|Resistor|resistance|Ω', 'p|Resistor power|power|mW'], (x) => { pos(x.i, 'Current'); need(x.vs > x.vf, 'the supply must be above the LED voltage'); return { r: (x.vs - x.vf) / x.i, p: (x.vs - x.vf) * x.i }; }),
  make('battery-life', 'Battery life', 'Electrical', 'hours = capacity ÷ current (× usable share)', ['cap|Capacity|charge|mAh|3000', 'i|Load current|current|mA|150', 'use|Usable share|ratio|%|85'], ['t|Run time|time|h'], (x) => { pos(x.i, 'Current'); return { t: (x.cap * x.use) / x.i }; }),
  make('decibels', 'Decibels from a ratio', 'Electrical', 'dB = 10 log₁₀(P₂ ÷ P₁) = 20 log₁₀(V₂ ÷ V₁)', ['a|Reference P₁ or V₁|number||1', 'b|Measured P₂ or V₂|number||100', { k: 'type', label: 'The numbers are', kind: 'choice', opts: [['p', 'power'], ['v', 'voltage or amplitude']], v: 'p' }], ['db|Decibels|number|dB'], (x) => { pos(x.a, 'P₁'); pos(x.b, 'P₂'); return { db: (x.type === 'v' ? 20 : 10) * Math.log10(x.b / x.a) }; }),
  make('ac-power', 'AC power (single phase)', 'Electrical', 'P = V I × power factor', ['v|Voltage (RMS)|voltage|V|230', 'i|Current (RMS)|current|A|10', 'pf|Power factor|number||0.9'], ['p|Real power|power|kW', 's|Apparent power (kVA)|number|kVA', 'q|Reactive power (kvar)|number|kvar'], (x) => { const s = x.v * x.i; return { p: s * x.pf, s: s / 1000, q: (s * Math.sqrt(Math.max(0, 1 - x.pf * x.pf))) / 1000 }; }),
  make('three-phase', 'Three-phase power', 'Electrical', 'P = √3 × V(line) × I × power factor', ['v|Line voltage|voltage|V|400', 'i|Line current|current|A|32', 'pf|Power factor|number||0.85'], ['p|Real power|power|kW', 's|Apparent power (kVA)|number|kVA'], (x) => ({ p: Math.sqrt(3) * x.v * x.i * x.pf, s: (Math.sqrt(3) * x.v * x.i) / 1000 })),
);
// ---------------- Engineering
CALCULATORS.push(
  make('stress', 'Stress (force over area)', 'Engineering', 'σ = F ÷ A', ['F|Force|force|kN|50', 'a|Cross-section area|area|mm²|400'], ['s|Stress|pressure|MPa'], (x) => { pos(x.a, 'Area'); return { s: x.F / x.a }; }),
  make('strain', 'Strain and Young\'s modulus', 'Engineering', 'ε = ΔL ÷ L; E = σ ÷ ε', ['dl|Change in length|length|mm|0.5', 'l|Original length|length|m|2', 's|Stress|pressure|MPa|100'], ['e|Strain|ratio|%', 'E|Young\'s modulus|pressure|GPa'], (x) => { pos(x.l, 'Length'); pos(x.dl, 'Change in length'); const e = x.dl / x.l; return { e, E: x.s / e }; }),
  make('elongation', 'Stretch of a bar under load', 'Engineering', 'ΔL = F L ÷ (A E)', ['F|Force|force|kN|10', 'l|Length|length|m|2', 'a|Area|area|mm²|100', 'E|Young\'s modulus (steel 200)|pressure|GPa|200'], ['dl|Stretch|length|mm'], (x) => { pos(x.a * x.E, 'A × E'); return { dl: (x.F * x.l) / (x.a * x.E) }; }),
  make('cantilever', 'Cantilever beam, load at the end', 'Engineering', 'δ = F L³ ÷ (3 E I); M = F L', ['F|End load|force|N|1000', 'l|Length|length|m|2', 'E|Young\'s modulus|pressure|GPa|200', 'I|Second moment of area|inertia|cm⁴|1000'], ['d|Deflection|length|mm', 'M|Root bending moment|torque|N·m'], (x) => { pos(x.E * x.I, 'E × I'); return { d: (x.F * x.l ** 3) / (3 * x.E * x.I), M: x.F * x.l }; }),
  make('simple-beam', 'Simply supported beam, even load', 'Engineering', 'δ = 5 w L⁴ ÷ (384 E I); M = w L² ÷ 8', ['w|Load per length|stiffness|N/m|2000', 'l|Span|length|m|4', 'E|Young\'s modulus|pressure|GPa|200', 'I|Second moment of area|inertia|cm⁴|2000'], ['d|Mid-span deflection|length|mm', 'M|Biggest bending moment|torque|N·m'], (x) => { pos(x.E * x.I, 'E × I'); return { d: (5 * x.w * x.l ** 4) / (384 * x.E * x.I), M: (x.w * x.l * x.l) / 8 }; }),
  make('moment-of-inertia', 'Second moment of area (rectangle and round bar)', 'Engineering', 'I = b h³ ÷ 12 (rectangle); I = π d⁴ ÷ 64 (round)', ['b|Rectangle width|length|mm|50', 'h|Rectangle height|length|mm|100', 'd|Round bar diameter|length|mm|50'], ['ir|Rectangle I|inertia|cm⁴', 'ic|Round bar I|inertia|cm⁴'], (x) => ({ ir: (x.b * x.h ** 3) / 12, ic: (PI * x.d ** 4) / 64 })),
  make('reynolds', 'Reynolds number', 'Engineering', 'Re = ρ v D ÷ μ', ['rho|Fluid density|density|kg/m³|998', 'v|Speed|speed|m/s|1.5', 'd|Pipe diameter|length|mm|50', 'mu|Viscosity|viscosity|Pa·s|0.001'], ['re|Reynolds number|number', 'flow|Flow|text'], (x) => { pos(x.mu, 'Viscosity'); const re = (x.rho * x.v * x.d) / x.mu; return { re, flow: re < 2300 ? 'laminar' : re < 4000 ? 'transitional' : 'turbulent' }; }),
  make('flow-rate', 'Flow rate in a pipe', 'Engineering', 'Q = v × π (d ÷ 2)²', ['d|Inside diameter|length|in|2', 'v|Flow speed|speed|ft/s|5'], ['q|Flow rate|flow|gpm'], (x) => ({ q: x.v * PI * (x.d / 2) ** 2 })),
  make('pipe-velocity', 'Flow speed in a pipe', 'Engineering', 'v = Q ÷ (π (d ÷ 2)²)', ['q|Flow rate|flow|L/s|2', 'd|Inside diameter|length|mm|40'], ['v|Flow speed|speed|m/s'], (x) => { pos(x.d, 'Diameter'); return { v: x.q / (PI * (x.d / 2) ** 2) }; }),
  make('hydrostatic', 'Pressure under water', 'Engineering', 'p = ρ g h (+ air pressure for absolute)', ['h|Depth|length|m|10', 'rho|Fluid density|density|kg/m³|1025', 'g|Gravity|acceleration|m/s²|9.80665'], ['p|Gauge pressure|pressure|kPa', 'abs|Absolute pressure|pressure|atm'], (x) => { const p = x.rho * x.g * x.h; return { p, abs: p + 101325 }; }),
  make('water-weight', 'Weight of water in a volume', 'Engineering', 'm = V × 998.2 kg/m³ (20 °C)', ['v|Volume|volume|gal|50'], ['m|Mass|mass|lb'], (x) => ({ m: x.v * 998.2 })),
  make('torque-power', 'Power from torque and speed', 'Engineering', 'P = τ ω', ['t|Torque|torque|N·m|300', 'w|Speed|angvel|rpm|3000'], ['p|Power|power|kW', 'hp|Power|power|hp'], (x) => ({ p: x.t * x.w, hp: x.t * x.w })),
  make('gear-ratio', 'Gear ratio', 'Engineering', 'ratio = driven teeth ÷ driver teeth; out speed = in speed ÷ ratio', ['a|Driver teeth|number||12', 'b|Driven teeth|number||36', 'w|Input speed|angvel|rpm|1800', 't|Input torque|torque|N·m|10'], ['r|Ratio (to 1)|number', 'w2|Output speed|angvel|rpm', 't2|Output torque (no losses)|torque|N·m'], (x) => { pos(x.a, 'Driver teeth'); pos(x.b, 'Driven teeth'); const r = x.b / x.a; return { r, w2: x.w / r, t2: x.t * r }; }),
  make('heat-conduction', 'Heat through a wall (conduction)', 'Engineering', 'Q = k A ΔT ÷ d', ['k|Conductivity|conductivity|W/(m·K)|0.04', 'a|Area|area|m²|10', 'dt|Temperature difference|tempdiff|K|20', 'd|Thickness|length|cm|10'], ['q|Heat flow|power|W'], (x) => { pos(x.d, 'Thickness'); return { q: (x.k * x.a * x.dt) / x.d }; }),
  make('thermal-expansion', 'Thermal expansion', 'Engineering', 'ΔL = α L ΔT', ['a|Expansion coefficient (steel 12e-6)|expansion|/K|12e-6', 'l|Length|length|m|100', 'dt|Temperature change|tempdiff|K|40'], ['dl|Change in length|length|mm'], (x) => ({ dl: x.a * x.l * x.dt })),
  make('sectional-density', 'Sectional density', 'Engineering', 'SD = mass ÷ diameter²', ['m|Mass|mass|gr|168', 'd|Diameter|length|in|0.308'], ['sd|Sectional density|areadensity|lb/in²'], (x) => { pos(x.d, 'Diameter'); return { sd: x.m / (x.d * x.d) }; }),
  make('concrete', 'Concrete for a slab', 'Engineering', 'V = length × width × thickness', ['l|Length|length|ft|20', 'w|Width|length|ft|10', 't|Thickness|length|in|4', 'waste|Extra for waste|ratio|%|10'], ['v|Concrete|volume|yd³', 'bags|80 lb bags (0.6 ft³ each)|number|bags'], (x) => { const v = x.l * x.w * x.t * (1 + x.waste); return { v, bags: Math.ceil(v / (0.6 * 0.3048 ** 3) - 1e-9) }; }),
  make('efficiency', 'Efficiency', 'Engineering', 'η = output ÷ input', ['out|Power out|power|W|850', 'in|Power in|power|W|1000'], ['e|Efficiency|ratio|%', 'loss|Lost|power|W'], (x) => { pos(x.in, 'Power in'); return { e: x.out / x.in, loss: x.in - x.out }; }),
);

/** id -> calculator */
// the formula library: every batch's definitions compiled (each is checked for its units, source and worked example as it loads)
// ---------------- calculator.net's home page, one for one (docs/PARITY.md has the table): the ones Verse did not have yet
/** random numbers for the generators: crypto in the browser and in Node; tests swap `next` for a fixed sequence. */
export const RNG = { next: () => { const a = new Uint32Array(2); globalThis.crypto.getRandomValues(a); return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53; } };
const YEAR = 31557600, MONTH = 2629800;
const months = (t, what) => { const n = Math.round(t / MONTH); pos(n, what); return n; };
const yesNo = (k, label, v = 'y') => ({ k, label, kind: 'choice', opts: [['y', 'yes'], ['n', 'no']], v });
const money2 = (v) => Math.round(v * 100) / 100;
const schedule = (rows) => ({ head: ['Month', 'Payment', 'Principal', 'Interest', 'Balance'], rows: rows.map((m) => [m.n, money2(m.pay), money2(m.principal), money2(m.interest), money2(m.balance)]), money: [1, 2, 3, 4] });
/** the yearly rate (as a fraction) that makes `pay` a month repay `amount` in `n` months, by bisection; null when no rate does. Pure. */
export function rateFor(amount, pay, n) {
  if (!(amount > 0 && pay > 0 && n > 0) || pay * n < amount - 1e-9) return null;
  if (Math.abs(pay * n - amount) < 1e-9) return 0;
  let lo = 0, hi = 1; while (payment(amount, hi * 1200, n) < pay && hi < 1e6) hi *= 2;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (payment(amount, mid * 1200, n) < pay) lo = mid; else hi = mid; }
  return (lo + hi) / 2 * 12;
}
/** time value of money, payments at the end of each period: fv = −(pv·(1+i)ⁿ + pmt·((1+i)ⁿ − 1)/i), the usual sign rule (money in is minus,
 *  money out is plus). Returns the value of `want` from the others. Pure. */
export function tvm(want, { n, i, pv, pmt, fv }) {
  const grow = (r) => Math.pow(1 + r, n), ann = (r) => (r === 0 ? n : (grow(r) - 1) / r);
  const F = (r, N = n) => { const g = Math.pow(1 + r, N); return pv * g + pmt * (r === 0 ? N : (g - 1) / r) + fv; };
  if (want === 'fv') return -(pv * grow(i) + pmt * ann(i));
  if (want === 'pv') return -(fv + pmt * ann(i)) / grow(i);
  if (want === 'pmt') return -(fv + pv * grow(i)) / ann(i);
  if (want === 'n') {
    if (i === 0) { need(pmt !== 0, 'with no interest the payment cannot be zero'); return -(pv + fv) / pmt; }
    const top = pmt - fv * i, bot = pmt + pv * i; need(top / bot > 0, 'these values never meet'); return Math.log(top / bot) / Math.log(1 + i);
  }
  // the rate: bisection on F over (−99%, 1000%) a period, after finding a sign change on a grid
  let a = -0.99, fa = F(a), found = null;
  for (let k = 1; k <= 4000 && found === null; k++) { const b = -0.99 + (k * 10.99) / 4000, fb = F(b); if (fa === 0) found = [a, a]; else if (fa * fb <= 0) found = [a, b]; a = b; fa = fb; }
  need(found, 'no interest rate gives these values');
  let [lo, hi] = found; for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (F(lo) * F(mid) <= 0) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}
// US federal income tax brackets (IRS Rev. Proc. 2024-40 for 2025 as amended by Pub. L. 119-21, and Rev. Proc. 2025-32 for 2026): [top of bracket, rate]
export const US_TAX = {
  2026: { std: { single: 16100, mfj: 32200, mfs: 16100, hoh: 24150 }, br: {
    single: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]],
    mfj: [[24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]],
    mfs: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [384350, 0.35], [Infinity, 0.37]],
    hoh: [[17700, 0.10], [67450, 0.12], [105700, 0.22], [201750, 0.24], [256200, 0.32], [640600, 0.35], [Infinity, 0.37]] } },
  2025: { std: { single: 15750, mfj: 31500, mfs: 15750, hoh: 23625 }, br: {
    single: [[11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24], [250525, 0.32], [626350, 0.35], [Infinity, 0.37]],
    mfj: [[23850, 0.10], [96950, 0.12], [206700, 0.22], [394600, 0.24], [501050, 0.32], [751600, 0.35], [Infinity, 0.37]],
    mfs: [[11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24], [250525, 0.32], [375800, 0.35], [Infinity, 0.37]],
    hoh: [[17000, 0.10], [64850, 0.12], [103350, 0.22], [197300, 0.24], [250500, 0.32], [626350, 0.35], [Infinity, 0.37]] } },
};
/** tax on a taxable income: { tax, marginal, parts: [[from, to, rate, tax]] }. Pure. */
export function bracketTax(taxable, brackets) {
  let tax = 0, from = 0, marginal = brackets[0][1]; const parts = [];
  for (const [top, rate] of brackets) { if (taxable <= from) break; const upto = Math.min(taxable, top), t = (upto - from) * rate; tax += t; parts.push([from, upto, rate, t]); marginal = rate; from = top; }
  return { tax, marginal, parts };
}
const GRADES = { 'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': 0.7, F: 0 };
/** an IPv4 address with a prefix ("192.168.1.10/24", or a mask after a space) worked out. Pure. */
export function subnet(text) {
  const m = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s*(?:\/\s*(\d{1,2})|\s+(\d{1,3}(?:\.\d{1,3}){3}))?\s*$/.exec(String(text ?? ''));
  need(m, 'write an address like 192.168.1.10/24');
  const toN = (s) => { const p = s.split('.').map(Number); need(p.every((x) => x >= 0 && x <= 255), s + ' is not an IPv4 address'); return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]; };
  const ip = toN(m[1]); let bits;
  if (m[3]) { const mk = toN(m[3]), inv = (~mk) >>> 0; need(((inv + 1) & inv) === 0, m[3] + ' is not a subnet mask'); bits = 32 - Math.log2(inv + 1); } else bits = m[2] === undefined ? 24 : Number(m[2]);
  need(bits >= 0 && bits <= 32, 'the prefix is 0 to 32');
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0, net = (ip & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0, total = 2 ** (32 - bits);
  const s = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const first = bits >= 31 ? net : net + 1, last = bits >= 31 ? bc : bc - 1, a = ip >>> 24;
  const cls = a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D (multicast)' : 'E (reserved)';
  const priv = a === 10 || (a === 172 && ((ip >>> 16) & 255) >= 16 && ((ip >>> 16) & 255) <= 31) || (a === 192 && ((ip >>> 16) & 255) === 168);
  return { network: s(net) + '/' + bits, broadcast: s(bc), first: s(first), last: s(last), mask: s(mask), wildcard: s(~mask >>> 0), hosts: bits === 32 ? 1 : bits === 31 ? 2 : total - 2, total, cls, kind: priv ? 'private (RFC 1918)' : a === 127 ? 'loopback' : 'public' };
}
const fracGcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const triAngle = (a, b, c) => Math.acos(Math.max(-1, Math.min(1, (b * b + c * c - a * a) / (2 * b * c))));
const clockOf = (s, what) => { const v = parseClock(s); need(v !== null, what + ': write a time like 9:00 am or 17:30'); return v; };
const hm = (min) => Math.floor(min / 60) + ':' + String(Math.round(min % 60)).padStart(2, '0');
const durText = (s) => { const neg = s < 0; s = Math.abs(Math.round(s)); const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (neg ? '−' : '') + d + ' days ' + h + ' h ' + m + ' min ' + x + ' s'; };

CALCULATORS.push(
  make('mortgage', 'Mortgage', 'Money', 'monthly = P × r ÷ (1 − (1 + r)^−n) + tax ÷ 12 + insurance ÷ 12 + PMI + HOA, P = price − down payment', ['price|Home price|money|$|400000', 'down|Down payment|ratio|%|20', 'rate|Interest rate (a year)|ratio|%|6.5', 'term|Loan term|time|yr|30', 'tax|Property tax a year|money|$|4800', 'ins|Home insurance a year|money|$|1500', 'pmi|PMI a year, when the down payment is under 20%|ratio|%|0.5', 'hoa|HOA fee a month|money|$|0'],
    ['monthly|Monthly payment, all in|money|$', 'pi|Principal and interest|money|$', 'loan|Loan amount|money|$', 'downamt|Down payment|money|$', 'pmimo|PMI a month|money|$', 'interest|Total interest|money|$', 'total|Total of all mortgage payments|money|$'],
    (x) => { pos(x.price, 'Home price'); const n = months(x.term, 'Loan term'), downamt = x.price * x.down, loan = x.price - downamt; pos(loan, 'Loan amount'); const a = amortize(loan, x.rate * 100, n); need(a, 'check the rate'); const pmimo = x.down < 0.2 ? (loan * x.pmi) / 12 : 0;
      return { monthly: a.pay + x.tax / 12 + x.ins / 12 + pmimo + x.hoa, pi: a.pay, loan, downamt, pmimo, interest: a.totalInterest, total: a.totalPaid, table: schedule(a.months) }; }, { everyday: true }),
  make('auto-loan', 'Auto loan', 'Money', 'loan = price + sales tax + fees − down payment − trade-in; payment = loan × r ÷ (1 − (1 + r)^−n)', ['price|Vehicle price|money|$|35000', 'down|Down payment|money|$|5000', 'trade|Trade-in value|money|$|3000', 'owed|Still owed on the trade-in|money|$|0', 'tax|Sales tax|ratio|%|7', 'fees|Title, registration and other fees|money|$|500', 'rate|Interest rate (a year)|ratio|%|5', 'term|Loan term|time|month|60'],
    ['pay|Monthly payment|money|$', 'loan|Loan amount|money|$', 'stax|Sales tax (on the price less the trade-in)|money|$', 'interest|Total interest|money|$', 'cost|Total cost (price, tax, fees and interest)|money|$'],
    (x) => { const n = months(x.term, 'Loan term'), stax = Math.max(0, x.price - x.trade) * x.tax, loan = x.price + stax + x.fees - x.down - x.trade + x.owed; pos(loan, 'Loan amount'); const a = amortize(loan, x.rate * 100, n); need(a, 'check the rate');
      return { pay: a.pay, loan, stax, interest: a.totalInterest, cost: x.price + stax + x.fees + x.owed + a.totalInterest, table: schedule(a.months) }; }),
  make('amortization', 'Amortization schedule', 'Money', 'each month: interest = balance × r; principal = payment − interest', ['P|Loan amount|money|$|200000', 'rate|Interest rate (a year)|ratio|%|6', 'term|Loan term|time|yr|30', 'extra|Extra paid each month|money|$|0'],
    ['pay|Monthly payment|money|$', 'interest|Total interest|money|$', 'total|Total paid|money|$', 'n|Paid off after|number|months'],
    (x) => { pos(x.P, 'Loan amount'); const a = amortize(x.P, x.rate * 100, months(x.term, 'Loan term'), x.extra); need(a, 'check the rate'); return { pay: a.pay, interest: a.totalInterest, total: a.totalPaid, n: a.payoffMonths, table: schedule(a.months) }; }),
  make('payoff-time', 'Payment: months to pay off a loan', 'Money', 'n = −ln(1 − r × P ÷ payment) ÷ ln(1 + r), r = rate ÷ 12', ['P|Loan amount|money|$|20000', 'rate|Interest rate (a year)|ratio|%|7', 'pay|Monthly payment|money|$|500'],
    ['n|Months to pay off|number|months', 'years|Years and months|text', 'interest|Total interest|money|$'],
    (x) => { pos(x.P, 'Loan amount'); pos(x.pay, 'Monthly payment'); const r = x.rate / 12; need(x.pay > x.P * r, 'the payment does not cover the interest, so the loan never ends'); const n = r === 0 ? x.P / x.pay : -Math.log(1 - (r * x.P) / x.pay) / Math.log(1 + r), m = Math.ceil(n - 1e-9);
      let bal = x.P, interest = 0; for (let k = 0; k < m && bal > 1e-9; k++) { const i = bal * r; interest += i; bal = bal + i - Math.min(x.pay, bal + i); } return { n, years: yearsMonths(m), interest }; }),
  make('rent-vs-buy', 'Rent or buy', 'Money', 'month by month: the buyer pays the mortgage and tax, insurance and upkeep; the renter pays rent and invests the down payment and buying costs; whoever pays less invests the difference; buyer\u2019s wealth = home value \u00d7 (1 \u2212 selling costs) \u2212 loan owed + investments',
    ['price|Home price|money|$|400000', 'down|Down payment|ratio|%|20', 'rate|Mortgage rate (a year)|ratio|%|6.5', 'term|Loan term|time|yr|30', 'rent|Rent a month now|money|$|2000', 'rg|Rent rises each year|ratio|%|3', 'hg|Home value rises each year|ratio|%|3', 'own|Tax, insurance and upkeep a year (share of the home\u2019s value)|ratio|%|2.5', 'buyc|Buying costs (share of the price)|ratio|%|3', 'sellc|Selling costs (share of the value)|ratio|%|6', 'inv|Investments earn each year|ratio|%|5', 'stay|Years you stay|time|yr|30'],
    ['be|Buying gets ahead after|text', 'buyw|Buyer\u2019s wealth when you leave|money|$', 'rentw|Renter\u2019s wealth when you leave|money|$', 'buymo|Buyer pays the first month|money|$', 'rentmo|Renter pays the first month|money|$'],
    (x) => { const stay = Math.round(x.stay / YEAR); need(stay >= 1 && stay <= 50, 'the stay is 1 to 50 years'); const o = rentVsBuy({ price: x.price, downPct: x.down * 100, ratePct: x.rate * 100, termYears: months(x.term, 'Loan term') / 12, rent: x.rent, rentGrowthPct: x.rg * 100, homeGrowthPct: x.hg * 100, ownPct: x.own * 100, buyPct: x.buyc * 100, sellPct: x.sellc * 100, investPct: x.inv * 100, years: stay });
      need(o, 'check the price, the rent and the rate'); const end = o.years[o.years.length - 1];
      return { be: o.breakEven ? (o.breakEven === 1 ? '1 year' : o.breakEven + ' years') : 'not within ' + stay + (stay === 1 ? ' year' : ' years'), buyw: end.buy, rentw: end.rent, buymo: o.buyFirst, rentmo: o.rentFirst,
        table: { head: ['Year', 'Buyer\u2019s wealth', 'Renter\u2019s wealth', 'Ahead'], rows: o.years.map((y) => [y.year, money2(y.buy), money2(y.rent), y.buy >= y.rent ? 'buy' : 'rent']), money: [1, 2] } }; }),
  make('interest-rate', 'Interest rate of a loan', 'Money', 'the rate r where P × r ÷ (1 − (1 + r)^−n) = payment (found by bisection)', ['P|Loan amount|money|$|20000', 'pay|Monthly payment|money|$|386.66', 'term|Loan term|time|month|60'],
    ['rate|Interest rate (a year)|ratio|%', 'interest|Total interest|money|$'], (x) => { const n = months(x.term, 'Loan term'), r = rateFor(x.P, x.pay, n); need(r !== null, 'the payments add up to less than the loan'); return { rate: r, interest: x.pay * n - x.P }; }),
  make('retirement', 'Retirement savings', 'Money', 'at retirement = savings × (1 + r)^n + monthly × ((1 + r)^n − 1) ÷ r; income = that × q ÷ (1 − (1 + q)^−m)', ['age|Age now|number||35', 'at|Retirement age|number||67', 'have|Saved so far|money|$|50000', 'monthly|Saved each month|money|$|1000', 'ret|Return before retirement (a year)|ratio|%|6', 'years|Years the money must last|number||25', 'after|Return in retirement (a year)|ratio|%|4'],
    ['nest|Savings at retirement|money|$', 'income|Monthly income it pays|money|$', 'put|Total you put in|money|$'],
    (x) => { need(x.at > x.age, 'the retirement age must be after your age now'); pos(x.years, 'Years the money must last'); const n = Math.round((x.at - x.age) * 12), r = x.ret / 12, g = Math.pow(1 + r, n), nest = x.have * g + x.monthly * (r === 0 ? n : (g - 1) / r);
      return { nest, income: payment(nest, x.after * 100, Math.round(x.years * 12)), put: x.have + x.monthly * n }; }),
  make('investment', 'Investment growth', 'Money', 'each month: balance × (1 + r)^(1/12) + contribution', ['P|Starting amount|money|$|20000', 'monthly|Added each month|money|$|500', 'r|Return (a year)|ratio|%|7', 't|Years|number||20', { k: 'per', label: 'Compounded', kind: 'choice', opts: [['12', 'monthly'], ['1', 'yearly'], ['4', 'quarterly'], ['365', 'daily']], v: '12' }],
    ['end|End balance|money|$', 'put|Total put in|money|$', 'gain|Growth|money|$'],
    (x) => { const c = compound({ principal: x.P, monthly: x.monthly, ratePct: x.r * 100, years: x.t, per: Number(x.per) }); return { end: c.final, put: c.contributed, gain: c.interest, table: { head: ['Year', 'Balance', 'Put in', 'Growth'], rows: c.years.map((y) => [y.year, money2(y.balance), money2(y.contributed), money2(y.interest)]), money: [1, 2, 3] } }; }),
  make('finance-tvm', 'Finance (time value of money)', 'Money', 'PV × (1 + i)ⁿ + PMT × ((1 + i)ⁿ − 1) ÷ i + FV = 0 (money paid out is negative)', [{ k: 'want', label: 'Work out', kind: 'choice', opts: [['fv', 'future value (FV)'], ['pv', 'present value (PV)'], ['pmt', 'payment (PMT)'], ['n', 'number of periods (N)'], ['i', 'interest rate (I/Y)']], v: 'fv' }, 'n|Periods (N)|number||120', 'iy|Interest rate a year (I/Y)|ratio|%|6', 'py|Periods a year|number||12', 'pv|Present value (PV)|number||-10000', 'pmt|Payment each period (PMT)|number||-100', 'fv|Future value (FV)|number||0'],
    ['ans|Answer|number', 'what|Worked out|text'],
    (x) => { pos(x.py, 'Periods a year'); const v = { n: x.n, i: x.iy / x.py, pv: x.pv, pmt: x.pmt, fv: x.fv }, r = tvm(x.want, v); return x.want === 'i' ? { ans: r * x.py * 100, what: 'interest rate a year, in %' } : { ans: r, what: { fv: 'future value', pv: 'present value', pmt: 'payment each period', n: 'number of periods' }[x.want] }; }),
  make('income-tax-us', 'US federal income tax', 'Money', 'tax = Σ (income in each bracket × its rate), taxable = income − pre-tax deductions − (standard or itemized deduction)', [{ k: 'year', label: 'Tax year', kind: 'choice', opts: [['2026', '2026'], ['2025', '2025']], v: '2026' }, { k: 'st', label: 'Filing status', kind: 'choice', opts: [['single', 'single'], ['mfj', 'married filing jointly'], ['mfs', 'married filing separately'], ['hoh', 'head of household']], v: 'single' }, 'inc|Gross income a year|money|$|100000', 'pre|Pre-tax deductions (401(k), HSA)|money|$|0', 'item|Itemized deductions (0 takes the standard)|money|$|0', 'cred|Tax credits|money|$|0'],
    ['tax|Federal income tax|money|$', 'taxable|Taxable income|money|$', 'ded|Deduction used|money|$', 'eff|Effective rate (of gross income)|ratio|%', 'marg|Marginal rate|ratio|%', 'net|Income after federal income tax|money|$', 'note|What this leaves out|text'],
    (x) => { const T = US_TAX[x.year], std = T.std[x.st], ded = Math.max(std, x.item), taxable = Math.max(0, x.inc - x.pre - ded), b = bracketTax(taxable, T.br[x.st]), tax = Math.max(0, b.tax - x.cred);
      return { tax, taxable, ded, eff: x.inc > 0 ? tax / x.inc : 0, marg: b.marginal, net: x.inc - tax, note: 'IRS brackets for ' + x.year + ' (Rev. Proc. 2025-32 for 2026). Not counted: state and local tax, Social Security and Medicare, AMT, capital gains rates, credits you leave out.',
        table: { head: ['From', 'To', 'Rate', 'Tax'], rows: b.parts.map(([f, t, r, v]) => [money2(f), money2(t), Math.round(r * 100) + '%', money2(v)]), money: [0, 1, 3] } }; }, { src: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf' }),
  make('pregnancy', 'Pregnancy (how far along)', 'Health', 'due date = first day of last period + 280 days + (cycle − 28); weeks = (date − last period) ÷ 7', ['lmp|First day of the last period|date||2026-06-01', 'on|On|date||2026-10-28', 'cycle|Cycle length (days)|number||28'],
    ['weeks|How far along|text', 'due|Due date (estimate)|text', 'tri|Trimester|text', 'conc|Likely conception|text', 'left|Days to the due date|number|days'],
    (x) => { const l = isoDay(x.lmp), on = isoDay(x.on), shift = Math.round(x.cycle - 28), d = daysBetween(l, on) - shift; need(d >= 0, 'the date is before the last period'); const due = addDays(l, 280 + shift);
      return { weeks: Math.floor(d / 7) + ' weeks ' + daysText(d % 7), due: due + ' (' + weekday(due) + ')', tri: d < 98 ? 'first (to week 13)' : d < 196 ? 'second (weeks 14 to 27)' : 'third (week 28 on)', conc: addDays(l, 14 + shift), left: daysBetween(on, due) }; }),
  make('due-date', 'Due date', 'Health', 'due = last period + 280 days (+ cycle − 28), conception + 266, 3-day embryo transfer + 263, 5-day transfer + 261', [{ k: 'by', label: 'From', kind: 'choice', opts: [['lmp', 'the first day of the last period'], ['conc', 'the conception date'], ['ivf3', 'an IVF 3-day embryo transfer'], ['ivf5', 'an IVF 5-day embryo transfer']], v: 'lmp' }, 'd|Date|date||2026-06-01', 'cycle|Cycle length (days, last period only)|number||28'],
    ['due|Due date (estimate)|text', 'day|Day of the week|text'], (x) => { const add = { lmp: 280 + Math.round(x.cycle - 28), conc: 266, ivf3: 263, ivf5: 261 }[x.by], due = addDays(isoDay(x.d), add); return { due, day: weekday(due) }; }),
  make('conception', 'Conception date', 'Health', 'conception ≈ due date − 266 days; fertile days = the 5 days before ovulation and the day of it', ['due|Due date|date||2027-03-08'],
    ['conc|Likely conception date|text', 'from|Fertile window from|text', 'to|Fertile window to|text', 'lmp|Matching last period|text'],
    (x) => { const due = isoDay(x.due), c = addDays(due, -266); return { conc: c, from: addDays(c, -5), to: addDays(c, 1), lmp: addDays(due, -280) }; }),
  make('fraction-math', 'Fraction arithmetic', 'Maths', 'a/b ± c/d = (ad ± bc) ÷ bd; a/b × c/d = ac ÷ bd; a/b ÷ c/d = ad ÷ bc', ['a|First numerator|number||1', 'b|First denominator|number||2', { k: 'op', label: 'Do', kind: 'choice', opts: [['+', 'add (+)'], ['-', 'subtract (−)'], ['*', 'multiply (×)'], ['/', 'divide (÷)']], v: '+' }, 'c|Second numerator|number||1', 'd|Second denominator|number||3'],
    ['frac|Answer|text', 'mixed|Mixed number|text', 'dec|Decimal|number'],
    (x) => { for (const k of ['a', 'b', 'c', 'd']) need(Number.isInteger(x[k]), 'use whole numbers in a fraction'); need(x.b !== 0 && x.d !== 0, 'a denominator cannot be zero');
      let n, m; if (x.op === '+') { n = x.a * x.d + x.c * x.b; m = x.b * x.d; } else if (x.op === '-') { n = x.a * x.d - x.c * x.b; m = x.b * x.d; } else if (x.op === '*') { n = x.a * x.c; m = x.b * x.d; } else { need(x.c !== 0, 'cannot divide by zero'); n = x.a * x.d; m = x.b * x.c; }
      const g = fracGcd(n, m), s = m < 0 ? -1 : 1; n = (s * n) / g; m = (s * m) / g; const w = Math.trunc(n / m), r = Math.abs(n % m);
      return { frac: m === 1 ? String(n) : n + '/' + m, mixed: m === 1 ? String(n) : w === 0 ? n + '/' + m : w + ' ' + r + '/' + m, dec: n / m }; }),
  make('triangle-solve', 'Triangle solver (any three parts)', 'Geometry', 'law of cosines c² = a² + b² − 2ab cos C; law of sines a ÷ sin A = b ÷ sin B = c ÷ sin C', [{ k: 'case', label: 'You know', kind: 'choice', opts: [['sss', 'three sides (a, b, c)'], ['sas', 'two sides and the angle between (b, c, A)'], ['asa', 'two angles and the side between (A, B, c)'], ['aas', 'two angles and another side (A, B, a)']], v: 'sss' }, 'a|Side a|length|cm|3', 'b|Side b|length|cm|4', 'c|Side c|length|cm|5', 'A|Angle A (opposite a)|angle|°|36.8699', 'B|Angle B (opposite b)|angle|°|53.1301'],
    ['a|Side a|length|cm', 'b|Side b|length|cm', 'c|Side c|length|cm', 'A|Angle A|angle|°', 'B|Angle B|angle|°', 'C|Angle C|angle|°', 'area|Area|area|cm²', 'per|Perimeter|length|cm'],
    (x) => { let { a, b, c, A, B } = x, C;
      if (x.case === 'sss') { pos(a, 'Side a'); pos(b, 'Side b'); pos(c, 'Side c'); need(a + b > c && a + c > b && b + c > a, 'those sides do not make a triangle'); A = triAngle(a, b, c); B = triAngle(b, a, c); C = PI - A - B; }
      else if (x.case === 'sas') { pos(b, 'Side b'); pos(c, 'Side c'); need(A > 0 && A < PI, 'angle A must be between 0° and 180°'); a = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(A)); B = triAngle(b, a, c); C = PI - A - B; }
      else { need(A > 0 && B > 0 && A + B < PI, 'the two angles must add to less than 180°'); C = PI - A - B; const k = x.case === 'asa' ? (pos(c, 'Side c'), c / Math.sin(C)) : (pos(a, 'Side a'), a / Math.sin(A)); a = k * Math.sin(A); b = k * Math.sin(B); c = k * Math.sin(C); }
      return { a, b, c, A, B, C, area: 0.5 * b * c * Math.sin(A), per: a + b + c }; }),
  make('random-number', 'Random number generator', 'Maths', 'a whole number from min to max, each as likely (crypto.getRandomValues)', ['lo|Smallest|number||1', 'hi|Largest|number||100', 'n|How many|number||1', yesNo('whole', 'Whole numbers'), yesNo('uniq', 'No repeats', 'n')],
    ['first|Number|number', 'all|All of them|text'],
    (x) => { need(x.hi >= x.lo, 'the largest must be at least the smallest'); const n = Math.round(x.n); need(n >= 1 && n <= 1000, 'make 1 to 1000 at a time'); const out = [];
      if (x.whole === 'y') { const lo = Math.ceil(x.lo), hi = Math.floor(x.hi); need(hi >= lo, 'no whole number lies between them'); need(x.uniq !== 'y' || hi - lo + 1 >= n, 'there are not that many different numbers'); const seen = new Set();
        while (out.length < n) { const v = lo + Math.floor(RNG.next() * (hi - lo + 1)); if (x.uniq === 'y') { if (seen.has(v)) continue; seen.add(v); } out.push(v); } }
      else for (let i = 0; i < n; i++) out.push(x.lo + RNG.next() * (x.hi - x.lo));
      return { first: out[0], all: out.map((v) => fmt(v, 12)).join(', ') }; }, { random: true }),
  make('password-generator', 'Password generator', 'Everyday', 'strength = length × log₂(characters to choose from) bits', ['len|Length|number||16', yesNo('lower', 'Lowercase a–z'), yesNo('upper', 'Uppercase A–Z'), yesNo('digits', 'Digits 0–9'), yesNo('sym', 'Symbols !@#…'), yesNo('amb', 'Leave out look-alikes (0 O 1 l I)', 'n')],
    ['pw|Password|text', 'bits|Strength|number|bits', 'pool|Characters to choose from|number'],
    (x) => { const n = Math.round(x.len); need(n >= 4 && n <= 256, 'a length of 4 to 256'); let sets = [x.lower === 'y' && 'abcdefghijklmnopqrstuvwxyz', x.upper === 'y' && 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', x.digits === 'y' && '0123456789', x.sym === 'y' && '!@#$%^&*()-_=+[]{};:,.?/~'].filter(Boolean);
      if (x.amb === 'y') sets = sets.map((s) => s.replace(/[0O1lI]/g, '')); need(sets.length, 'pick at least one kind of character'); need(n >= sets.length, 'too short to hold one of each kind');
      const pool = sets.join(''), pick = (s) => s[Math.floor(RNG.next() * s.length)];
      for (;;) { const pw = Array.from({ length: n }, () => pick(pool)).join(''); if (sets.every((s) => [...pw].some((ch) => s.includes(ch)))) return { pw, bits: n * Math.log2(pool.length), pool: pool.length }; } }, { random: true }),
  make('time-add', 'Time (add or subtract durations)', 'Everyday', 'total = d₁ days h₁ h m₁ min s₁ s ± d₂ days h₂ h m₂ min s₂ s', ['d1|Days|number||1', 'h1|Hours|number||10', 'm1|Minutes|number||45', 's1|Seconds|number||0', { k: 'op', label: 'Do', kind: 'choice', opts: [['+', 'add'], ['-', 'subtract']], v: '+' }, 'd2|Days|number||0', 'h2|Hours|number||20', 'm2|Minutes|number||30', 's2|Seconds|number||15'],
    ['t|Result|text', 'h|In hours|number|h', 'min|In minutes|number|min', 's|In seconds|number|s'],
    (x) => { const a = x.d1 * 86400 + x.h1 * 3600 + x.m1 * 60 + x.s1, b = x.d2 * 86400 + x.h2 * 3600 + x.m2 * 60 + x.s2, t = x.op === '-' ? a - b : a + b; return { t: durText(t), h: t / 3600, min: t / 60, s: t }; }),
  make('hours-worked', 'Hours between two times (hours worked)', 'Everyday', 'hours = end − start − break (an end before the start is the next day)', ['start|Start|text||9:00 am', 'end|End|text||5:30 pm', 'brk|Unpaid break|time|min|30', 'wage|Hourly pay (optional)|money|$|0'],
    ['h|Hours|number|h', 'hm|Hours and minutes|text', 'pay|Pay|money|$'],
    (x) => { const a = clockOf(x.start, 'Start'), b = clockOf(x.end, 'End'), span = (b - a + 1440) % 1440, m = span - x.brk / 60; need(m >= 0, 'the break is longer than the time'); return { h: m / 60, hm: hm(m), pay: (m / 60) * x.wage }; }),
  make('gpa', 'GPA', 'Statistics', 'GPA = Σ (grade points × credits) ÷ Σ credits (A = 4.0, A− = 3.7, B+ = 3.3, … F = 0)', ['g|Grades (letters or points), in order|text||A, B+, A-, B, C', 'cr|Credits for each|list:number||4, 3, 3, 3, 2'],
    ['gpa|GPA|number', 'credits|Credits|number', 'points|Grade points|number'],
    (x) => { const gs = String(x.g).split(/[,;\s]+/).filter(Boolean); need(gs.length, 'type the grades'); need(gs.length === x.cr.length, 'give one credit number for each grade (' + gs.length + ' grades, ' + x.cr.length + ' credits)');
      const pts = gs.map((g) => { const u = g.toUpperCase().replace('−', '-'); if (GRADES[u] !== undefined) return GRADES[u]; const v = Number(g); need(Number.isFinite(v) && v >= 0 && v <= 5, 'no grade "' + g + '"'); return v; });
      const credits = sum(x.cr); pos(credits, 'Credits'); const points = sum(pts.map((p, i) => p * x.cr[i])); return { gpa: points / credits, credits, points }; }),
  make('final-grade', 'Grade needed on the final', 'Statistics', 'needed = (wanted − current × (1 − weight)) ÷ weight', ['cur|Grade so far|ratio|%|85', 'want|Grade you want|ratio|%|88', 'w|The final counts for|ratio|%|30'],
    ['need|Needed on the final|ratio|%', 'say|In words|text'], (x) => { need(x.w > 0 && x.w <= 1, 'the final counts for more than 0% and up to 100%'); const n = (x.want - x.cur * (1 - x.w)) / x.w; return { need: n, say: n > 1 ? 'more than 100%: out of reach without extra credit' : n <= 0 ? 'already there, even with 0 on the final' : 'reachable' }; }),
  make('ip-subnet', 'IP subnet', 'Electrical', 'network = address AND mask; broadcast = network OR NOT mask; hosts = 2^(32 − prefix) − 2', ['ip|Address and prefix (or mask)|text||192.168.1.10/24'],
    ['network|Network|text', 'first|First usable host|text', 'last|Last usable host|text', 'broadcast|Broadcast|text', 'mask|Subnet mask|text', 'wildcard|Wildcard mask|text', 'hosts|Usable hosts|number', 'total|Addresses in the block|number', 'cls|Class|text', 'kind|Kind|text'], (x) => subnet(x.ip)),
);

// ---------------- calculator.net's full sitemap, Maths (tools/rival-inventory.mjs finds the gaps; docs/PARITY.md lists them): the gaps, filled
// exact decimals: ±D × 10^s with D a BigInt, so 1.005 rounds to 1.01 and 0.1 + 0.2 stays 0.3
export function decOf(text) {
  const t = String(text ?? '').trim().replace(/[\s,_]/g, '').replace(/[−–]/g, '-').replace(/×10\^?/i, 'e');
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(t); need(m && (m[2] || m[3]), 'type a number such as 1234.5678 or 6.02e23');
  const frac = m[3] || '', e = Number(m[4] || 0); need(Math.abs(e) <= 100000, 'that exponent is too big');
  return { neg: m[1] === '-' && /[1-9]/.test(m[2] + frac), D: BigInt((m[2] + frac).replace(/^0+(?=\d)/, '') || '0'), s: e - frac.length };
}
const TEN = (n) => 10n ** BigInt(n);
/** round ±D × 10^s to 10^-p (p may be negative: −1 rounds to tens) by mode: half (half away from zero), even (half to even), up (toward +∞), down (toward −∞), trunc (toward zero). Pure. */
export function roundDec(d, p, mode = 'half') {
  if (d.s >= -p) return { ...d };
  const q = TEN(-p - d.s); let k = d.D / q; const r = d.D % q, twice = 2n * r;
  const bump = mode === 'trunc' ? false : mode === 'up' ? r > 0n && !d.neg : mode === 'down' ? r > 0n && d.neg : twice > q || (twice === q && (mode === 'half' || k % 2n === 1n));
  if (bump) k += 1n; return { neg: d.neg && k !== 0n, D: k, s: -p };
}
/** ±D × 10^s written out in full: '-1234.57', '1200', '0.000123'. Pure. */
export function decText(d) {
  let s = d.D.toString(), out;
  if (d.s >= 0) out = d.D === 0n ? '0' : s + '0'.repeat(d.s);
  else { const n = -d.s; s = s.padStart(n + 1, '0'); out = s.slice(0, -n) + '.' + s.slice(-n); }
  return (d.neg ? '-' : '') + out;
}
const exp10 = (d) => (d.D === 0n ? 0 : d.D.toString().length - 1 + d.s);
/** a × 10ⁿ: { mant, e } with the mantissa's digits trimmed, to sig significant figures (0 keeps them all). Pure. */
export function sciOf(d, sig = 0, step = 1) {
  if (sig > 0 && d.D !== 0n) d = roundDec(d, sig - 1 - exp10(d));
  let digits = d.D.toString(), e = exp10(d);
  if (d.D === 0n) return { mant: '0', e: 0 };
  let lead = 1; const shift = ((e % step) + step) % step; e -= shift; lead += shift;
  digits = sig ? digits.padEnd(sig, '0').slice(0, Math.max(sig, lead)) : digits; digits = digits.padEnd(lead, '0');
  let tail = digits.slice(lead); if (!sig) tail = tail.replace(/0+$/, '');
  return { mant: (d.neg ? '-' : '') + digits.slice(0, lead) + (tail ? '.' + tail : ''), e };
}
const SUP = (n) => String(n).replace(/[-0-9]/g, (c) => ({ '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' })[c]);
// whole numbers in any base 2 to 36, of any size
const DIGITS36 = '0123456789abcdefghijklmnopqrstuvwxyz';
export function bigOf(text, base, what = 'a number') {
  let t = String(text ?? '').trim().toLowerCase().replace(/[\s_,]/g, '').replace(/[−–]/g, '-'); const neg = t.startsWith('-'); if (neg || t.startsWith('+')) t = t.slice(1);
  const pre = { 2: '0b', 8: '0o', 16: '0x' }[base]; if (pre && t.startsWith(pre)) t = t.slice(2);
  need(t.length, 'type ' + what); const B = BigInt(base); let v = 0n;
  for (const ch of t) { const i = DIGITS36.indexOf(ch); need(i >= 0 && i < base, '"' + ch + '" is not a base-' + base + ' digit (in ' + what + ')'); v = v * B + BigInt(i); }
  return neg ? -v : v;
}
export const bigTo = (v, base) => (v < 0n ? '-' + (-v).toString(base) : v.toString(base)).toUpperCase();
// p-values: the Lanczos log-gamma (g = 7, nine terms), the regularized incomplete beta and gamma (Numerical Recipes 3rd ed. §6.1, §6.2, §6.4)
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lnGamma(z) {
  if (z < 0.5) return Math.log(PI / Math.abs(Math.sin(PI * z))) - lnGamma(1 - z);
  z -= 1; let a = LANCZOS[0]; const t = z + 7.5; for (let i = 1; i < 9; i++) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}
function betaCf(a, b, x) {
  const TINY = 1e-300; let c = 1, d = 1 - ((a + b) * x) / (a + 1); if (Math.abs(d) < TINY) d = TINY; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}
/** the regularized incomplete beta I_x(a, b). Pure. */
export function betaInc(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betaCf(a, b, x)) / a : 1 - (bt * betaCf(b, a, 1 - x)) / b;
}
/** the regularized upper incomplete gamma Q(a, x). Pure. */
export function gammaQ(a, x) {
  if (x <= 0) return 1; const lg = lnGamma(a);
  if (x < a + 1) { let sum = 1 / a, del = sum, ap = a; for (let n = 0; n < 1000; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; } return 1 - sum * Math.exp(-x + a * Math.log(x) - lg); }
  const TINY = 1e-300; let b = x + 1 - a, c = 1 / TINY, d = 1 / b, h = d;
  for (let i = 1; i <= 1000; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < TINY) d = TINY; c = b + an / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-16) break; }
  return Math.exp(-x + a * Math.log(x) - lg) * h;
}
/** P(T ≤ t) for Student's t with df degrees of freedom. Pure. */
export const tCdf = (t, df) => { const tail = 0.5 * betaInc(df / (df + t * t), df / 2, 0.5); return t > 0 ? 1 - tail : tail; };
// matrices typed as rows: '1 2; 3 4' or one row a line
export function matrixOf(text, what = 'the matrix') {
  const rows = String(text ?? '').trim().split(/\s*[;\n]\s*/).filter(Boolean).map((r) => r.replace(/[[\]]/g, '').trim().split(/[\s,]+/).filter(Boolean).map((v) => Number(v.replace(/[−–]/g, '-'))));
  need(rows.length && rows[0].length, 'type ' + what + ' as rows, such as 1 2; 3 4');
  need(rows.every((r) => r.length === rows[0].length), 'every row of ' + what + ' needs the same number of entries');
  need(rows.every((r) => r.every(Number.isFinite)), what + ' has an entry that is not a number');
  return rows;
}
/** the determinant and the inverse (null when singular) by Gauss–Jordan elimination with partial pivoting. Pure. */
export function gaussJordan(A) {
  const n = A.length; need(A.every((r) => r.length === n), 'that needs a square matrix');
  const M = A.map((r, i) => [...r, ...r.map((_, j) => (i === j ? 1 : 0))]); let det = 1;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return { det: 0, inv: null };
    if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; det = -det; }
    const v = M[c][c]; det *= v; for (let j = 0; j < 2 * n; j++) M[c][j] /= v;
    for (let r = 0; r < n; r++) if (r !== c && M[r][c]) { const f = M[r][c]; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return { det, inv: M.map((r) => r.slice(n)) };
}
const tidy = (v) => { const r = Number(v.toPrecision(12)); return Object.is(r, -0) ? '0' : String(r); };
const matText = (M) => M.map((r) => r.map(tidy).join(' ')).join('; ');
const matTable = (M) => ({ head: ['', ...M[0].map((_, j) => 'Column ' + (j + 1))], rows: M.map((r, i) => ['Row ' + (i + 1), ...r.map(tidy)]) });
const SOLID = { k: 'shape', label: 'Shape', kind: 'choice', opts: [['cube', 'cube (side a)'], ['box', 'box (length a, width b, height h)'], ['sphere', 'sphere (radius a)'], ['hemisphere', 'hemisphere with its base (radius a)'], ['cylinder', 'cylinder (radius a, height h)'], ['cone', 'cone (radius a, height h)'], ['pyramid', 'square pyramid (base side a, height h)'], ['capsule', 'capsule (radius a, straight part h)']], v: 'cube' };
const BASE_OP = { k: 'op', label: 'Do', kind: 'choice', opts: [['+', 'add (+)'], ['-', 'subtract (−)'], ['*', 'multiply (×)'], ['/', 'divide (÷): whole part and remainder'], ['&', 'AND'], ['|', 'OR'], ['^', 'XOR']], v: '+' };
const baseMath = (base, what) => (x) => {
  const a = bigOf(x.a, base, 'the first ' + what), b = bigOf(x.b, base, 'the second ' + what); let r, rem = null;
  if (x.op === '+') r = a + b; else if (x.op === '-') r = a - b; else if (x.op === '*') r = a * b;
  else if (x.op === '/') { need(b !== 0n, 'cannot divide by zero'); r = a / b; rem = a % b; }
  else { need(a >= 0n && b >= 0n, 'AND, OR and XOR take numbers of 0 or more'); r = x.op === '&' ? a & b : x.op === '|' ? a | b : a ^ b; }
  return { res: bigTo(r, base), rem: rem === null ? '—' : bigTo(rem, base), dec: r.toString(), bin: bigTo(r, 2), hex: bigTo(r, 16) };
};
const wholeOf = (v, what, max = 1e15) => { need(Number.isInteger(v) && v >= 1 && v <= max, what + ' must be a whole number from 1 to ' + fmt(max)); return v; };
const factorsOf = (n) => { const lo = [], hi = []; for (let i = 1; i * i <= n; i++) if (n % i === 0) { lo.push(i); if (i !== n / i) hi.unshift(n / i); } return [...lo, ...hi]; };
const primesOf = (n) => { const out = []; for (const p of [2, 3]) while (n % p === 0) { out.push(p); n /= p; } for (let i = 5; i * i <= n; i += 6) for (const p of [i, i + 2]) while (n % p === 0) { out.push(p); n /= p; } if (n > 1) out.push(n); return out; };
const powers = (ps) => { const m = new Map(); for (const p of ps) m.set(p, (m.get(p) || 0) + 1); return [...m]; };
const ROUND = { k: 'mode', label: 'Rule', kind: 'choice', opts: [['half', 'nearest, halves away from zero (2.5 → 3)'], ['even', 'nearest, halves to even (2.5 → 2)'], ['up', 'up, toward +∞ (ceiling)'], ['down', 'down, toward −∞ (floor)'], ['trunc', 'toward zero (cut off)']], v: 'half' };
CALCULATORS.push(
  make('solid-shapes', 'Volume and surface area of solids', 'Geometry', 'cube a³, 6a²; box abh, 2(ab + ah + bh); sphere 4/3 πa³, 4πa²; cylinder πa²h, 2πa(a + h); cone πa²h ÷ 3, πa(a + √(a² + h²)); square pyramid a²h ÷ 3, a² + 2a√((a/2)² + h²); capsule πa²(4a/3 + h), 2πa(2a + h)',
    [SOLID, 'a|a (side, length or radius)|length|cm|10', 'b|b (width, box only)|length|cm|5', 'h|h (height)|length|cm|4'], ['v|Volume|volume|cm³', 'area|Surface area|area|cm²'],
    (x) => { const { a, b, h } = x; pos(a, 'a'); const S = x.shape; if (S === 'box') { pos(b, 'b'); pos(h, 'h'); } if (['cylinder', 'cone', 'pyramid'].includes(S)) pos(h, 'h'); if (S === 'capsule') need(h >= 0, 'h cannot be negative');
      const r = { cube: [a ** 3, 6 * a * a], box: [a * b * h, 2 * (a * b + a * h + b * h)], sphere: [(4 / 3) * PI * a ** 3, 4 * PI * a * a], hemisphere: [(2 / 3) * PI * a ** 3, 3 * PI * a * a],
        cylinder: [PI * a * a * h, 2 * PI * a * (a + h)], cone: [(PI * a * a * h) / 3, PI * a * (a + Math.hypot(a, h))], pyramid: [(a * a * h) / 3, a * a + 2 * a * Math.hypot(a / 2, h)], capsule: [PI * a * a * ((4 * a) / 3 + h), 2 * PI * a * (2 * a + h)] }[S];
      need(r, 'pick a shape'); return { v: r[0], area: r[1] }; }),
  make('number-sequence', 'Number sequence (arithmetic, geometric, Fibonacci)', 'Maths', 'arithmetic aₙ = a₁ + (n − 1)d, Sₙ = n(a₁ + aₙ) ÷ 2; geometric aₙ = a₁rⁿ⁻¹, Sₙ = a₁(1 − rⁿ) ÷ (1 − r); Fibonacci Fₙ = Fₙ₋₁ + Fₙ₋₂ from 1, 1',
    [{ k: 'type', label: 'Sequence', kind: 'choice', opts: [['arith', 'arithmetic (add d each time)'], ['geom', 'geometric (multiply by r each time)'], ['fib', 'Fibonacci (1, 1, 2, 3, 5, …)']], v: 'arith' }, 'a1|First term a₁|number||2', 'd|Step d, or ratio r|number||3', 'n|Term number n|number||10'],
    ['an|nth term|number', 'sn|Sum of the first n terms|number', 'first|The first terms|text'],
    (x) => { const n = x.n; need(Number.isInteger(n) && n >= 1 && n <= 10000, 'n must be a whole number from 1 to 10,000'); let term, an, sn;
      if (x.type === 'fib') { const f = [1, 1]; while (f.length < Math.min(n, 1476)) f.push(f.at(-1) + f.at(-2)); an = n <= 2 ? 1 : n <= 1476 ? f[n - 1] : Infinity; term = (i) => f[i - 1]; let s = 0; for (let i = 0; i < Math.min(n, f.length); i++) s += f[i]; sn = n <= 1476 ? s : Infinity; }
      else if (x.type === 'geom') { term = (i) => x.a1 * x.d ** (i - 1); an = term(n); sn = x.d === 1 ? n * x.a1 : (x.a1 * (1 - x.d ** n)) / (1 - x.d); }
      else { term = (i) => x.a1 + (i - 1) * x.d; an = term(n); sn = (n * (x.a1 + an)) / 2; }
      const k = Math.min(n, 10), shown = []; for (let i = 1; i <= k; i++) shown.push(fmt(term(i), 12)); need(Number.isFinite(an), 'the nth term is too big to write'); return { an, sn, first: shown.join(', ') + (n > k ? ', …' : '') }; }),
  make('binary-math', 'Binary arithmetic', 'Maths', 'the numbers in base 2: + − × ÷ (whole part and remainder), AND, OR, XOR, of any size', ['a|First number (binary)|text||1011', BASE_OP, 'b|Second number (binary)|text||110'],
    ['res|Answer (binary)|text', 'rem|Remainder (binary)|text', 'dec|Answer (decimal)|text', 'hex|Answer (hexadecimal)|text'], baseMath(2, 'binary number')),
  make('hex-math', 'Hexadecimal arithmetic', 'Maths', 'the numbers in base 16 (digits 0–9 and A–F): + − × ÷ (whole part and remainder), AND, OR, XOR, of any size', ['a|First number (hex)|text||1F4', BASE_OP, 'b|Second number (hex)|text||A'],
    ['res|Answer (hex)|text', 'rem|Remainder (hex)|text', 'dec|Answer (decimal)|text', 'bin|Answer (binary)|text'], baseMath(16, 'hex number')),
  make('base-convert', 'Number base converter', 'Maths', 'value = Σ digitᵢ × baseⁱ; written again by repeated division by the new base', ['n|Number|text||255', 'from|From base (2 to 36)|number||10', 'to|To base (2 to 36)|number||2'],
    ['res|In the new base|text', 'dec|Decimal|text', 'bin|Binary|text', 'oct|Octal|text', 'hex|Hexadecimal|text'],
    (x) => { for (const k of ['from', 'to']) need(Number.isInteger(x[k]) && x[k] >= 2 && x[k] <= 36, 'a base is a whole number from 2 to 36'); const v = bigOf(x.n, x.from, 'the number');
      return { res: bigTo(v, x.to), dec: v.toString(), bin: bigTo(v, 2), oct: bigTo(v, 8), hex: bigTo(v, 16) }; }),
  make('probability-two', 'Probability of two independent events', 'Statistics', 'P(A and B) = P(A)P(B); P(A or B) = P(A) + P(B) − P(A)P(B); P(exactly one) = P(A) + P(B) − 2P(A)P(B); P(neither) = (1 − P(A))(1 − P(B))',
    ['pa|P(A)|ratio|%|50', 'pb|P(B)|ratio|%|40'], ['and|Both A and B|ratio|%', 'or|A or B or both|ratio|%', 'one|Exactly one of them|ratio|%', 'neither|Neither|ratio|%', 'nota|Not A|ratio|%', 'notb|Not B|ratio|%'],
    (x) => { for (const k of ['pa', 'pb']) need(x[k] >= 0 && x[k] <= 1, 'a probability is from 0% to 100%'); const { pa, pb } = x;
      return { and: pa * pb, or: pa + pb - pa * pb, one: pa + pb - 2 * pa * pb, neither: (1 - pa) * (1 - pb), nota: 1 - pa, notb: 1 - pb }; }),
  make('ratio', 'Ratio: simplify, and scale A : B = C : D', 'Maths', 'D = B × C ÷ A; A : B in lowest terms divides both by their greatest common divisor', ['a|A|number||2', 'b|B|number||3', 'c|C|number||10'],
    ['d|D|number', 'simple|A : B in lowest terms|text', 'dec|A ÷ B|number'],
    (x) => { need(x.a !== 0 && x.b !== 0, 'A and B cannot be zero'); const places = Math.max(...[x.a, x.b].map((v) => (String(v).split('.')[1] || '').length)); need(places <= 9, 'use at most 9 decimal places');
      const s = 10 ** places, p = Math.round(x.a * s), q = Math.round(x.b * s), g = gcd(p, q) || 1; return { d: (x.b * x.c) / x.a, simple: p / g + ' : ' + q / g, dec: x.a / x.b }; }),
  make('factors', 'Factors of a number', 'Maths', 'every whole d with n ÷ d whole, found in pairs d × (n ÷ d) up to √n', ['n|Number|number||60'],
    ['list|Factors|text', 'count|How many|number', 'sum|Their sum|number', 'pairs|Factor pairs|text', 'prime|Prime?|text'],
    (x) => { const n = wholeOf(x.n, 'the number', 1e13), f = factorsOf(n), half = f.slice(0, Math.ceil(f.length / 2));
      return { list: f.join(', '), count: f.length, sum: sum(f), pairs: half.map((d) => d + ' × ' + n / d).join(', '), prime: f.length === 2 ? 'yes' : 'no' }; }),
  make('prime-factorization', 'Prime factorization', 'Maths', 'n = p₁^e₁ × p₂^e₂ × …, by trial division up to √n', ['n|Number|number||360'],
    ['form|Prime factors|text', 'flat|Written out|text', 'distinct|Different primes|number', 'prime|Prime?|text'],
    (x) => { const n = wholeOf(x.n, 'the number'); need(n >= 2, 'a number from 2 up has prime factors'); const ps = primesOf(n), pw = powers(ps);
      return { form: pw.map(([p, e]) => p + (e > 1 ? SUP(e) : '')).join(' × '), flat: ps.join(' × '), distinct: pw.length, prime: ps.length === 1 ? 'yes' : 'no' }; }),
  make('common-factors', 'Common factors and greatest common factor of a list', 'Maths', 'GCF = gcd(a, gcd(b, …)); the common factors are the factors of the GCF; LCM = lcm(a, lcm(b, …))', ['data|Whole numbers (commas or spaces)|list:number||12, 18, 30'],
    ['gcf|Greatest common factor|number', 'common|Common factors|text', 'lcm|Least common multiple|number'],
    (x) => { const a = x.data; need(a.length >= 2, 'type two or more numbers'); for (const v of a) wholeOf(v, 'each number', 1e13); const g = a.reduce((p, q) => gcd(p, q)), l = a.reduce((p, q) => (p / gcd(p, q)) * q);
      return { gcf: g, common: factorsOf(g).join(', '), lcm: l }; }),
  make('rounding', 'Rounding', 'Maths', 'keep p decimal places (−1 for tens, −2 for hundreds) by the rule chosen, worked on the exact decimal digits', ['v|Number|text||1234.5678', 'p|Decimal places|number||2', ROUND],
    ['r|Rounded|text', 'sci|In scientific notation|text'],
    (x) => { need(Number.isInteger(x.p) && Math.abs(x.p) <= 100, 'decimal places must be a whole number from −100 to 100'); const d = roundDec(decOf(x.v), x.p, x.mode), s = sciOf(d);
      return { r: decText(d), sci: s.mant + ' × 10' + SUP(s.e) }; }, { src: 'https://standards.ieee.org/ieee/754/6210/' }),
  make('matrix', 'Matrix calculator', 'Maths', 'det and inverse by Gauss–Jordan elimination; (AB)ᵢⱼ = Σₖ AᵢₖBₖⱼ; (Aᵀ)ᵢⱼ = Aⱼᵢ', ['A|Matrix A (rows split by ;)|text||1 2; 3 4',
      { k: 'op', label: 'Do', kind: 'choice', opts: [['det', 'determinant of A'], ['inv', 'inverse of A'], ['T', 'transpose of A'], ['mul', 'A × B'], ['add', 'A + B'], ['sub', 'A − B'], ['scale', 'k × A']], v: 'inv' }, 'B|Matrix B|text||5 6; 7 8', 'k|k|number||2'],
    ['res|Answer|text', 'det|Determinant of A|number', 'size|Size of the answer|text'],
    (x) => { const A = matrixOf(x.A, 'matrix A'), n = A.length, m = A[0].length; let R = null, det = null;
      if (n === m) det = gaussJordan(A).det;
      if (x.op === 'det') { need(n === m, 'only a square matrix has a determinant'); R = [[det]]; }
      else if (x.op === 'inv') { need(n === m, 'only a square matrix has an inverse'); const g = gaussJordan(A); need(g.inv, 'A has no inverse: its determinant is 0'); R = g.inv; }
      else if (x.op === 'T') R = A[0].map((_, j) => A.map((r) => r[j]));
      else if (x.op === 'scale') R = A.map((r) => r.map((v) => x.k * v));
      else { const B = matrixOf(x.B, 'matrix B');
        if (x.op === 'mul') { need(B.length === m, 'A × B needs as many rows in B as columns in A'); R = A.map((r) => B[0].map((_, j) => r.reduce((s, v, i) => s + v * B[i][j], 0))); }
        else { need(B.length === n && B[0].length === m, 'A and B must be the same size'); R = A.map((r, i) => r.map((v, j) => (x.op === 'add' ? v + B[i][j] : v - B[i][j]))); } }
      return { res: matText(R), det, size: R.length + ' × ' + R[0].length, table: matTable(R) }; }),
  make('scientific-notation', 'Scientific notation', 'Maths', 'x = a × 10ⁿ with 1 ≤ |a| < 10; engineering notation keeps n a multiple of 3', ['v|Number|text||0.000123456', 'sig|Significant figures (0 keeps them all)|number||0'],
    ['sci|Scientific notation|text', 'e|E notation|text', 'eng|Engineering notation|text', 'dec|Written out|text'],
    (x) => { need(Number.isInteger(x.sig) && x.sig >= 0 && x.sig <= 1000, 'significant figures must be a whole number, 0 or more'); const d = decOf(x.v), s = sciOf(d, x.sig), g = sciOf(d, x.sig, 3);
      const shown = x.sig ? roundDec(d, x.sig - 1 - exp10(d)) : d; need(Math.abs(exp10(d)) <= 400, 'that number is too big or small to write out');
      return { sci: s.mant + ' × 10' + SUP(s.e), e: s.mant + 'e' + s.e, eng: g.mant + ' × 10' + SUP(g.e), dec: decText(shown) }; }),
  make('big-number', 'Big number arithmetic', 'Maths', 'exact whole-number arithmetic of any size: + − × ÷ (whole part and remainder), powers, gcd', ['a|First whole number|text||2',
      { k: 'op', label: 'Do', kind: 'choice', opts: [['+', 'add (+)'], ['-', 'subtract (−)'], ['*', 'multiply (×)'], ['/', 'divide (÷): whole part and remainder'], ['pow', 'power (first ^ second)'], ['gcd', 'greatest common divisor']], v: 'pow' }, 'b|Second whole number|text||100'],
    ['res|Answer|text', 'rem|Remainder|text', 'digits|Digits in the answer|number', 'sci|About|text'],
    (x) => { const a = bigOf(x.a, 10, 'the first number'), b = bigOf(x.b, 10, 'the second number'); let r, rem = '—';
      if (x.op === '+') r = a + b; else if (x.op === '-') r = a - b; else if (x.op === '*') r = a * b;
      else if (x.op === '/') { need(b !== 0n, 'cannot divide by zero'); r = a / b; rem = (a % b).toString(); }
      else if (x.op === 'pow') { need(b >= 0n, 'the power must be 0 or more'); const digits = Number(b) * (a < 0n ? -a : a).toString().length; need(a === 0n || a === 1n || a === -1n || digits <= 100000, 'the answer would have more than 100,000 digits'); r = a ** b; }
      else { let p = a < 0n ? -a : a, q = b < 0n ? -b : b; while (q) [p, q] = [q, p % q]; r = p; }
      const s = sciOf(decOf(r.toString()), 10); return { res: r.toString(), rem, digits: (r < 0n ? -r : r).toString().length, sci: s.mant + ' × 10' + SUP(s.e) }; }),
  make('long-division', 'Long division', 'Maths', 'dividend = divisor × quotient + remainder; the decimal repeats once a remainder comes back', ['n|Dividend|number||1234', 'd|Divisor|number||7'],
    ['q|Quotient (whole part)|number', 'r|Remainder|number', 'dec|Decimal (repeating digits in brackets)|text', 'mixed|As a mixed number|text'],
    (x) => { need(Number.isInteger(x.n) && x.n >= 0 && x.n <= 1e15, 'the dividend must be a whole number from 0 to 10¹⁵'); const d = wholeOf(x.d, 'the divisor', 1e9);
      const q = Math.floor(x.n / d), r = x.n - q * d, rows = []; let cur = 0, i = 0;
      for (const ch of String(x.n)) { cur = cur * 10 + Number(ch); const qd = Math.floor(cur / d); rows.push([++i, cur + ' ÷ ' + d, qd, qd * d, cur - qd * d]); cur -= qd * d; }
      let rem = r, digits = ''; const seen = new Map(); while (rem && !seen.has(rem) && digits.length < 2000) { seen.set(rem, digits.length); rem *= 10; digits += Math.floor(rem / d); rem %= d; }
      const frac = !rem ? digits : seen.has(rem) ? digits.slice(0, seen.get(rem)) + '(' + digits.slice(seen.get(rem)) + ')' : digits + '…'; // ellipsis-ok: a decimal that has not repeated within 2000 digits goes on, so the dots are the true value, not a cut sentence
      const g = gcd(r, d) || 1;
      return { q, r, dec: q + (frac ? '.' + frac : ''), mixed: r ? (q ? q + ' ' : '') + r / g + '/' + d / g : String(q), table: { head: ['Step', 'Divide', 'Quotient digit', 'Take away', 'Remainder'], rows } }; }),
  make('p-value', 'P-value from a z, t or chi-square statistic', 'Statistics', 'z: p from the normal curve; t: P(T ≤ t) = 1 − ½ I_{ν/(ν+t²)}(ν/2, ½); χ²: P(X ≥ x) = Q(k/2, x/2)', ['stat|Test statistic|number||1.96',
      { k: 'dist', label: 'Distribution', kind: 'choice', opts: [['z', 'z (normal)'], ['t', 't (Student)'], ['chi', 'chi-square']], v: 'z' }, 'df|Degrees of freedom (t and chi-square)|number||10',
      { k: 'tail', label: 'Test', kind: 'choice', opts: [['two', 'two-tailed'], ['right', 'right-tailed (greater than)'], ['left', 'left-tailed (less than)']], v: 'two' }],
    ['p|P-value|number', 'sig05|Significant at 5%?|text', 'sig01|Significant at 1%?|text'],
    (x) => { if (x.dist !== 'z') pos(x.df, 'Degrees of freedom'); let cdf;
      if (x.dist === 'z') cdf = normalCdf(x.stat); else if (x.dist === 't') cdf = tCdf(x.stat, x.df); else { need(x.stat >= 0, 'a chi-square statistic is 0 or more'); cdf = 1 - gammaQ(x.df / 2, x.stat / 2); }
      const right = x.dist === 'chi' ? gammaQ(x.df / 2, x.stat / 2) : 1 - cdf;
      const p = x.tail === 'right' ? right : x.tail === 'left' ? cdf : Math.min(1, 2 * Math.min(cdf, right));
      return { p, sig05: p < 0.05 ? 'yes (p < 0.05)' : 'no (p ≥ 0.05)', sig01: p < 0.01 ? 'yes (p < 0.01)' : 'no (p ≥ 0.01)' }; }, { src: 'https://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm' }),
);

// ---------------- calculator.net's full sitemap, Other (tools/rival-inventory.mjs finds the gaps; docs/PARITY.md lists them): the gaps, filled
const toF = (k) => ((k - 273.15) * 9) / 5 + 32, fromF = (f) => ((f - 32) * 5) / 9 + 273.15, toC = (k) => k - 273.15;
/** the NWS heat index in °F from °F and relative humidity in %: Steadman's simple form, else the Rothfusz regression with the NWS adjustments. Pure. */
export function heatIndexF(T, RH) {
  const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + RH * 0.094); if ((simple + T) / 2 < 80) return simple;
  let hi = -42.379 + 2.04901523 * T + 10.14333127 * RH - 0.22475541 * T * RH - 0.00683783 * T * T - 0.05481717 * RH * RH + 0.00122874 * T * T * RH + 0.00085282 * T * RH * RH - 0.00000199 * T * T * RH * RH;
  if (RH < 13 && T >= 80 && T <= 112) hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  else if (RH > 85 && T >= 80 && T <= 87) hi += ((RH - 85) / 10) * ((87 - T) / 5);
  return hi;
}
const clock12 = (min) => { min = ((Math.round(min) % 1440) + 1440) % 1440; const h = Math.floor(min / 60), m = min % 60; return ((h + 11) % 12) + 1 + ':' + String(m).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); };
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export const toRoman = (n) => { need(Number.isInteger(n) && n >= 1 && n <= 3999, 'Roman numerals here run from 1 to 3999'); let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s; };
export function fromRoman(s) {
  const t = String(s).trim().toUpperCase(); need(t && /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(t), '"' + s + '" is not a Roman numeral written the standard way (such as MCMXCIV)');
  let n = 0, i = 0; for (const [v, r] of ROMAN) while (t.startsWith(r, i)) { n += v; i += r.length; } return n;
}
/** the handicap index from score differentials (the newest last), by the 2020 worldwide rules' table for 3 to 20 scores. Pure. */
export function handicapIndex(diffs) {
  const d = diffs.slice(-20), n = d.length; need(n >= 3, 'a handicap index needs at least 3 scores');
  const [use, adj] = n === 3 ? [1, -2] : n === 4 ? [1, -1] : n === 5 ? [1, 0] : n === 6 ? [2, -1] : n <= 8 ? [2, 0] : n <= 11 ? [3, 0] : n <= 14 ? [4, 0] : n <= 16 ? [5, 0] : n <= 18 ? [6, 0] : n === 19 ? [7, 0] : [8, 0];
  const low = [...d].sort((a, b) => a - b).slice(0, use); return { index: Math.min(54, Math.round((sum(low) / use + adj) * 10) / 10), used: use, of: n, adj };
}
const SIZE = { k: 'su', label: 'Size unit', kind: 'choice', opts: [['1e3', 'KB (1,000 bytes)'], ['1e6', 'MB'], ['1e9', 'GB'], ['1e12', 'TB'], ['1024', 'KiB (1,024 bytes)'], ['1048576', 'MiB'], ['1073741824', 'GiB'], ['1099511627776', 'TiB']], v: '1e9' };
const RATE = { k: 'ru', label: 'Speed unit', kind: 'choice', opts: [['1e3', 'kbit/s'], ['1e6', 'Mbit/s'], ['1e9', 'Gbit/s'], ['8e6', 'MB/s (megabytes)']], v: '1e6' };
const dlText = (s) => { if (s < 60) return fmt(s, 4) + ' s'; const t = Math.round(s), d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), r = t % 60; return [d && d + ' d', (d || h) && h + ' h', m + ' min', r + ' s'].filter(Boolean).join(' '); };
CALCULATORS.push(
  make('wind-chill', 'Wind chill', 'Everyday', 'WC (°F) = 35.74 + 0.6215T − 35.75V^0.16 + 0.4275T·V^0.16, T in °F and V in mph at 10 m (NWS, 2001); defined for T ≤ 50 °F and V ≥ 3 mph',
    ['T|Air temperature|temperature|°F|0', 'V|Wind speed|speed|mph|15'], ['wc|Feels like|temperature|°F', 'note|Note|text'],
    (x) => { const T = toF(x.T), V = x.V / 0.44704; need(V >= 0, 'wind speed cannot be negative'); const ok = T <= 50 && V >= 3, p = V ** 0.16;
      return { wc: ok ? fromF(35.74 + 0.6215 * T - 35.75 * p + 0.4275 * T * p) : x.T, note: ok ? 'within the formula’s range' : 'outside the formula’s range (it needs 50 °F or colder and wind of 3 mph or more), so this is the air temperature' }; },
    { src: 'https://www.weather.gov/media/epz/wxcalc/windChill.pdf' }),
  make('heat-index', 'Heat index', 'Everyday', 'NWS: HI = −42.379 + 2.04901523T + 10.14333127RH − 0.22475541T·RH − 0.00683783T² − 0.05481717RH² + 0.00122874T²RH + 0.00085282T·RH² − 0.00000199T²RH² (Rothfusz), with its low- and high-humidity adjustments, and Steadman’s simple form below 80 °F',
    ['T|Air temperature|temperature|°F|90', 'RH|Relative humidity|ratio|%|70'], ['hi|Feels like|temperature|°F', 'risk|NWS caution level|text'],
    (x) => { need(x.RH >= 0 && x.RH <= 1, 'humidity is from 0% to 100%'); const hi = heatIndexF(toF(x.T), x.RH * 100);
      return { hi: fromF(hi), risk: hi >= 125 ? 'extreme danger (125 °F or more)' : hi >= 103 ? 'danger (103–124 °F)' : hi >= 90 ? 'extreme caution (90–102 °F)' : hi >= 80 ? 'caution (80–89 °F)' : 'below the caution level (under 80 °F)' }; },
    { src: 'https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml' }),
  make('dew-point', 'Dew point', 'Everyday', 'γ = ln(RH) + bT ÷ (c + T); Td = cγ ÷ (b − γ), T in °C, b = 17.625, c = 243.04 °C (Magnus form, Alduchov and Eskridge 1996)',
    ['T|Air temperature|temperature|°C|25', 'RH|Relative humidity|ratio|%|60'], ['td|Dew point|temperature|°C', 'spread|Temperature minus dew point|tempdiff|°C'],
    (x) => { need(x.RH > 0 && x.RH <= 1, 'humidity is more than 0% and at most 100%'); const T = toC(x.T), g = Math.log(x.RH) + (17.625 * T) / (243.04 + T), td = (243.04 * g) / (17.625 - g); return { td: td + 273.15, spread: T - td }; },
    { src: 'https://doi.org/10.1175/1520-0450(1996)035%3C0601:IMFAOS%3E2.0.CO;2' }),
  make('day-of-week', 'Day of the week for a date', 'Everyday', 'the weekday, the day of the year and the ISO 8601 week (weeks start on Monday; week 1 holds the year’s first Thursday)', ['d|Date|date||2026-10-28'],
    ['wd|Day of the week|text', 'doy|Day of the year|number', 'iso|ISO week|text', 'left|Days left in the year|number', 'leap|Leap year?|text'],
    (x) => { const iso = isoDay(x.d), t = new Date(iso + 'T00:00:00Z'), y = t.getUTCFullYear(), jan1 = Date.UTC(y, 0, 1), doy = Math.round((t - jan1) / 864e5) + 1, leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const dow = (t.getUTCDay() + 6) % 7, th = new Date(t.getTime() + (3 - dow) * 864e5), wy = th.getUTCFullYear(), week = Math.floor(Math.round((th - Date.UTC(wy, 0, 1)) / 864e5) / 7) + 1;
      return { wd: weekday(iso), doy, iso: wy + '-W' + String(week).padStart(2, '0'), left: (leap ? 366 : 365) - doy, leap: leap ? 'yes' : 'no' }; }),
  make('roman-numerals', 'Roman numeral converter', 'Everyday', 'M 1000, CM 900, D 500, CD 400, C 100, XC 90, L 50, XL 40, X 10, IX 9, V 5, IV 4, I 1, biggest first; 1 to 3999', ['v|A number or a Roman numeral|text||1994'],
    ['out|Converted|text', 'n|As a number|number'],
    (x) => { const t = String(x.v).trim(); if (/^\d+$/.test(t)) { const n = Number(t); return { out: toRoman(n), n }; } const n = fromRoman(t); return { out: String(n), n }; }),
  make('url-encode', 'URL encode and decode', 'Everyday', 'percent-encoding (RFC 3986): each byte of the UTF-8 text outside the unreserved set A–Z a–z 0–9 - _ . ~ becomes %XX',
    ['s|Text|text||a b&c=d/é', { k: 'how', label: 'Do', kind: 'choice', opts: [['part', 'encode a part (a query value or path piece)'], ['url', 'encode a whole address (keeps : / ? & = #)'], ['dec', 'decode']], v: 'part' }],
    ['out|Result|text', 'len|Length|number|characters'],
    (x) => { const s = String(x.s ?? ''); let out; if (x.how === 'dec') { try { out = decodeURIComponent(s.replace(/\+/g, ' ')); } catch { need(false, 'that has a % not followed by two hex digits of valid UTF-8'); } }
      else out = x.how === 'url' ? encodeURI(s) : encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()); return { out, len: out.length }; },
    { src: 'https://www.rfc-editor.org/rfc/rfc3986#section-2.1' }),
  // "unix timestamp 1700000000", "epoch converter", "2026-10-30 14:05 to unix time" (2026-10-30: these fell to an article). UTC only, so a
  // shared link shows every reader the same answer; 12 to 14 digits read as milliseconds and 15 or more as microseconds, as epochconverter.com does
  make('unix-time', 'Unix time (epoch) converter', 'Everyday', 'Unix time = seconds since 1970-01-01 00:00:00 UTC, leap seconds not counted',
    ['v|Unix time, or a date and time in UTC|text||1700000000'],
    ['utc|Date and time (UTC)|text', 'iso|ISO 8601|text', 's|Unix time (seconds)|text', 'ms|Unix time (milliseconds)|text', 'as|Read as|text'],
    (x) => { const t = String(x.v ?? '').trim().replace(/,/g, ''); let ms, as;
      if (/^-?\d+(?:\.\d+)?$/.test(t)) { const n = Number(t), d = t.replace(/^-/, '').split('.')[0].length; [ms, as] = d >= 15 ? [n / 1000, 'microseconds'] : d >= 12 ? [n, 'milliseconds'] : [n * 1000, 'seconds']; }
      else { const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(?:z|utc|gmt)?$/i);
        need(m, 'type a Unix time like 1700000000, or a date like 2026-10-30 14:05 (UTC)'); const [Y, M, D, h = 0, mi = 0, se = 0] = m.slice(1).map((v) => (v === undefined ? 0 : Number(v)));
        need(h < 24 && mi < 60 && se < 60, 'the time is past 23:59:59'); ms = Date.UTC(Y, M - 1, D, h, mi, se); need(new Date(ms).getUTCDate() === D && new Date(ms).getUTCMonth() === M - 1, 'that day is not on the calendar'); as = 'a date in UTC'; }
      need(Number.isFinite(ms) && Math.abs(ms) <= 8.64e15, 'that is past the dates a computer clock can show (about 275,000 years either way)');
      const d = new Date(ms), WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const p2 = (n) => String(n).padStart(2, '0');
      return { utc: WD[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MO[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()),
        iso: d.toISOString(), s: String(Math.floor(ms / 1000)), ms: String(Math.round(ms)), as }; },
    { src: 'https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap04.html#tag_04_19' }),
  make('download-time', 'Download time (bandwidth)', 'Everyday', 'time = size × 8 bits ÷ (speed × (1 − overhead)); KB, MB, GB are powers of 1,000 and KiB, MiB, GiB powers of 1,024 (IEC 80000-13)',
    ['size|File size|number||1', SIZE, 'rate|Connection speed|number||100', RATE, 'ovh|Lost to protocol overhead|ratio|%|0'], ['t|Time|time|s', 'text|That is|text', 'per|Data an hour|number|GB'],
    (x) => { pos(x.size, 'File size'); pos(x.rate, 'Connection speed'); need(x.ovh >= 0 && x.ovh < 1, 'overhead is from 0% to under 100%'); const bits = x.size * Number(x.su) * 8, bps = x.rate * Number(x.ru) * (1 - x.ovh), t = bits / bps;
      return { t, text: dlText(t), per: (bps * 3600) / 8 / 1e9 }; }),
  make('sleep-cycles', 'Sleep time by 90-minute cycles', 'Health', 'bedtime = wake time − time to fall asleep − n × 90 min (or wake time = bedtime + time to fall asleep + n × 90 min), for 3 to 6 cycles',
    [{ k: 'mode', label: 'I know', kind: 'choice', opts: [['wake', 'when I need to wake up'], ['bed', 'when I am going to bed']], v: 'wake' }, 't|Time|text||7:00 am', 'fall|Time to fall asleep|time|min|15'],
    ['six|6 cycles (9 h)|text', 'five|5 cycles (7 h 30 min)|text', 'four|4 cycles (6 h)|text', 'three|3 cycles (4 h 30 min)|text'],
    (x) => { const t = clockOf(x.t, 'Time'), f = x.fall / 60; need(f >= 0 && f <= 180, 'time to fall asleep is 0 to 180 minutes'); const at = (n) => clock12(x.mode === 'bed' ? t + f + n * 90 : t - f - n * 90);
      return { six: at(6), five: at(5), four: at(4), three: at(3) }; }, { src: 'https://www.sleepfoundation.org/how-sleep-works/stages-of-sleep' }),
  make('gdp', 'GDP by expenditure', 'Money', 'GDP = C + I + G + (X − M); real GDP = nominal GDP ÷ deflator × 100', ['C|Consumer spending (C)|money|$|15000', 'I|Investment (I)|money|$|4000', 'G|Government spending (G)|money|$|4500', 'X|Exports (X)|money|$|2500', 'M|Imports (M)|money|$|3200', 'def|GDP deflator (base year 100)|number||100'],
    ['gdp|GDP (nominal)|money|$', 'nx|Net exports (X − M)|money|$', 'real|Real GDP|money|$', 'cshare|Consumer spending share|ratio|%'],
    (x) => { pos(x.def, 'The deflator'); const gdp = x.C + x.I + x.G + x.X - x.M; return { gdp, nx: x.X - x.M, real: (gdp / x.def) * 100, cshare: gdp ? x.C / gdp : null }; }, { src: 'https://www.bea.gov/resources/methodologies/nipa-handbook' }),
  make('horsepower', 'Horsepower from torque and rpm', 'Engineering', 'P = τω = τ × 2π × rpm ÷ 60; in pound-feet, hp = lb·ft × rpm ÷ 5252', ['tq|Torque|torque|lbf·ft|300', 'rpm|Engine speed|number|rpm|5252'],
    ['p|Power|power|hp', 'kw|Power|power|kW'], (x) => { need(x.rpm >= 0, 'rpm cannot be negative'); const p = (x.tq * 2 * PI * x.rpm) / 60; return { p, kw: p }; }),
  make('engine-horsepower', 'Engine horsepower from a quarter-mile run', 'Auto', 'rules of thumb: hp = weight (lb) ÷ (ET ÷ 5.825)³ from elapsed time; hp = weight (lb) × (trap speed in mph ÷ 234)³ from trap speed',
    ['w|Weight with the driver|mass|lb|3000', 'et|Quarter-mile time (ET)|time|s|12', 'v|Trap speed|speed|mph|115'], ['byet|From the time|power|hp', 'bytrap|From the trap speed|power|hp', 'note|Note|text'],
    (x) => { pos(x.w, 'Weight'); const lb = x.w / 0.45359237, HP = 745.6998715822702; const byet = x.et > 0 ? (lb / (x.et / 5.825) ** 3) * HP : null, bytrap = x.v > 0 ? lb * (x.v / 0.44704 / 234) ** 3 * HP : null;
      need(byet !== null || bytrap !== null, 'give the time, the trap speed or both'); return { byet, bytrap, note: 'an estimate of power at the wheels, from the run alone; traction and gearing move it' }; }),
  make('golf-differential', 'Golf score differential', 'Sports', 'differential = 113 ÷ slope rating × (adjusted gross score − course rating − playing conditions adjustment), to one decimal; course handicap = index × slope ÷ 113 + (course rating − par)',
    ['score|Adjusted gross score|number||90', 'rating|Course rating|number||72.0', 'slope|Slope rating|number||130', 'pcc|Playing conditions adjustment|number||0', 'index|Handicap index (for the course handicap)|number||15', 'par|Par|number||72'],
    ['diff|Score differential|number', 'ch|Course handicap|number'],
    (x) => { need(x.slope >= 55 && x.slope <= 155, 'slope ratings run from 55 to 155'); return { diff: Math.round(((113 / x.slope) * (x.score - x.rating - x.pcc)) * 10) / 10, ch: Math.round((x.index * x.slope) / 113 + (x.rating - x.par)) }; },
    { src: 'https://www.randa.org/en/rog/the-rules-of-handicapping' }),
  make('handicap-index', 'Golf handicap index', 'Sports', 'the average of the lowest differentials among the most recent 20 (the lowest 8 of 20; fewer scores use fewer, with −2.0 for 3 scores, −1.0 for 4 and 6), to one decimal, at most 54.0',
    ['d|Score differentials, oldest first|list:number||15.6, 12.1, 18.4, 14.0, 16.2, 13.5, 19.0, 11.8, 17.3, 14.9, 15.5, 12.9, 20.1, 16.8, 13.2, 14.4, 18.0, 15.1, 12.5, 16.0'],
    ['index|Handicap index|number', 'used|Differentials averaged|text'],
    (x) => { const h = handicapIndex(x.d); return { index: h.index, used: 'lowest ' + h.used + ' of ' + h.of + (h.adj ? ', then ' + fmt(h.adj) : '') }; }, { src: 'https://www.randa.org/en/rog/the-rules-of-handicapping' }),
  make('time-card', 'Weekly time card and overtime', 'Money', 'regular = min(hours, 40); overtime = hours over 40 at 1.5 × pay (US federal rule for non-exempt workers); pay = regular × rate + overtime × rate × multiplier',
    ['h|Hours each day|list:number||8, 9, 10, 8, 9', 'rate|Hourly pay|money|$|20', 'at|Overtime after (hours a week)|number|h|40', 'mult|Overtime multiplier|number|×|1.5'],
    ['total|Hours|number|h', 'reg|Regular hours|number|h', 'ot|Overtime hours|number|h', 'pay|Gross pay|money|$'],
    (x) => { need(x.h.length && x.h.every((v) => v >= 0 && v <= 24), 'each day is 0 to 24 hours'); need(x.at >= 0 && x.mult >= 1, 'check the overtime rule'); const total = sum(x.h), reg = Math.min(total, x.at), ot = total - reg;
      return { total, reg, ot, pay: reg * x.rate + ot * x.rate * x.mult }; }, { src: 'https://www.dol.gov/agencies/whd/overtime' }),
  make('dice-roller', 'Dice roller', 'Everyday', 'each die lands 1 to sides, each as likely (crypto.getRandomValues); expected total = dice × (sides + 1) ÷ 2 + modifier', ['n|Dice|number||2', 'sides|Sides on each|number||6', 'k|Add to the total|number||0'],
    ['total|Total|number', 'rolls|Each die|text', 'lo|Lowest total possible|number', 'hi|Highest total possible|number', 'avg|Average total|number'],
    (x) => { need(Number.isInteger(x.n) && x.n >= 1 && x.n <= 1000, 'roll 1 to 1000 dice'); need(Number.isInteger(x.sides) && x.sides >= 2 && x.sides <= 1e6, 'a die has 2 or more whole sides'); const r = Array.from({ length: x.n }, () => 1 + Math.floor(RNG.next() * x.sides));
      return { total: sum(r) + x.k, rolls: r.join(', '), lo: x.n + x.k, hi: x.n * x.sides + x.k, avg: (x.n * (x.sides + 1)) / 2 + x.k }; }, { random: true }),
  make('room-ac-btu', 'Air conditioner size for a room (BTU)', 'Construction', 'ENERGY STAR room sizing table (100–150 ft² → 5,000 BTU/h … 2,000–2,500 ft² → 34,000), then −10% for a heavily shaded room, +10% for a very sunny one, +600 BTU/h for each person past two, +4,000 BTU/h in a kitchen',
    ['a|Room floor area|area|ft²|400', { k: 'sun', label: 'Sun', kind: 'choice', opts: [['0', 'ordinary'], ['-0.1', 'heavily shaded'], ['0.1', 'very sunny']], v: '0' }, 'people|People who usually use the room|number||2', { k: 'kit', label: 'Kitchen?', kind: 'choice', opts: [['0', 'no'], ['1', 'yes']], v: '0' }],
    ['btu|Cooling capacity|number|BTU/h', 'w|Cooling capacity|power|kW', 'band|Table row|text'],
    (x) => { const ft = x.a / 0.09290304; need(ft >= 100 && ft <= 2500, 'the ENERGY STAR table covers 100 to 2,500 ft²'); need(Number.isInteger(x.people) && x.people >= 0, 'people is a whole number');
      const T = [[150, 5000], [250, 6000], [300, 7000], [350, 8000], [400, 9000], [450, 10000], [550, 12000], [700, 14000], [1000, 18000], [1200, 21000], [1400, 23000], [1500, 24000], [2000, 30000], [2500, 34000]];
      const i = T.findIndex(([hi]) => ft <= hi), base = T[i][1], lo = i ? T[i - 1][0] : 100; const btu = Math.round(base * (1 + Number(x.sun)) + Math.max(0, x.people - 2) * 600 + (x.kit === '1' ? 4000 : 0));
      return { btu, w: btu * 0.29307107017, band: lo + ' to ' + T[i][0] + ' ft²: ' + base.toLocaleString('en-US') + ' BTU/h' }; }, { src: 'https://www.energystar.gov/products/room_air_conditioners' }),
  make('adult-height', 'Child’s adult height from the parents’ heights', 'Health', 'mid-parental height: boys (father + mother + 13 cm) ÷ 2, girls (father + mother − 13 cm) ÷ 2; about 95% land within ±8.5 cm (Tanner)',
    [{ k: 'sex', label: 'Child', kind: 'choice', opts: [['b', 'boy'], ['g', 'girl']], v: 'b' }, 'f|Father’s height|length|cm|180', 'm|Mother’s height|length|cm|165'], ['h|Expected adult height|length|cm', 'lo|Low end|length|cm', 'hi|High end|length|cm'],
    (x) => { pos(x.f, 'Father’s height'); pos(x.m, 'Mother’s height'); const h = (x.f + x.m + (x.sex === 'g' ? -0.13 : 0.13)) / 2; return { h, lo: h - 0.085, hi: h + 0.085 }; }, { src: 'https://doi.org/10.1136/adc.45.244.755' }),
);

export const FORMULA_COUNT = { before: CALCULATORS.length };
{
  const have = new Set(CALCULATORS.map((c) => c.id));
  for (const defs of FORMULA_BATCHES) for (const c of compileAll(defs)) { if (have.has(c.id)) throw new Error('formula ' + c.id + ' repeats a calculator id'); have.add(c.id); CALCULATORS.push(c); }
  FORMULA_COUNT.formulas = CALCULATORS.length - FORMULA_COUNT.before;
}
export const BY_ID = new Map(CALCULATORS.map((c) => [c.id, c]));
const SOLVED = new Map();
/** a formula-library calculator worked for another of its variables (the same calculator when it has no such variable). Pure. */
export function solvedFor(calc, target) {
  if (!calc || !calc.def || !target || target === calc.target || !calc.def.solve.includes(target)) return calc;
  const key = calc.id + '\u0000' + target;
  if (!SOLVED.has(key)) SOLVED.set(key, compile(calc.def, target));
  return SOLVED.get(key);
}
const SUPN = (s) => String(s).replace(/[-0-9]/g, (c) => ({ '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' })[c]);
/** a number for people: sig significant figures, thousands grouped, a true minus, × 10ⁿ when very big or very small; '—' for no number. Pure. */
export function fmt(v, sig = 6) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v), neg = v < 0 ? '−' : '';
  if (a >= 1e15 || a < 1e-6) { const [m, e] = a.toExponential(sig - 1).split('e'); return neg + m.replace(/\.?0+$/, '') + ' × 10' + SUPN(Number(e)); }
  let s = Number(a.toPrecision(sig)).toString();
  if (/e/.test(s)) s = Number(s).toFixed(20).replace(/\.?0+$/, '');
  const [i, d] = s.split('.');
  return neg + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
}
/** money to the cent ($1,234.57), or with more figures in pro mode. Pure. */
export function fmtMoney(v, pro = false) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  if (pro) return (v < 0 ? '−$' : '$') + fmt(Math.abs(v), 12);
  const s = Math.abs(v).toFixed(2), [i, d] = s.split('.');
  return (v < 0 && Number(s) !== 0 ? '−$' : '$') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + d;
}
/** a number as people type it: 1,234.5, −3, 1/2, 2 3/4, 1.5e3, 6.02×10^23. NaN if it is not one. Pure. */
export function readNumber(s) {
  if (typeof s === 'number') return s;
  let t = String(s ?? '').trim().replace(/[−–]/g, '-').replace(/,(?=\d{3}(\D|$))/g, '').replace(/\s*[×x*]\s*10\s*\^\s*/i, 'e');
  if (t === '') return NaN;
  let m = /^([-+]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3]) / Number(m[4]));
  m = /^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*\/\s*(\d*\.?\d+(?:e[-+]?\d+)?)$/i.exec(t);
  if (m) return Number(m[1]) / Number(m[2]);
  return /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(t) ? Number(t) : NaN;
}
/** '2 in' -> { num: '2', unit: 'in' }; '$45' -> { num: '45', unit: '$' }; '17%' -> { num: '17', unit: '%' }. Pure. */
export function splitUnit(s) {
  const t = String(s ?? '').trim();
  if (/^\$/.test(t)) return { num: t.slice(1).trim(), unit: '$' };
  const m = /^([-+−]?[\d.,]*\d(?:\s+\d+\s*\/\s*\d+|\s*\/\s*\d+)?(?:[eE][-+]?\d+)?(?:\s*[×x]\s*10\s*\^\s*[-+]?\d+)?)\s*(.*)$/.exec(t);
  return m ? { num: m[1], unit: m[2].trim() } : { num: t, unit: '' };
}
const QUANTITY = (kind) => !!KINDS[kind];
/** one input read: its SI value (or text, or list of SI values), the unit used, or an error. */
function readInput(inp, raw, unitId) {
  if (inp.kind === 'text' || inp.kind === 'date') return { value: String(raw ?? '').trim() };
  if (inp.kind === 'choice') { const ok = inp.opts.some(([v]) => v === String(raw)); return { value: ok ? String(raw) : inp.v }; }
  const kind = inp.kind === 'list' ? inp.of : inp.kind, base = unitOf(kind, unitId) || unitOf(kind, inp.unit) || KINDS[kind].units[0];
  const one = (txt) => {
    const { num, unit } = splitUnit(txt); let u = base;
    if (unit) { const f = findUnit(unit, kind); if (!f) throw new Error('"' + unit + '" is not a unit of ' + KINDS[kind].name.toLowerCase()); u = f.unit; }
    const n = readNumber(num); if (!Number.isFinite(n)) throw new Error('"' + String(txt).trim() + '" is not a number');
    return { si: toSI(n, u), unit: u };
  };
  if (inp.kind === 'list') { const parts = String(raw ?? '').split(/[;,\s]+(?![^\d\s]*\d*\/)/).map((x) => x.trim()).filter(Boolean); return { value: parts.map((p) => one(p).si), unit: base.id }; }
  const r = one(raw); return { value: r.si, unit: r.unit.id };
}
/** the unit converter shaped for one kind */
function converter(kind, given, outUnits) {
  const k = KINDS[kind] ? kind : 'length', units = KINDS[k].units, from = unitOf(k, given['v.u']) ? given['v.u'] : units[k === 'length' ? 7 : 0].id;
  const to = unitOf(k, outUnits.r) ? outUnits.r : (units.find((x) => x.id !== from) || units[0]).id;
  const base = BY_ID.get('convert');
  return { ...base, name: KINDS[k].name + ' converter', kind: k, inputs: [{ k: 'v', label: 'Value', kind: k, unit: from, v: base.inputs[0].v }], outputs: [{ k: 'r', label: 'In', kind: k, unit: to }] };
}
/**
 * one calculator worked out. given: { key: value, 'key.u': unit id } (values may carry their own unit: '2 in'); outUnits: { key: unit id };
 * opts: { pro, kind }. Returns { calc, inputs: [{ ...input, raw, unit, value }], outputs: [{ ...output, unit, si, value, text }], error }. Pure.
 */
export function run(calcOrId, given = {}, outUnits = {}, opts = {}) {
  let calc = typeof calcOrId === 'string' ? BY_ID.get(calcOrId) : calcOrId;
  if (!calc) return { calc: null, inputs: [], outputs: [], error: 'no calculator called "' + calcOrId + '"' };
  if (calc.convert) calc = converter(opts.kind || given.kind || 'length', given, outUnits);
  if (calc.def) calc = solvedFor(calc, opts.solve || given.solve);
  const sig = opts.pro ? 12 : 6, x = {}, inputs = [];
  let error = '';
  for (const inp of calc.inputs) {
    const raw = given[inp.k] !== undefined && given[inp.k] !== null ? given[inp.k] : inp.v;
    try { const r = readInput(inp, raw, given[inp.k + '.u']); x[inp.k] = r.value; inputs.push({ ...inp, raw: String(raw), unit: r.unit ?? inp.unit, value: r.value }); }
    catch (e) { error = error || inp.label + ': ' + e.message; inputs.push({ ...inp, raw: String(raw), unit: inp.unit, value: NaN }); }
  }
  let res = {};
  if (!error) { try { res = calc.f(x) || {}; } catch (e) { error = String(e.message || e); } }
  const outputs = calc.outputs.map((o) => {
    const si = res[o.k];
    if (error) return { ...o, si: NaN, value: NaN, text: '—' };
    if (o.kind === 'text') return { ...o, si, value: si, text: String(si ?? '—') };
    if (typeof si !== 'number' || !Number.isFinite(si)) return { ...o, si, value: NaN, text: '—' };
    if (o.kind === 'number') return { ...o, si, value: si, text: fmt(si, sig) + (o.sfx ? ' ' + o.sfx : '') };
    if (o.kind === 'money') return { ...o, si, value: si, text: fmtMoney(si, opts.pro) };
    const u = unitOf(o.kind, outUnits[o.k]) || unitOf(o.kind, o.unit) || KINDS[o.kind].units[0], value = fromSI(si, u);
    return { ...o, unit: u.id, si, value, text: fmt(value, sig) + (u.id ? (/^[%‰°]$/.test(u.id) ? '' : ' ') + u.id : '') };
  });
  return { calc, inputs, outputs, error, table: error ? null : res.table || null };
}
/** one SI value in every unit of its kind: [{ unit, name, value, text }]. Pure. */
export function allUnits(kind, si, sig = 6) {
  if (!QUANTITY(kind) || !Number.isFinite(si)) return [];
  return KINDS[kind].units.map((u) => { const value = fromSI(si, u); return { unit: u.id, name: u.name, value, text: fmt(value, sig) + (u.id ? (/^[%‰°]$/.test(u.id) ? '' : ' ') + u.id : '') }; });
}

// --- links: ?calc=pipe-surface-area&d=2&d.u=in&l=10&l.u=ft (an output's unit is out.k.u); &kind= for the converter, &formula= for a
// custom formula, &find= for a search, &pro=1 for pro mode
export const RESERVED = ['calc', 'formula', 'find', 'pro', 'kind', 'solve'];
/** a query string read into { calc, given, outUnits, kind, formula, find, pro }. Pure. */
export function readQuery(search) {
  const q = new URLSearchParams(String(search ?? '').replace(/^\?/, '')), given = {}, outUnits = {};
  for (const [k, v] of q) {
    if (RESERVED.includes(k)) continue;
    if (k.startsWith('out.') && k.endsWith('.u')) outUnits[k.slice(4, -2)] = v;
    else given[k] = v;
  }
  const calc = q.get('calc') || '';
  // an output unit given as k.u where k is an output and not an input of that calculator
  const c = solvedFor(BY_ID.get(calc), q.get('solve'));
  if (c) for (const o of c.outputs) if (!c.inputs.some((i) => i.k === o.k) && given[o.k + '.u'] !== undefined && outUnits[o.k] === undefined) { outUnits[o.k] = given[o.k + '.u']; delete given[o.k + '.u']; }
  return { calc, given, outUnits, kind: q.get('kind') || '', formula: q.get('formula') || '', find: q.get('find') || '', pro: q.get('pro') === '1', solve: q.get('solve') || '' };
}
const keep = (s) => encodeURIComponent(s).replace(/%(C2%B2|C2%B3|C2%B5|C2%B0|CE%A9|2F|C2%B7|24|25)/g, (m) => decodeURIComponent(m));
/** { calc, given, outUnits, kind, formula, find, pro } written as a query string (readable: ft², µF, °C and $/kWh stay as they are). Pure. */
export function writeQuery(state = {}) {
  const parts = [], put = (k, v) => parts.push(keep(k) + '=' + keep(String(v)));
  if (state.calc) put('calc', state.calc);
  if (state.kind) put('kind', state.kind);
  const c = solvedFor(BY_ID.get(state.calc), state.solve);
  if (c && c.def && state.solve && c.target === state.solve && state.solve !== c.def.lhs) put('solve', state.solve);
  for (const [k, v] of Object.entries(state.given || {})) if (v !== undefined && v !== '' && !RESERVED.includes(k)) put(k, v);
  for (const [k, v] of Object.entries(state.outUnits || {})) if (v !== undefined) put(c && !c.inputs.some((i) => i.k === k) ? k + '.u' : 'out.' + k + '.u', v);
  if (state.formula) put('formula', state.formula);
  if (state.find) put('find', state.find);
  if (state.pro) put('pro', '1');
  return parts.length ? '?' + parts.join('&') : '';
}
const fold = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
/** the calculators a search matches, best first: every word in the name, category, formula, labels or units. Pure. */
export function search(q, list = CALCULATORS) {
  const words = fold(q).split(/[^a-z0-9²³µ°Ω$%]+/).filter(Boolean);
  if (!words.length) return list.slice();
  const scored = [];
  for (const c of list) {
    const name = fold(c.name + ' ' + c.id.replace(/-/g, ' ')), hay = fold([c.name, c.id, c.cat, c.formula, ...c.inputs.map((i) => i.label + ' ' + (i.kind || '')), ...c.outputs.map((o) => o.label + ' ' + o.kind)].join(' '));
    if (!words.every((w) => hay.includes(w))) continue;
    scored.push([c, words.reduce((s, w) => s + (name.includes(w) ? 3 : 1), 0) + (c.everyday ? 0.5 : 0)]);
  }
  return scored.sort((a, b) => b[1] - a[1]).map(([c]) => c);
}
const csvCell = (s) => (/[",\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));
/** a worked result as CSV: one row an input or output (section, name, value, unit, SI value). Pure. */
export function toCSV(r) {
  const rows = [['section', 'name', 'value', 'unit', 'si value']];
  for (const i of r.inputs) rows.push(['input', i.label, i.kind === 'list' ? i.raw : i.kind === 'text' || i.kind === 'date' || i.kind === 'choice' ? i.value : Number.isFinite(i.value) ? readNumber(splitUnit(i.raw).num) : i.raw, i.unit || '', Array.isArray(i.value) ? i.value.join(' ') : i.value]);
  for (const o of r.outputs) rows.push(['output', o.label, o.kind === 'text' ? o.text : o.value, o.kind === 'number' ? o.sfx || '' : o.kind === 'money' ? '$' : o.unit || '', o.si]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}
/** a worked result as JSON. Pure. */
export function toJSON(r) {
  return JSON.stringify({ calculator: r.calc && r.calc.id, name: r.calc && r.calc.name, formula: r.calc && r.calc.formula, ...(r.calc && r.calc.src ? { source: r.calc.src } : {}), error: r.error || null,
    inputs: r.inputs.map((i) => ({ key: i.k, label: i.label, raw: i.raw, unit: i.unit || null, si: i.value })),
    outputs: r.outputs.map((o) => ({ key: o.k, label: o.label, value: o.value, unit: o.kind === 'money' ? '$' : o.unit || o.sfx || null, text: o.text, si: o.si })) }, null, 2);
}
