/**
 * calculators: the formula library behind /calculators/ (the tower's vcalc.com floor). Each calculator is its inputs (each a quantity of a
 * kind, typed in any unit of that kind), its outputs (each shown in any unit of its kind) and one function on SI values, so a pipe's diameter
 * in inches and its length in feet give its surface area in square feet, square metres or acres alike. Everyday ones first (percent, tip,
 * loan, unit price, BMI, dates), then money, health, geometry, maths, statistics, physics, chemistry, electrical and engineering. run() works
 * one out, fmt() writes a number for people, and the query helpers make every answer a link. Pure. Tests: tools/calculators.test.mjs.
 */
import { KINDS, unitOf, findUnit, toSI, fromSI } from './calc-units.js';
import { payment } from './fincalc.js';
import { daysBetween, addDays, businessDaysBetween, ageParts, isDay, DAY_NAMES } from './date-math.js';

export const CATEGORIES = ['Everyday', 'Money', 'Health', 'Conversions', 'Geometry', 'Maths', 'Statistics', 'Physics', 'Chemistry', 'Electrical', 'Engineering'];
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
export const BY_ID = new Map(CALCULATORS.map((c) => [c.id, c]));
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
  return { calc, inputs, outputs, error };
}
/** one SI value in every unit of its kind: [{ unit, name, value, text }]. Pure. */
export function allUnits(kind, si, sig = 6) {
  if (!QUANTITY(kind) || !Number.isFinite(si)) return [];
  return KINDS[kind].units.map((u) => { const value = fromSI(si, u); return { unit: u.id, name: u.name, value, text: fmt(value, sig) + (u.id ? (/^[%‰°]$/.test(u.id) ? '' : ' ') + u.id : '') }; });
}

// --- links: ?calc=pipe-surface-area&d=2&d.u=in&l=10&l.u=ft (an output's unit is out.k.u); &kind= for the converter, &formula= for a
// custom formula, &find= for a search, &pro=1 for pro mode
export const RESERVED = ['calc', 'formula', 'find', 'pro', 'kind'];
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
  const c = BY_ID.get(calc);
  if (c) for (const o of c.outputs) if (!c.inputs.some((i) => i.k === o.k) && given[o.k + '.u'] !== undefined && outUnits[o.k] === undefined) { outUnits[o.k] = given[o.k + '.u']; delete given[o.k + '.u']; }
  return { calc, given, outUnits, kind: q.get('kind') || '', formula: q.get('formula') || '', find: q.get('find') || '', pro: q.get('pro') === '1' };
}
const keep = (s) => encodeURIComponent(s).replace(/%(C2%B2|C2%B3|C2%B5|C2%B0|CE%A9|2F|C2%B7|24|25)/g, (m) => decodeURIComponent(m));
/** { calc, given, outUnits, kind, formula, find, pro } written as a query string (readable: ft², µF, °C and $/kWh stay as they are). Pure. */
export function writeQuery(state = {}) {
  const parts = [], put = (k, v) => parts.push(keep(k) + '=' + keep(String(v)));
  if (state.calc) put('calc', state.calc);
  if (state.kind) put('kind', state.kind);
  const c = BY_ID.get(state.calc);
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
  return JSON.stringify({ calculator: r.calc && r.calc.id, name: r.calc && r.calc.name, formula: r.calc && r.calc.formula, error: r.error || null,
    inputs: r.inputs.map((i) => ({ key: i.k, label: i.label, raw: i.raw, unit: i.unit || null, si: i.value })),
    outputs: r.outputs.map((o) => ({ key: o.k, label: o.label, value: o.value, unit: o.kind === 'money' ? '$' : o.unit || o.sfx || null, text: o.text, si: o.si })) }, null, 2);
}
