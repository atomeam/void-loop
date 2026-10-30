// A quantity named in an ask, converted exactly (asked by the coordinator, 2026-10-30: "the 3 mile run" was answered from the 5000 metres page
// with "the exact distance of three miles can vary depending on the surface"; a 3 mile run is 4.83 km). The answer engine gives the model the
// conversion as a computed fact and leads the answer with it when the model leaves it out, so a stated distance, weight or volume is never
// answered from a neighbouring page alone. The factors are the unit calculator's (lib/calc-units.js). Pure.
import { KINDS } from './calc-units.js';

// each word an ask may use for a unit -> [kind, the calculator's unit id, the unit it is converted to]; a one-letter unit (m, g, l) is left
// out on purpose: "5 m c" or "5 g" is not a measure the ask states clearly
const WORDS = [
  ['mph|miles (?:per|an) hour', 'speed', 'mph', 'km/h'], ['km/?h|kph|kilomet(?:er|re)s (?:per|an) hour', 'speed', 'km/h', 'mph'],
  ['miles?|mi', 'length', 'mi', 'km'], ['kilomet(?:er|re)s?|kms?|k(?=\\s+(?:run|race|walk|swim|ride|row|hike))', 'length', 'km', 'mi'],
  ['met(?:er|re)s?', 'length', 'm', 'ft'], ['feet|foot|ft', 'length', 'ft', 'm'], ['inch(?:es)?', 'length', 'in', 'cm'],
  ['yards?|yds?', 'length', 'yd', 'm'], ['centimet(?:er|re)s?|cm', 'length', 'cm', 'in'],
  ['pounds?|lbs?', 'mass', 'lb', 'kg'], ['kilo(?:gram)?s?|kgs?', 'mass', 'kg', 'lb'], ['ounces?|oz', 'mass', 'oz', 'g'], ['stones?', 'mass', 'st', 'kg'],
  ['(?:us )?gallons?|gal', 'volume', 'gal', 'L'], ['lit(?:er|re)s?', 'volume', 'L', 'gal'], ['cups?', 'volume', 'cup', 'mL'],
];
const NAMES = { mi: ['mile', 'miles'], km: ['km', 'km'], m: ['metre', 'metres'], ft: ['foot', 'feet'], in: ['inch', 'inches'], yd: ['yard', 'yards'], cm: ['cm', 'cm'], lb: ['pound', 'pounds'], kg: ['kg', 'kg'], oz: ['ounce', 'ounces'], st: ['stone', 'stone'], gal: ['US gallon', 'US gallons'], L: ['litre', 'litres'], cup: ['US cup', 'US cups'], mph: ['mph', 'mph'], 'km/h': ['km/h', 'km/h'], g: ['g', 'g'], mL: ['mL', 'mL'] };
const factor = (kind, id) => { const u = (KINDS[kind] && KINDS[kind].units || []).find((x) => x.id === id); return u ? u.f : null; };
const NUM = String.raw`(\d{1,7}(?:[.,]\d{1,4})?|half an?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|fifty|a hundred)`;
const WORDNUM = { 'half a': 0.5, 'half an': 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, twenty: 20, fifty: 50, 'a hundred': 100 };
const RE = new RegExp(String.raw`(?:^|[\s(])` + NUM + String.raw`\s*-?\s*(?:` + WORDS.map((w) => '(' + w[0] + ')').join('|') + String.raw`)(?=$|[\s,.?!)]|-[a-z])`, 'i');

/** "4.83", "4,828", "0.5": a converted value for a sentence, three significant figures, a thousands comma from 1,000 up. Pure. */
export function shown(x) {
  if (!Number.isFinite(x)) return '';
  const r = x >= 100 ? Math.round(x) : Number(x.toPrecision(3));
  return r >= 1000 ? r.toLocaleString('en-US') : String(r);
}

/** the quantity an ask states and its exact conversion: { text: '3 miles', value, from, to, out: '4.83 km', sentence }, or null. Pure. */
export function measureOf(ask) {
  const t = String(ask || '').toLowerCase().replace(/\s+/g, ' ').trim(); if (!t || t.length > 200) return null;
  const m = RE.exec(t); if (!m) return null;
  const row = WORDS[m.slice(2).findIndex((g) => g !== undefined)]; if (!row) return null; // each unit word is its own group
  const value = /^\d/.test(m[1]) ? parseFloat(m[1].replace(/,(\d{3})$/, '$1').replace(',', '.')) : WORDNUM[m[1]]; if (!(value > 0)) return null;
  const [, kind, from, to] = row, ff = factor(kind, from), ft = factor(kind, to); if (!ff || !ft) return null;
  let x = value * ff / ft, unit = to;
  if (to === 'km' && x < 1) { x *= 1000; unit = 'm'; } // 0.5 miles is 805 m, not 0.805 km
  const name = (id, n) => (NAMES[id] || [id, id])[n === 1 ? 0 : 1];
  const out = shown(x) + ' ' + name(unit, x);
  // a distance in miles or km also gets the other metric step, so the answer can say 4.83 km (4,828 m)
  const metres = kind === 'length' && unit === 'km' && x < 100 ? ' (' + shown(value * ff) + ' m)' : '';
  const text = String(value) + ' ' + name(from, value);
  return { text, value, from, to: unit, kind, out, sentence: text + ' is ' + out + metres + '.' };
}

/** the rule the model reads when the ask states a quantity: the computed conversion is a fact, and a stated quantity is fixed. Pure. */
export const measureRule = (m) => m ? 'The question states a quantity. Computed exactly (not from a source): ' + m.sentence + ' Say this conversion in your first sentence. A stated quantity is fixed: never say it varies, is approximate or depends on anything, and never answer it with a different quantity from a source (a 5000 metres race is not a 3 mile run).' : '';

/** the answer led by the conversion when the model left the converted value out; with no answer left, the conversion alone. Pure. */
export function withMeasure(answer, m) {
  const a = String(answer || '').trim();
  if (!m) return a;
  if (!a) return m.sentence; // the sources did not name the quantity, but the computed conversion still answers the ask
  const num = m.out.split(' ')[0];
  return a.includes(num) || a.includes(num.replace(/,/g, '')) ? a : m.sentence + ' ' + a;
}
