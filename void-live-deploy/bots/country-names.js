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
/** "St. John's" and "Saint John's" are one city. "Stanley" does not become "Saint Anley": the abbreviation is St before a space or a capital. */
export function saintKey(s) {
  return flatPlace(String(s || '').replace(/\bSt\.?(?=\s|[A-Z])/g, 'Saint'));
}
/** the place name, without a trailing note such as "(since 2026-01-03; Malabo until 2026-01-03)" */
export function placeHead(s) {
  return String(s || '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
}
/** two place names for the same city (Washington and Washington, D.C.; South Tarawa and Tarawa; Yaren District and Yaren; St. John's and Saint John's) */
export function samePlace(a, b) {
  const x = saintKey(placeHead(a)), y = saintKey(placeHead(b));
  if (!x || !y) return false;
  if (x === y || (y.length >= 6 && x.startsWith(y)) || (x.length >= 6 && y.startsWith(x))) return true;
  const bare = (s) => s.replace(/^(north|south|east|west|greater|new|old)/, '').replace(/(district|city|municipality|town)$/, '');
  const p = bare(x), q = bare(y);
  return p.length >= 5 && q.length >= 5 && (p === q || p === y || q === x);
}
/**
 * The English name of a Wikidata capital. The English label wins. When the item has none (Antigua's St. John's, Q36262,
 * has an English Wikipedia sitelink and no English label), the sitelink title is the name, with a trailing country
 * disambiguation cut off. "Washington, D.C." stays whole: the tail is short and has no space. Pure.
 */
export function placeName(en, wiki) {
  const label = en && !/^Q\d+$/.test(en) ? String(en).trim() : '';
  if (label) return { name: label, via: 'label' };
  const title = String(wiki || '').replace(/_/g, ' ').trim();
  if (title.length < 2) return null;
  const cut = title.indexOf(',');
  if (cut > 1) {
    const rest = title.slice(cut + 1).trim();
    if (rest.length > 8 || /\s/.test(rest)) return { name: title.slice(0, cut).trim(), via: 'enwiki' };
  }
  return { name: title, via: 'enwiki' };
}
/**
 * Truthy capitals, the way wdt:P36 does it (preferred rank when any preferred statement exists, otherwise normal;
 * deprecated never counts), plus a succession note when a current capital's start date is another statement's end
 * date. Names that had to come from the English Wikipedia sitelink are listed in fallback. Pure.
 */
export function settleCapitals(statements) {
  const named = [];
  for (const s of statements || []) {
    const p = placeName(s.en, s.wiki);
    if (!p || p.name.length < 2) continue;
    named.push({ name: p.name, via: p.via, rank: s.rank || 'NormalRank', start: String(s.start || '').slice(0, 10), end: String(s.end || '').slice(0, 10) });
  }
  const score = (r) => (r === 'PreferredRank' ? 2 : r === 'NormalRank' ? 1 : 0);
  const by = new Map();
  for (const s of named) {
    if (s.rank === 'DeprecatedRank') continue;
    const prev = by.get(s.name);
    if (!prev || score(s.rank) > score(prev.rank)) by.set(s.name, s);
  }
  const active = [...by.values()];
  const preferred = active.filter((s) => s.rank === 'PreferredRank');
  const current = preferred.length ? preferred : active.filter((s) => s.rank === 'NormalRank');
  const currentNames = new Set(current.map((s) => s.name));
  const starts = new Set(current.map((s) => s.start).filter(Boolean));
  const ended = [];
  for (const s of named) {
    if (currentNames.has(s.name) || !s.end || !starts.has(s.end)) continue;
    if (!ended.some((e) => e.name === s.name && e.until === s.end)) ended.push({ name: s.name, until: s.end });
  }
  ended.sort((a, b) => a.name.localeCompare(b.name) || a.until.localeCompare(b.until));
  return {
    capitals: [...currentNames].sort((a, b) => a.localeCompare(b)),
    ended,
    fallback: current.filter((s) => s.via === 'enwiki').map((s) => s.name).sort((a, b) => a.localeCompare(b)),
  };
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
