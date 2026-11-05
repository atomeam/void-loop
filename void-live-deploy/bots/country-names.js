// Country-name matching for the country-facts bots, from the built-in list in skills/country.js (UN members and the names
// people use). The list is the second road: Wikidata's live row has to name that capital. Nothing here is fetched.
import { CAPITALS, CURRENCIES } from '../skills/country.js';

const NOUN = /renminbi|yuan|sterling|dollar|euro|pound|yen|franc|rupee|won|peso|real|rand|krona|krone|kronor|forint|zloty|zoty|lira|shekel|baht|ringgit|koruna|leu|lev|dinar|dirham|riyal|boliviano|shilling|birr|naira|cedi|taka|rupiah/;
const ALIAS = { renminbi: 'yuan', yuan: 'yuan', sterling: 'pound', pound: 'pound' };
const PREFIXES = ['plurinational state of ', 'democratic peoples republic of ', 'democratic republic of the ', 'democratic republic of ', 'peoples republic of ', 'federal republic of ', 'united republic of ', 'republic of the ', 'republic of ', 'kingdom of the ', 'kingdom of ', 'state of ', 'commonwealth of the ', 'commonwealth of ', 'the '];

/** letters only, lower case, accents off */
export function flatPlace(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z]/g, '');
}
/** two place names for the same city (Washington and Washington, D.C.; South Tarawa and Tarawa; Yaren District and Yaren) */
export function samePlace(a, b) {
  const x = flatPlace(a), y = flatPlace(b);
  if (!x || !y) return false;
  if (x === y || (y.length >= 6 && x.startsWith(y)) || (x.length >= 6 && y.startsWith(x))) return true;
  const bare = (s) => s.replace(/^(north|south|east|west|greater|new|old)/, '').replace(/(district|city|municipality|town)$/, '');
  const p = bare(x), q = bare(y);
  return p.length >= 5 && q.length >= 5 && (p === q || p === y || q === x);
}
/** the currency noun, so "US dollar" and "United States dollar" meet, and "euro" does not meet "CFP franc" */
export function moneyNoun(s) {
  const m = flatPlace(s).match(NOUN);
  return m ? (ALIAS[m[0]] || m[0]) : flatPlace(s);
}
export function sameMoney(a, b) {
  const x = moneyNoun(a), y = moneyNoun(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}
/** keys to try against CAPITALS / CURRENCIES, longest form first, then the name with a title prefix taken off */
export function nameKeys(name) {
  const base = String(name || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/['’.]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const keys = [];
  if (/democratic/.test(base) && /korea/.test(base)) keys.push('north korea');
  if (base === 'republic of korea' || base === 'korea republic') keys.push('south korea');
  keys.push(base);
  for (const p of PREFIXES) if (base.startsWith(p)) keys.push(base.slice(p.length).trim());
  return [...new Set(keys.filter(Boolean))];
}
/** the built-in capital for a Wikidata country name, or null when the list has no such country */
export function capitalFor(name) {
  for (const k of nameKeys(name)) if (CAPITALS[k]) return { key: k, capital: CAPITALS[k] };
  return null;
}
/** the built-in currency name, or null */
export function currencyFor(name) {
  for (const k of nameKeys(name)) if (CURRENCIES[k]) return { key: k, currency: CURRENCIES[k] };
  return null;
}
/** Wikidata's currencies, narrowed to the built-in one when Wikidata lists it among others (France: euro, not the CFP franc) */
export function shownCurrencies(name, list) {
  const known = currencyFor(name);
  const all = [...new Set(list || [])].sort((a, b) => a.localeCompare(b));
  if (!known) return all;
  const hit = all.filter((c) => sameMoney(c, known.currency));
  return hit.length ? hit : all;
}
