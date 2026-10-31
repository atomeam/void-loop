/**
 * country skill — capital, population, currency, languages and area of a country, from Wikidata (no key; REST Countries, its
 * source until 2026-10, retired its keyless v3.1 API and every ask fell back to the built-in capital: site-test issue #1063)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "capital of Australia", "population of Japan", "what currency does Brazil use", "languages spoken in Switzerland".
 */
import { geo, km, flightTime } from './distance.js';
const FIELDS = { capital: 'capital', population: 'population', currency: 'currencies', currencies: 'currencies', language: 'languages', languages: 'languages', area: 'area', flag: 'flags', size: 'area' };
export function countryOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:what(?:['’]?s| is| are)\s+)?(?:the\s+)?(capital|population|currency|currencies|official\s+languages?|languages?|area|size|flag)(?:\s+city)?\s+of\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m && !NOT_COUNTRY.test(m[2].trim())) return { want: FIELDS[m[1].toLowerCase().replace(/^official\s+/, '')] || 'all', name: m[2].trim() };
  if (m) return null;
  m = t.match(/^(?:what|which)\s+(currency|languages?)\s+(?:does|do|is|are)\s+(?:used\s+in|spoken\s+in)?\s*(?:the\s+)?([A-Za-zÀ-ÿ' .-]{2,40}?)(?:\s+(?:use|speak|have))?$/i);
  // "what language does the word kindergarten come from" asks where a word comes from, not about a country
  if (m && !/\b(?:words?|come|comes|came|from|originate)\b/i.test(m[2]) && !NOT_COUNTRY.test(m[2].trim())) return { want: FIELDS[m[1].toLowerCase()], name: m[2].trim() };
  // "how big is france": only a country Verse knows by name, so "how big is the sun" stays with what knows it
  m = t.match(/^how\s+(?:big|large)\s+is\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{2,40})$/i);
  if (m && CAPITALS[m[1].trim().toLowerCase()]) return { want: 'area', name: m[1].trim() };
  m = t.match(/^how\s+many\s+people\s+live\s+in\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m) return { want: 'population', name: m[1].trim() };
  m = t.match(/^(?:what\s+)?languages?\s+(?:are\s+|is\s+)?spoken\s+in\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m) return { want: 'languages', name: m[1].trim() };
  // more ways to ask, each only for a country Verse knows by name (so "what do they speak in the movie" stays out):
  // "what do they speak in brazil", "what money do they use in japan", "what continent is egypt in", "what countries border germany",
  // "the calling code for france", "what side of the road do they drive on in japan"
  const known = (n) => { const k = String(n || '').trim().toLowerCase().replace(/^the\s+/, ''); return CAPITALS[k] ? k : null; };
  const N = "(?:the\\s+)?([A-Za-zÀ-ÿ' .-]{2,40}?)";
  const more = [
    ['languages', new RegExp('^(?:what|which)\\s+(?:language\\s+)?do\\s+(?:they|people)\\s+speak\\s+in\\s+' + N + '$', 'i')],
    ['currencies', new RegExp('^(?:what|which)\\s+(?:money|currency)\\s+do\\s+(?:they|people|you)\\s+use\\s+in\\s+' + N + '$', 'i')],
    ['continent', new RegExp('^(?:what|which)\\s+continent\\s+is\\s+' + N + '\\s+(?:in|on|part\\s+of)$', 'i')],
    ['continent', new RegExp('^(?:what|which)\\s+continent\\s+(?:is|does)\\s+' + N + '(?:\\s+belong\\s+to)?$', 'i')],
    ['borders', new RegExp('^(?:what|which)\\s+countries\\s+(?:border|are\\s+next\\s+to|share\\s+a\\s+border\\s+with|are\\s+around)\\s+' + N + '$', 'i')],
    ['borders', new RegExp('^(?:the\\s+)?(?:neighbou?ring\\s+countries|neighbou?rs|countries\\s+bordering|borders)\\s+(?:of|to)\\s+' + N + '$', 'i')],
    ['calling', new RegExp('^(?:what(?:\'s|\\s+is)\\s+)?(?:the\\s+)?(?:calling|dialling|dialing|phone|telephone|international|country)\\s+(?:dialing\\s+|calling\\s+)?code\\s+(?:for|of|to\\s+call)\\s+' + N + '$', 'i')],
    ['drives', new RegExp('^(?:what|which)\\s+side\\s+of\\s+the\\s+road\\s+do\\s+(?:they|you|people)\\s+drive\\s+on\\s+in\\s+' + N + '$', 'i')],
    ['drives', new RegExp('^do\\s+(?:they|you|people)\\s+drive\\s+on\\s+the\\s+(?:left|right)(?:\\s+side)?\\s+in\\s+' + N + '$', 'i')],
  ];
  for (const [want, re] of more) { const x = t.match(re); if (x && known(x[1])) return { want, name: x[1].trim().replace(/^the\s+/i, '') }; }
  return null;
}
// names that look like a country ask's place but are not countries ("what currency does bitcoin use" is the crypto skill's)
const NOT_COUNTRY = /^(?:the\s+)?(?:world|earth|bitcoin|ethereum|crypto|eu|euro\s?zone|internet|universe)$/i;
// the card's rows from a REST Countries record (and the names of the countries on its borders). Pure.
// the time zone row (asked by Verse, ask-20261015-0048-2): the offset and how far ahead of or behind the asker it is. Pure.
// zones: REST Countries strings like 'UTC+09:00'; mine: the asker's offset from UTC in minutes (east positive).
export function tzLine(zones, mine) {
  const mins = (z) => { const m = /^UTC(?:([+-−])(\d\d):(\d\d))?$/.exec(String(z).trim()); return m ? (m[1] ? (m[1] === '+' ? 1 : -1) * (+m[2] * 60 + +m[3]) : 0) : null; };
  const Z = (zones || []).map(mins).filter((x) => x !== null);
  if (!Z.length) return '';
  const lo = Math.min(...Z), hi = Math.max(...Z);
  const fmt = (m) => 'UTC' + (m ? (m > 0 ? '+' : '−') + String(Math.floor(Math.abs(m) / 60)).padStart(2, '0') + ':' + String(Math.abs(m) % 60).padStart(2, '0') : '');
  const rel = (d) => { if (!d) return 'same time as you'; const h = Math.abs(d) / 60; return (Number.isInteger(h) ? h : h.toFixed(1)) + ' h ' + (d > 0 ? 'ahead of' : 'behind') + ' you'; };
  if (lo === hi) return fmt(lo) + (typeof mine === 'number' ? ' (' + rel(lo - mine) + ')' : '');
  return fmt(lo) + ' to ' + fmt(hi) + ' (' + Z.length + ' zones)';
}
// Built-in time zones of the capitals (IANA names, from the tz database's zone.tab), so the card shows the time there now even
// when REST Countries does not answer, and with daylight saving (REST Countries gives fixed offsets).
export const CAPITAL_ZONES = {"afghanistan": "Asia/Kabul", "algeria": "Africa/Algiers", "angola": "Africa/Luanda", "antigua and barbuda": "America/Antigua", "argentina": "America/Argentina/Buenos_Aires", "armenia": "Asia/Yerevan", "australia": "Australia/Sydney", "austria": "Europe/Vienna", "azerbaijan": "Asia/Baku", "bahamas": "America/Nassau", "bangladesh": "Asia/Dhaka", "belarus": "Europe/Minsk", "belgium": "Europe/Brussels", "belize": "America/Belize", "benin": "Africa/Porto-Novo", "bhutan": "Asia/Thimphu", "bolivia": "America/La_Paz", "bosnia and herzegovina": "Europe/Sarajevo", "botswana": "Africa/Gaborone", "brazil": "America/Sao_Paulo", "brunei": "Asia/Brunei", "bulgaria": "Europe/Sofia", "burkina faso": "Africa/Ouagadougou", "burundi": "Africa/Bujumbura", "cabo verde": "Atlantic/Cape_Verde", "cape verde": "Atlantic/Cape_Verde", "cambodia": "Asia/Phnom_Penh", "cameroon": "Africa/Douala", "canada": "America/Toronto", "central african republic": "Africa/Bangui", "chad": "Africa/Ndjamena", "chile": "America/Santiago", "china": "Asia/Shanghai", "colombia": "America/Bogota", "comoros": "Indian/Comoro", "congo": "Africa/Brazzaville", "republic of the congo": "Africa/Brazzaville", "democratic republic of the congo": "Africa/Kinshasa", "dr congo": "Africa/Kinshasa", "drc": "Africa/Kinshasa", "ivory coast": "Africa/Abidjan", "côte d'ivoire": "Africa/Abidjan", "cote d'ivoire": "Africa/Abidjan", "croatia": "Europe/Zagreb", "cuba": "America/Havana", "cyprus": "Asia/Nicosia", "czechia": "Europe/Prague", "czech republic": "Europe/Prague", "denmark": "Europe/Copenhagen", "djibouti": "Africa/Djibouti", "dominican republic": "America/Santo_Domingo", "egypt": "Africa/Cairo", "equatorial guinea": "Africa/Malabo", "eritrea": "Africa/Asmara", "estonia": "Europe/Tallinn", "eswatini": "Africa/Mbabane", "swaziland": "Africa/Mbabane", "ethiopia": "Africa/Addis_Ababa", "fiji": "Pacific/Fiji", "finland": "Europe/Helsinki", "france": "Europe/Paris", "gabon": "Africa/Libreville", "gambia": "Africa/Banjul", "georgia": "Asia/Tbilisi", "germany": "Europe/Berlin", "ghana": "Africa/Accra", "greece": "Europe/Athens", "grenada": "America/Grenada", "guatemala": "America/Guatemala", "guinea": "Africa/Conakry", "guinea-bissau": "Africa/Bissau", "haiti": "America/Port-au-Prince", "honduras": "America/Tegucigalpa", "hungary": "Europe/Budapest", "iceland": "Atlantic/Reykjavik", "india": "Asia/Kolkata", "indonesia": "Asia/Jakarta", "iran": "Asia/Tehran", "iraq": "Asia/Baghdad", "ireland": "Europe/Dublin", "israel": "Asia/Jerusalem", "italy": "Europe/Rome", "japan": "Asia/Tokyo", "jordan": "Asia/Amman", "kazakhstan": "Asia/Almaty", "kenya": "Africa/Nairobi", "kiribati": "Pacific/Tarawa", "north korea": "Asia/Pyongyang", "south korea": "Asia/Seoul", "korea": "Asia/Seoul", "kuwait": "Asia/Kuwait", "kyrgyzstan": "Asia/Bishkek", "laos": "Asia/Vientiane", "latvia": "Europe/Riga", "lebanon": "Asia/Beirut", "lesotho": "Africa/Maseru", "liberia": "Africa/Monrovia", "libya": "Africa/Tripoli", "liechtenstein": "Europe/Vaduz", "lithuania": "Europe/Vilnius", "luxembourg": "Europe/Luxembourg", "madagascar": "Indian/Antananarivo", "malaysia": "Asia/Kuala_Lumpur", "maldives": "Indian/Maldives", "mali": "Africa/Bamako", "marshall islands": "Pacific/Majuro", "mauritania": "Africa/Nouakchott", "mexico": "America/Mexico_City", "micronesia": "Pacific/Pohnpei", "moldova": "Europe/Chisinau", "monaco": "Europe/Monaco", "mongolia": "Asia/Ulaanbaatar", "montenegro": "Europe/Podgorica", "morocco": "Africa/Casablanca", "mozambique": "Africa/Maputo", "myanmar": "Asia/Yangon", "burma": "Asia/Yangon", "namibia": "Africa/Windhoek", "nauru": "Pacific/Nauru", "nepal": "Asia/Kathmandu", "netherlands": "Europe/Amsterdam", "holland": "Europe/Amsterdam", "new zealand": "Pacific/Auckland", "nicaragua": "America/Managua", "niger": "Africa/Niamey", "nigeria": "Africa/Lagos", "north macedonia": "Europe/Skopje", "macedonia": "Europe/Skopje", "norway": "Europe/Oslo", "oman": "Asia/Muscat", "palau": "Pacific/Palau", "panama": "America/Panama", "papua new guinea": "Pacific/Port_Moresby", "paraguay": "America/Asuncion", "peru": "America/Lima", "philippines": "Asia/Manila", "poland": "Europe/Warsaw", "portugal": "Europe/Lisbon", "romania": "Europe/Bucharest", "russia": "Europe/Moscow", "rwanda": "Africa/Kigali", "saint kitts and nevis": "America/St_Kitts", "saint lucia": "America/St_Lucia", "saint vincent and the grenadines": "America/St_Vincent", "samoa": "Pacific/Apia", "san marino": "Europe/San_Marino", "sao tome and principe": "Africa/Sao_Tome", "são tomé and príncipe": "Africa/Sao_Tome", "saudi arabia": "Asia/Riyadh", "senegal": "Africa/Dakar", "serbia": "Europe/Belgrade", "seychelles": "Indian/Mahe", "sierra leone": "Africa/Freetown", "singapore": "Asia/Singapore", "slovakia": "Europe/Bratislava", "slovenia": "Europe/Ljubljana", "solomon islands": "Pacific/Guadalcanal", "somalia": "Africa/Mogadishu", "south africa": "Africa/Johannesburg", "south sudan": "Africa/Juba", "spain": "Europe/Madrid", "sri lanka": "Asia/Colombo", "sudan": "Africa/Khartoum", "suriname": "America/Paramaribo", "sweden": "Europe/Stockholm", "switzerland": "Europe/Zurich", "syria": "Asia/Damascus", "tajikistan": "Asia/Dushanbe", "tanzania": "Africa/Dar_es_Salaam", "thailand": "Asia/Bangkok", "timor-leste": "Asia/Dili", "east timor": "Asia/Dili", "togo": "Africa/Lome", "tonga": "Pacific/Tongatapu", "trinidad and tobago": "America/Port_of_Spain", "tunisia": "Africa/Tunis", "turkey": "Europe/Istanbul", "türkiye": "Europe/Istanbul", "turkmenistan": "Asia/Ashgabat", "tuvalu": "Pacific/Funafuti", "uganda": "Africa/Kampala", "ukraine": "Europe/Kyiv", "united arab emirates": "Asia/Dubai", "uae": "Asia/Dubai", "united kingdom": "Europe/London", "uk": "Europe/London", "great britain": "Europe/London", "britain": "Europe/London", "england": "Europe/London", "scotland": "Europe/London", "wales": "Europe/London", "united states": "America/New_York", "united states of america": "America/New_York", "usa": "America/New_York", "us": "America/New_York", "america": "America/New_York", "uruguay": "America/Montevideo", "uzbekistan": "Asia/Tashkent", "vanuatu": "Pacific/Efate", "vatican city": "Europe/Vatican", "vatican": "Europe/Vatican", "venezuela": "America/Caracas", "vietnam": "Asia/Ho_Chi_Minh", "zambia": "Africa/Lusaka", "zimbabwe": "Africa/Harare", "taiwan": "Asia/Taipei", "palestine": "Asia/Hebron", "kosovo": "Europe/Belgrade", "albania": "Europe/Tirane", "andorra": "Europe/Andorra", "bahrain": "Asia/Qatar", "barbados": "America/Barbados", "costa rica": "America/Costa_Rica", "dominica": "America/Puerto_Rico", "ecuador": "America/Guayaquil", "el salvador": "America/El_Salvador", "guyana": "America/Guyana", "jamaica": "America/Jamaica", "malawi": "Africa/Maputo", "malta": "Europe/Malta", "mauritius": "Indian/Mauritius", "pakistan": "Asia/Karachi", "qatar": "Asia/Qatar", "yemen": "Asia/Riyadh"};
// the zone's offset from UTC in minutes (east positive) at that moment, daylight saving included; null if the zone is unknown. Pure.
export function offsetOf(zone, now = new Date()) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(now).map((x) => [x.type, +x.value]));
    return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(now.getTime() / 60000) * 60000) / 60000);
  } catch (_) { return null; }
}
// the time row: "2:32 PM Thu in Tokyo, UTC+09:00 (13 h ahead of you)" when Verse knows the capital's zone (live source or not);
// a country with several zones keeps its span after the capital's time; else the offsets alone (tzLine). Pure given now.
export function timeLine(key, zones, mine, now = new Date()) {
  const z = CAPITAL_ZONES[key], off = z ? offsetOf(z, now) : null;
  if (off === null) return tzLine(zones, mine);
  const t = new Intl.DateTimeFormat('en-US', { timeZone: z, hour: 'numeric', minute: '2-digit', weekday: 'short' }).format(now).replace(/^(\w+),? (.*)$/, '$2 $1');
  const utc = 'UTC' + (off ? (off > 0 ? '+' : '−') + String(Math.floor(Math.abs(off) / 60)).padStart(2, '0') + ':' + String(Math.abs(off) % 60).padStart(2, '0') : '');
  const span = (zones || []).length > 1 ? tzLine(zones) : tzLine([utc], mine);
  return t + ' in ' + CAPITALS[key] + ', ' + span;
}
export function rowsOf(c, borderNames = [], mine = typeof Date !== 'undefined' ? -new Date().getTimezoneOffset() : 0, key = '', now = new Date()) {
  const cur = Object.values(c.currencies || {}).map((x) => x.name + (x.symbol ? ' (' + x.symbol + ')' : '')).join(', ');
  const langs = Object.values(c.languages || {}).join(', ');
  const idd = c.idd || {}, suf = idd.suffixes || [];
  return {
    capital: ['Capital', (c.capital || []).join(', ') || 'none'], population: ['Population', (c.population || 0).toLocaleString()],
    currencies: ['Currency', cur || 'none'], languages: ['Languages', langs || 'none'], area: ['Area', Math.round(c.area || 0).toLocaleString() + ' km²'],
    continent: ['Continent', (c.continents || []).join(', ') || c.region || ''],
    borders: ['Borders', borderNames.length ? borderNames.join(', ') : 'none (an island or no land borders)'],
    calling: ['Calling code', idd.root ? idd.root + (suf.length === 1 ? suf[0] : '') : ''],
    drives: ['Drives', c.car && c.car.side ? 'on the ' + c.car.side : ''],
    time: ['Time', key ? timeLine(key, c.timezones, mine, now) : tzLine(c.timezones, mine)]
  };
}
// Wikidata's public query service (keyless, CORS open): one query by the country's English name or alias, read into the shape
// the card's rows were written for (the REST Countries record), so rowsOf and the rest stay as they were. Pure.
export const WIKIDATA = 'https://query.wikidata.org/sparql';
const lit = (x) => '"' + String(x).replace(/["\\\n\r]/g, ' ') + '"@en';
export function namesOf(name) {
  const n = String(name || '').trim().replace(/^the\s+/i, ''), small = /^(?:and|of|the|da|du|de)$/i;
  const title = n.toLowerCase().split(' ').map((w, i) => (i && small.test(w) ? w : w.replace(/(^|[-'])\p{L}/gu, (c) => c.toUpperCase()))).join(' ');
  return [...new Set([n, title, n.toUpperCase(), 'the ' + n.toUpperCase(), 'the ' + title])].filter(Boolean); // "the UK" is how Wikidata spells that one
}
export function wikidataQuery(name) {
  // labels through Wikidata's label service, English first, then British and Canadian English (the euro had only an en-ca label one day)
  return 'SELECT ?c (SAMPLE(?nm) AS ?name) (SAMPLE(?pop) AS ?population) (MAX(?ar) AS ?area) (SAMPLE(?iso2) AS ?cca2) (SAMPLE(?iso3) AS ?cca3)'
    + ' (SAMPLE(?cc) AS ?calling) (SAMPLE(?sideLabel) AS ?drives) (GROUP_CONCAT(DISTINCT ?capLabel; separator="|") AS ?capitals) (GROUP_CONCAT(DISTINCT ?curLabel; separator="|") AS ?currencies)'
    + ' (GROUP_CONCAT(DISTINCT ?langLabel; separator="|") AS ?languages) (GROUP_CONCAT(DISTINCT ?contLabel; separator="|") AS ?continents) (GROUP_CONCAT(DISTINCT ?tzLabel; separator="|") AS ?timezones)'
    + ' (GROUP_CONCAT(DISTINCT ?bordLabel; separator="|") AS ?borders) WHERE { VALUES ?lab { ' + namesOf(name).map(lit).join(' ') + ' }'
    + ' { ?c rdfs:label ?lab } UNION { ?c skos:altLabel ?lab } ?c wdt:P31 ?t. VALUES ?t { wd:Q6256 wd:Q3624078 } ?c rdfs:label ?nm. FILTER(LANG(?nm) = "en")'
    + ' OPTIONAL { ?c wdt:P1082 ?pop } OPTIONAL { ?c wdt:P2046 ?ar } OPTIONAL { ?c wdt:P297 ?iso2 } OPTIONAL { ?c wdt:P298 ?iso3 } OPTIONAL { ?c wdt:P474 ?cc }'
    + ' OPTIONAL { ?c wdt:P1622 ?side } OPTIONAL { ?c wdt:P36 ?cap } OPTIONAL { ?c wdt:P38 ?cur } OPTIONAL { ?c wdt:P37 ?lang } OPTIONAL { ?c wdt:P30 ?cont } OPTIONAL { ?c wdt:P421 ?tz }'
    // a neighbour counts when it is a country or a sovereign state, the same test as ?c: Denmark (Q35) and the Netherlands (Q55) are only "country" (Q6256)
    + ' OPTIONAL { ?c wdt:P47 ?bord. ?bord wdt:P31 ?bt. VALUES ?bt { wd:Q6256 wd:Q3624078 } }'
    + ' SERVICE wikibase:label { bd:serviceParam wikibase:language "en,en-gb,en-ca". ' + ['side', 'cap', 'cur', 'lang', 'cont', 'tz', 'bord'].map((k) => '?' + k + ' rdfs:label ?' + k + 'Label.').join(' ') + ' } } GROUP BY ?c LIMIT 5';
}
const flagOf = (cc) => (/^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : '');
/** Wikidata's answer rows as REST Countries records ([{ name, capital, population, ... }]); borders are names (Wikidata does not tell
 *  land from sea borders, so the card says both). Pure. */
export function fromWikidata(j) {
  const rows = (j && j.results && Array.isArray(j.results.bindings)) ? j.results.bindings : [];
  const v = (b, k) => (b[k] && typeof b[k].value === 'string' ? b[k].value : ''), list = (b, k) => v(b, k).split('|').map((x) => x.trim()).filter(Boolean);
  return rows.filter((b) => v(b, 'name')).map((b) => {
    const side = v(b, 'drives').toLowerCase(), call = v(b, 'calling').replace(/\s+/g, '');
    return { name: { common: v(b, 'name'), official: v(b, 'name') }, capital: list(b, 'capitals'), population: Math.round(+v(b, 'population') || 0),
      currencies: Object.fromEntries(list(b, 'currencies').map((n, i) => ['c' + i, { name: n }])), languages: Object.fromEntries(list(b, 'languages').map((n, i) => ['l' + i, n])),
      area: +v(b, 'area') || 0, flag: flagOf(v(b, 'cca2')), cca3: v(b, 'cca3'), continents: list(b, 'continents'), region: list(b, 'continents')[0] || '', subregion: '',
      timezones: list(b, 'timezones').map((z) => z.replace(/\u2212/g, '−')).filter((z) => /^UTC(?:[+\-−]\d\d:\d\d)?$/.test(z)),
      borderNames: list(b, 'borders').sort((x, y) => x.localeCompare(y)), borders: list(b, 'borders'), idd: call ? { root: call.startsWith('+') ? call : '+' + call, suffixes: [] } : {},
      car: /left|right/.test(side) ? { side: side.includes('left') ? 'left' : 'right' } : {}, wikidata: v(b, 'c').replace(/^http:/, 'https:') };
  });
}
// Built-in capitals (UN members and common names), used when the live source (Wikidata) does not answer, so a capital ask still gets its capital (tools/test_void.mjs, the country card with the service down).
export const CAPITALS = {"afghanistan": "Kabul", "albania": "Tirana", "algeria": "Algiers", "andorra": "Andorra la Vella", "angola": "Luanda", "antigua and barbuda": "Saint John's", "argentina": "Buenos Aires", "armenia": "Yerevan", "australia": "Canberra", "austria": "Vienna", "azerbaijan": "Baku", "bahamas": "Nassau", "bahrain": "Manama", "bangladesh": "Dhaka", "barbados": "Bridgetown", "belarus": "Minsk", "belgium": "Brussels", "belize": "Belmopan", "benin": "Porto-Novo", "bhutan": "Thimphu", "bolivia": "Sucre", "bosnia and herzegovina": "Sarajevo", "botswana": "Gaborone", "brazil": "Brasília", "brunei": "Bandar Seri Begawan", "bulgaria": "Sofia", "burkina faso": "Ouagadougou", "burundi": "Gitega", "cabo verde": "Praia", "cape verde": "Praia", "cambodia": "Phnom Penh", "cameroon": "Yaoundé", "canada": "Ottawa", "central african republic": "Bangui", "chad": "N'Djamena", "chile": "Santiago", "china": "Beijing", "colombia": "Bogotá", "comoros": "Moroni", "congo": "Brazzaville", "republic of the congo": "Brazzaville", "democratic republic of the congo": "Kinshasa", "dr congo": "Kinshasa", "drc": "Kinshasa", "costa rica": "San José", "ivory coast": "Yamoussoukro", "côte d'ivoire": "Yamoussoukro", "cote d'ivoire": "Yamoussoukro", "croatia": "Zagreb", "cuba": "Havana", "cyprus": "Nicosia", "czechia": "Prague", "czech republic": "Prague", "denmark": "Copenhagen", "djibouti": "Djibouti", "dominica": "Roseau", "dominican republic": "Santo Domingo", "ecuador": "Quito", "egypt": "Cairo", "el salvador": "San Salvador", "equatorial guinea": "Malabo", "eritrea": "Asmara", "estonia": "Tallinn", "eswatini": "Mbabane", "swaziland": "Mbabane", "ethiopia": "Addis Ababa", "fiji": "Suva", "finland": "Helsinki", "france": "Paris", "gabon": "Libreville", "gambia": "Banjul", "georgia": "Tbilisi", "germany": "Berlin", "ghana": "Accra", "greece": "Athens", "grenada": "St. George's", "guatemala": "Guatemala City", "guinea": "Conakry", "guinea-bissau": "Bissau", "guyana": "Georgetown", "haiti": "Port-au-Prince", "honduras": "Tegucigalpa", "hungary": "Budapest", "iceland": "Reykjavík", "india": "New Delhi", "indonesia": "Jakarta", "iran": "Tehran", "iraq": "Baghdad", "ireland": "Dublin", "israel": "Jerusalem", "italy": "Rome", "jamaica": "Kingston", "japan": "Tokyo", "jordan": "Amman", "kazakhstan": "Astana", "kenya": "Nairobi", "kiribati": "Tarawa", "north korea": "Pyongyang", "south korea": "Seoul", "korea": "Seoul", "kuwait": "Kuwait City", "kyrgyzstan": "Bishkek", "laos": "Vientiane", "latvia": "Riga", "lebanon": "Beirut", "lesotho": "Maseru", "liberia": "Monrovia", "libya": "Tripoli", "liechtenstein": "Vaduz", "lithuania": "Vilnius", "luxembourg": "Luxembourg", "madagascar": "Antananarivo", "malawi": "Lilongwe", "malaysia": "Kuala Lumpur", "maldives": "Malé", "mali": "Bamako", "malta": "Valletta", "marshall islands": "Majuro", "mauritania": "Nouakchott", "mauritius": "Port Louis", "mexico": "Mexico City", "micronesia": "Palikir", "moldova": "Chișinău", "monaco": "Monaco", "mongolia": "Ulaanbaatar", "montenegro": "Podgorica", "morocco": "Rabat", "mozambique": "Maputo", "myanmar": "Naypyidaw", "burma": "Naypyidaw", "namibia": "Windhoek", "nauru": "Yaren", "nepal": "Kathmandu", "netherlands": "Amsterdam", "holland": "Amsterdam", "new zealand": "Wellington", "nicaragua": "Managua", "niger": "Niamey", "nigeria": "Abuja", "north macedonia": "Skopje", "macedonia": "Skopje", "norway": "Oslo", "oman": "Muscat", "pakistan": "Islamabad", "palau": "Ngerulmud", "panama": "Panama City", "papua new guinea": "Port Moresby", "paraguay": "Asunción", "peru": "Lima", "philippines": "Manila", "poland": "Warsaw", "portugal": "Lisbon", "qatar": "Doha", "romania": "Bucharest", "russia": "Moscow", "rwanda": "Kigali", "saint kitts and nevis": "Basseterre", "saint lucia": "Castries", "saint vincent and the grenadines": "Kingstown", "samoa": "Apia", "san marino": "San Marino", "sao tome and principe": "São Tomé", "são tomé and príncipe": "São Tomé", "saudi arabia": "Riyadh", "senegal": "Dakar", "serbia": "Belgrade", "seychelles": "Victoria", "sierra leone": "Freetown", "singapore": "Singapore", "slovakia": "Bratislava", "slovenia": "Ljubljana", "solomon islands": "Honiara", "somalia": "Mogadishu", "south africa": "Pretoria", "south sudan": "Juba", "spain": "Madrid", "sri lanka": "Sri Jayawardenepura Kotte", "sudan": "Khartoum", "suriname": "Paramaribo", "sweden": "Stockholm", "switzerland": "Bern", "syria": "Damascus", "tajikistan": "Dushanbe", "tanzania": "Dodoma", "thailand": "Bangkok", "timor-leste": "Dili", "east timor": "Dili", "togo": "Lomé", "tonga": "Nuku'alofa", "trinidad and tobago": "Port of Spain", "tunisia": "Tunis", "turkey": "Ankara", "türkiye": "Ankara", "turkmenistan": "Ashgabat", "tuvalu": "Funafuti", "uganda": "Kampala", "ukraine": "Kyiv", "united arab emirates": "Abu Dhabi", "uae": "Abu Dhabi", "united kingdom": "London", "uk": "London", "great britain": "London", "britain": "London", "england": "London", "scotland": "Edinburgh", "wales": "Cardiff", "united states": "Washington, D.C.", "united states of america": "Washington, D.C.", "usa": "Washington, D.C.", "us": "Washington, D.C.", "america": "Washington, D.C.", "uruguay": "Montevideo", "uzbekistan": "Tashkent", "vanuatu": "Port Vila", "vatican city": "Vatican City", "vatican": "Vatican City", "venezuela": "Caracas", "vietnam": "Hanoi", "yemen": "Sana'a", "zambia": "Lusaka", "zimbabwe": "Harare", "taiwan": "Taipei", "palestine": "Ramallah", "kosovo": "Pristina"};
// Built-in currencies for the most asked-about countries, used the same way as CAPITALS.
export const CURRENCIES = {"argentina": "Argentine peso", "australia": "Australian dollar", "austria": "euro", "bangladesh": "Bangladeshi taka", "belgium": "euro", "brazil": "Brazilian real", "bulgaria": "euro", "canada": "Canadian dollar", "chile": "Chilean peso", "china": "Chinese yuan (renminbi)", "colombia": "Colombian peso", "croatia": "euro", "czechia": "Czech koruna", "czech republic": "Czech koruna", "denmark": "Danish krone", "egypt": "Egyptian pound", "estonia": "euro", "ethiopia": "Ethiopian birr", "finland": "euro", "france": "euro", "germany": "euro", "ghana": "Ghanaian cedi", "greece": "euro", "hungary": "Hungarian forint", "iceland": "Icelandic króna", "india": "Indian rupee", "indonesia": "Indonesian rupiah", "iran": "Iranian rial", "iraq": "Iraqi dinar", "ireland": "euro", "israel": "Israeli new shekel", "italy": "euro", "japan": "Japanese yen", "jordan": "Jordanian dinar", "kenya": "Kenyan shilling", "kuwait": "Kuwaiti dinar", "latvia": "euro", "lithuania": "euro", "luxembourg": "euro", "malaysia": "Malaysian ringgit", "malta": "euro", "mexico": "Mexican peso", "mongolia": "Mongolian tögrög", "morocco": "Moroccan dirham", "nepal": "Nepalese rupee", "netherlands": "euro", "holland": "euro", "new zealand": "New Zealand dollar", "nigeria": "Nigerian naira", "norway": "Norwegian krone", "pakistan": "Pakistani rupee", "peru": "Peruvian sol", "philippines": "Philippine peso", "poland": "Polish złoty", "portugal": "euro", "qatar": "Qatari riyal", "romania": "Romanian leu", "russia": "Russian ruble", "saudi arabia": "Saudi riyal", "singapore": "Singapore dollar", "slovakia": "euro", "slovenia": "euro", "south africa": "South African rand", "south korea": "South Korean won", "korea": "South Korean won", "spain": "euro", "sri lanka": "Sri Lankan rupee", "sweden": "Swedish krona", "switzerland": "Swiss franc", "taiwan": "New Taiwan dollar", "tanzania": "Tanzanian shilling", "thailand": "Thai baht", "turkey": "Turkish lira", "türkiye": "Turkish lira", "uganda": "Ugandan shilling", "ukraine": "Ukrainian hryvnia", "united arab emirates": "UAE dirham", "uae": "UAE dirham", "united kingdom": "pound sterling", "uk": "pound sterling", "great britain": "pound sterling", "britain": "pound sterling", "england": "pound sterling", "scotland": "pound sterling", "wales": "pound sterling", "united states": "US dollar", "united states of america": "US dollar", "usa": "US dollar", "us": "US dollar", "america": "US dollar", "vietnam": "Vietnamese đồng (dong)", "zimbabwe": "Zimbabwe gold (ZiG)"};
// two countries compared (asked by Verse, ask-20261015-0048-1: "comparing two countries automatically generates a travel-metric card"):
// "france vs spain", "compare japan and korea" -> both capitals side by side with the distance and flight-time asks one tap away
// (the distance skill answers those). Pure.
export function compareOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = /^(?:compare\s+)?([a-z][a-z .'-]{1,40}?)\s+(?:vs\.?|versus|and|to|with)\s+([a-z][a-z .'-]{1,40}?)$/.exec(t);
  if (!m || (!/^compare\s/.test(t) && !/\s(?:vs\.?|versus)\s/.test(t))) return null;
  const a = m[1].replace(/^the\s+/, '').trim(), b = m[2].replace(/^the\s+/, '').trim();
  if (!CAPITALS[a] || !CAPITALS[b] || CAPITALS[a] === CAPITALS[b]) return null;
  const cap = (x) => CAPITALS[x].replace(/, D\.C\.$/, ' DC'), title = (x) => x.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return { a: title(a), b: title(b), capA: cap(a), capB: cap(b), distance: 'distance from ' + cap(a) + ' to ' + cap(b), flight: 'how long is the flight from ' + cap(a) + ' to ' + cap(b) };
}
async function run(text, api) {
  const { showPage, esc } = api;
  const cq = compareOf(text);
  if (cq) {
    const shownEl = showPage((p) => { p.innerHTML = '<h2>' + esc(cq.a + ' and ' + cq.b) + '</h2><ul style="padding-left:18px"><li><b>' + esc(cq.a) + '</b> capital ' + esc(cq.capA) + '</li><li><b>' + esc(cq.b) + '</b> capital ' + esc(cq.capB) + '</li></ul>'
      + '<p><a href="#" data-ask="' + esc(cq.distance) + '">How far apart</a> · <a href="#" data-ask="' + esc(cq.flight) + '">Flight time</a> · <a href="#" data-ask="' + esc('population of ' + cq.a) + '">' + esc(cq.a) + ' facts</a> · <a href="#" data-ask="' + esc('population of ' + cq.b) + '">' + esc(cq.b) + ' facts</a></p>'; });
    // linked to the distance skill (asked by Verse): the travel metrics come up on the card by themselves, from the same place
    // lookup and great-circle sum as "distance from X to Y"; the links above stay if the place service does not answer
    try {
      const [ga, gb] = await Promise.all([geo(cq.capA.replace(/ DC$/, '')), geo(cq.capB.replace(/ DC$/, ''))]);
      if (shownEl && ga && gb && api._pageStill(shownEl)) {
        const d = km(ga, gb), line = document.createElement('div');
        line.className = 'travel-metric';
        line.style.cssText = 'margin:8px 0;padding:8px 12px;border-left:3px solid #7aa2ff';
        line.innerHTML = '<b>' + esc(Math.round(d).toLocaleString()) + ' km</b> (' + esc(Math.round(d * 0.621371).toLocaleString()) + ' miles) between ' + esc(cq.capA) + ' and ' + esc(cq.capB) + ' in a straight line · ' + esc(flightTime(d)) + ' in the air, roughly';
        shownEl.insertBefore(line, shownEl.querySelector('p'));
      }
    } catch (_) {}
    return 'country';
  }
  const q = countryOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(q.name) + '</h2><div class="sub">…</div>'; });
  // the built-in answer (capital, or currency for currency asks): shown at once while the live source loads, and kept if it never answers
  const key = q.name.toLowerCase().replace(/^the\s+/, '');
  const known = q.want === 'currencies' ? CURRENCIES[key] : CAPITALS[key];
  // returns 'answered' (the asked field is shown), 'shown' (only the capital is shown) or '' (nothing Verse knows)
  const builtIn = (waiting) => { const cap = CAPITALS[key]; const big = known || cap; if (!big || !api._pageStill(el)) return '';
    const answers = !!known && (q.want === 'capital' || q.want === 'currencies');
    el.innerHTML = '<h2>' + esc(q.name.replace(/\b\w/g, (x) => x.toUpperCase())) + '</h2><div class="sub">' + (known && q.want === 'currencies' ? 'Currency' : 'Capital') + '</div><div style="font-size:44px;font-weight:300;line-height:1.15;margin:6px 0 8px">' + esc(big) + '</div>'
      + (CAPITAL_ZONES[key] ? '<p>Time there now: ' + esc(timeLine(key, [], -new Date().getTimezoneOffset())) + '</p>' : '')
      + (answers ? '' : waiting ? '<p>Looking up the ' + esc(q.want) + '…</p>' : '<p>The country service didn\'t answer just now, so only the capital is shown. Ask again in a moment for ' + esc(q.want) + '.</p>')
      + '<div class="src">' + (waiting ? 'From Verse\'s built-in list, checking Wikidata…' : 'From Verse\'s built-in list (the live source, Wikidata, didn\'t answer)') + '</div>';
    return answers ? 'answered' : 'shown'; };
  builtIn(true);
  try {
    const r = await (api.fetch || fetch)(WIKIDATA + '?format=json&query=' + encodeURIComponent(wikidataQuery(q.name)), { headers: { Accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined });
    const all = r.ok ? fromWikidata(await r.json()) : [];
    if (!api._pageStill(el)) return 'country';
    const lc = q.name.toLowerCase();
    // the exact name first; else the result whose capital is the one Verse knows for that name ("uk" -> the country with London);
    // never just the first result when Verse knows the country, since a loose search can put another country first
    const flat = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
    const c = (all || []).find((x) => x.name && (x.name.common.toLowerCase() === lc || x.name.official.toLowerCase() === lc))
      || (CAPITALS[key] ? (all || []).find((x) => (x.capital || []).some((cc) => flat(cc) === flat(CAPITALS[key]))) : (all || [])[0]);
    if (!c) { const b = builtIn(false); if (b === 'answered') return 'country'; if (b) return 'none'; el.innerHTML = '<h2>' + esc(q.name) + '</h2><p>I only know countries this way so far, and I didn\'t find “' + esc(q.name) + '”. Try “what is ' + esc(q.name) + '” for a page about it.</p>'; return 'none'; }
    // the countries on its borders by name (one more call, only when asked; their codes if it fails)
    let borderNames = [];
    if (q.want === 'borders') borderNames = Array.isArray(c.borderNames) ? c.borderNames : [];
    if (!Object.keys(c.currencies || {}).length && CURRENCIES[key]) c.currencies = { b: { name: CURRENCIES[key] } }; // a field Wikidata left empty, from the built-in list
    if (!(c.capital || []).length && CAPITALS[key]) c.capital = [CAPITALS[key]];
    const all5 = rowsOf(c, borderNames, undefined, CAPITALS[key] ? key : ''); if (borderNames.length) all5.borders[0] = 'Borders (land and sea)';
    const extra = ['continent', 'borders', 'calling', 'drives', 'time'];
    const rows = Object.fromEntries(Object.entries(all5).filter(([k, v]) => k === q.want || (!extra.includes(k) && v[1]) || (extra.includes(k) && k !== 'borders' && v[1])));
    const main = rows[q.want] && rows[q.want][1] ? rows[q.want] : q.want in all5 ? [all5[q.want][0], 'not known'] : rows.capital;
    const rest = Object.entries(rows).filter(([k]) => rows[k] !== main && k !== q.want).map(([, v]) => '<li><b>' + esc(v[0]) + '</b> <span style="color:#9a9a9a">— ' + esc(v[1]) + '</span></li>').join('');
    el.innerHTML = '<h2>' + esc((c.flag ? c.flag + ' ' : '') + c.name.common) + '</h2><div class="sub">' + esc(main[0]) + '</div>'
      + '<div style="font-size:44px;font-weight:300;line-height:1.15;margin:6px 0 8px">' + esc(main[1]) + '</div>'
      + '<ul>' + rest + '</ul><div class="sub">' + esc([c.subregion, c.region].filter(Boolean).join(', ')) + '</div>'
      + '<div class="src">Source: <a href="' + esc(/^https:\/\/www\.wikidata\.org\/entity\/Q\d+$/.test(c.wikidata || '') ? c.wikidata.replace('/entity/', '/wiki/') : 'https://www.wikidata.org/') + '" target="_blank" rel="noopener">Wikidata</a></div>';
    return 'country';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    // keep what Verse knows on the page (the capital, with a note that the asked field is not available) rather than an error
    const b = builtIn(false); if (b === 'answered') return 'country'; if (b) return 'none';
    el.innerHTML = '<h2>' + esc(q.name) + '</h2><p>The country service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}
export default {
  name: 'country',
  examples: ['france vs spain', 'compare japan and south korea', 'capital of Australia', 'population of Japan', 'what currency does Brazil use', 'languages spoken in Switzerland'],
  nearMisses: ['capital letters', 'what is capitalism', 'population growth', 'weather in Japan', 'how big is the sun'],
  match(lower, text) { return !!countryOf(text) || !!compareOf(text); },
  run
};
