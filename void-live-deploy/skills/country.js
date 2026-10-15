/**
 * country skill — capital, population, currency, languages and area of a country, from REST Countries (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "capital of Australia", "population of Japan", "what currency does Brazil use", "languages spoken in Switzerland".
 */
const FIELDS = { capital: 'capital', population: 'population', currency: 'currencies', currencies: 'currencies', language: 'languages', languages: 'languages', area: 'area', flag: 'flags', size: 'area' };
export function countryOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:what(?:['’]?s| is| are)\s+)?(?:the\s+)?(capital|population|currency|currencies|official\s+languages?|languages?|area|size|flag)(?:\s+city)?\s+of\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m && !NOT_COUNTRY.test(m[2].trim())) return { want: FIELDS[m[1].toLowerCase().replace(/^official\s+/, '')] || 'all', name: m[2].trim() };
  if (m) return null;
  m = t.match(/^(?:what|which)\s+(currency|languages?)\s+(?:does|do|is|are)\s+(?:used\s+in|spoken\s+in)?\s*(?:the\s+)?([A-Za-zÀ-ÿ' .-]{2,40}?)(?:\s+(?:use|speak|have))?$/i);
  // "what language does the word kindergarten come from" asks where a word comes from, not about a country
  if (m && !/\b(?:words?|come|comes|came|from|originate)\b/i.test(m[2]) && !NOT_COUNTRY.test(m[2].trim())) return { want: FIELDS[m[1].toLowerCase()], name: m[2].trim() };
  // "how big is france": only a country Void knows by name, so "how big is the sun" stays with what knows it
  m = t.match(/^how\s+(?:big|large)\s+is\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{2,40})$/i);
  if (m && CAPITALS[m[1].trim().toLowerCase()]) return { want: 'area', name: m[1].trim() };
  m = t.match(/^how\s+many\s+people\s+live\s+in\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m) return { want: 'population', name: m[1].trim() };
  m = t.match(/^(?:what\s+)?languages?\s+(?:are\s+|is\s+)?spoken\s+in\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m) return { want: 'languages', name: m[1].trim() };
  // more ways to ask, each only for a country Void knows by name (so "what do they speak in the movie" stays out):
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
// the time zone row (asked by Void, ask-20261015-0048-2): the offset and how far ahead of or behind the asker it is. Pure.
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
export function rowsOf(c, borderNames = [], mine = typeof Date !== 'undefined' ? -new Date().getTimezoneOffset() : 0) {
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
    time: ['Time', tzLine(c.timezones, mine)]
  };
}
// Built-in capitals (UN members and common names), used only when REST Countries does not answer, so a capital ask never fails.
export const CAPITALS = {"afghanistan": "Kabul", "albania": "Tirana", "algeria": "Algiers", "andorra": "Andorra la Vella", "angola": "Luanda", "antigua and barbuda": "Saint John's", "argentina": "Buenos Aires", "armenia": "Yerevan", "australia": "Canberra", "austria": "Vienna", "azerbaijan": "Baku", "bahamas": "Nassau", "bahrain": "Manama", "bangladesh": "Dhaka", "barbados": "Bridgetown", "belarus": "Minsk", "belgium": "Brussels", "belize": "Belmopan", "benin": "Porto-Novo", "bhutan": "Thimphu", "bolivia": "Sucre", "bosnia and herzegovina": "Sarajevo", "botswana": "Gaborone", "brazil": "Brasília", "brunei": "Bandar Seri Begawan", "bulgaria": "Sofia", "burkina faso": "Ouagadougou", "burundi": "Gitega", "cabo verde": "Praia", "cape verde": "Praia", "cambodia": "Phnom Penh", "cameroon": "Yaoundé", "canada": "Ottawa", "central african republic": "Bangui", "chad": "N'Djamena", "chile": "Santiago", "china": "Beijing", "colombia": "Bogotá", "comoros": "Moroni", "congo": "Brazzaville", "republic of the congo": "Brazzaville", "democratic republic of the congo": "Kinshasa", "dr congo": "Kinshasa", "drc": "Kinshasa", "costa rica": "San José", "ivory coast": "Yamoussoukro", "côte d'ivoire": "Yamoussoukro", "cote d'ivoire": "Yamoussoukro", "croatia": "Zagreb", "cuba": "Havana", "cyprus": "Nicosia", "czechia": "Prague", "czech republic": "Prague", "denmark": "Copenhagen", "djibouti": "Djibouti", "dominica": "Roseau", "dominican republic": "Santo Domingo", "ecuador": "Quito", "egypt": "Cairo", "el salvador": "San Salvador", "equatorial guinea": "Malabo", "eritrea": "Asmara", "estonia": "Tallinn", "eswatini": "Mbabane", "swaziland": "Mbabane", "ethiopia": "Addis Ababa", "fiji": "Suva", "finland": "Helsinki", "france": "Paris", "gabon": "Libreville", "gambia": "Banjul", "georgia": "Tbilisi", "germany": "Berlin", "ghana": "Accra", "greece": "Athens", "grenada": "St. George's", "guatemala": "Guatemala City", "guinea": "Conakry", "guinea-bissau": "Bissau", "guyana": "Georgetown", "haiti": "Port-au-Prince", "honduras": "Tegucigalpa", "hungary": "Budapest", "iceland": "Reykjavík", "india": "New Delhi", "indonesia": "Jakarta", "iran": "Tehran", "iraq": "Baghdad", "ireland": "Dublin", "israel": "Jerusalem", "italy": "Rome", "jamaica": "Kingston", "japan": "Tokyo", "jordan": "Amman", "kazakhstan": "Astana", "kenya": "Nairobi", "kiribati": "Tarawa", "north korea": "Pyongyang", "south korea": "Seoul", "korea": "Seoul", "kuwait": "Kuwait City", "kyrgyzstan": "Bishkek", "laos": "Vientiane", "latvia": "Riga", "lebanon": "Beirut", "lesotho": "Maseru", "liberia": "Monrovia", "libya": "Tripoli", "liechtenstein": "Vaduz", "lithuania": "Vilnius", "luxembourg": "Luxembourg", "madagascar": "Antananarivo", "malawi": "Lilongwe", "malaysia": "Kuala Lumpur", "maldives": "Malé", "mali": "Bamako", "malta": "Valletta", "marshall islands": "Majuro", "mauritania": "Nouakchott", "mauritius": "Port Louis", "mexico": "Mexico City", "micronesia": "Palikir", "moldova": "Chișinău", "monaco": "Monaco", "mongolia": "Ulaanbaatar", "montenegro": "Podgorica", "morocco": "Rabat", "mozambique": "Maputo", "myanmar": "Naypyidaw", "burma": "Naypyidaw", "namibia": "Windhoek", "nauru": "Yaren", "nepal": "Kathmandu", "netherlands": "Amsterdam", "holland": "Amsterdam", "new zealand": "Wellington", "nicaragua": "Managua", "niger": "Niamey", "nigeria": "Abuja", "north macedonia": "Skopje", "macedonia": "Skopje", "norway": "Oslo", "oman": "Muscat", "pakistan": "Islamabad", "palau": "Ngerulmud", "panama": "Panama City", "papua new guinea": "Port Moresby", "paraguay": "Asunción", "peru": "Lima", "philippines": "Manila", "poland": "Warsaw", "portugal": "Lisbon", "qatar": "Doha", "romania": "Bucharest", "russia": "Moscow", "rwanda": "Kigali", "saint kitts and nevis": "Basseterre", "saint lucia": "Castries", "saint vincent and the grenadines": "Kingstown", "samoa": "Apia", "san marino": "San Marino", "sao tome and principe": "São Tomé", "são tomé and príncipe": "São Tomé", "saudi arabia": "Riyadh", "senegal": "Dakar", "serbia": "Belgrade", "seychelles": "Victoria", "sierra leone": "Freetown", "singapore": "Singapore", "slovakia": "Bratislava", "slovenia": "Ljubljana", "solomon islands": "Honiara", "somalia": "Mogadishu", "south africa": "Pretoria", "south sudan": "Juba", "spain": "Madrid", "sri lanka": "Sri Jayawardenepura Kotte", "sudan": "Khartoum", "suriname": "Paramaribo", "sweden": "Stockholm", "switzerland": "Bern", "syria": "Damascus", "tajikistan": "Dushanbe", "tanzania": "Dodoma", "thailand": "Bangkok", "timor-leste": "Dili", "east timor": "Dili", "togo": "Lomé", "tonga": "Nuku'alofa", "trinidad and tobago": "Port of Spain", "tunisia": "Tunis", "turkey": "Ankara", "türkiye": "Ankara", "turkmenistan": "Ashgabat", "tuvalu": "Funafuti", "uganda": "Kampala", "ukraine": "Kyiv", "united arab emirates": "Abu Dhabi", "uae": "Abu Dhabi", "united kingdom": "London", "uk": "London", "great britain": "London", "britain": "London", "england": "London", "scotland": "Edinburgh", "wales": "Cardiff", "united states": "Washington, D.C.", "united states of america": "Washington, D.C.", "usa": "Washington, D.C.", "us": "Washington, D.C.", "america": "Washington, D.C.", "uruguay": "Montevideo", "uzbekistan": "Tashkent", "vanuatu": "Port Vila", "vatican city": "Vatican City", "vatican": "Vatican City", "venezuela": "Caracas", "vietnam": "Hanoi", "yemen": "Sana'a", "zambia": "Lusaka", "zimbabwe": "Harare", "taiwan": "Taipei", "palestine": "Ramallah", "kosovo": "Pristina"};
// Built-in currencies for the most asked-about countries, used the same way as CAPITALS.
export const CURRENCIES = {"argentina": "Argentine peso", "australia": "Australian dollar", "austria": "euro", "bangladesh": "Bangladeshi taka", "belgium": "euro", "brazil": "Brazilian real", "bulgaria": "euro", "canada": "Canadian dollar", "chile": "Chilean peso", "china": "Chinese yuan (renminbi)", "colombia": "Colombian peso", "croatia": "euro", "czechia": "Czech koruna", "czech republic": "Czech koruna", "denmark": "Danish krone", "egypt": "Egyptian pound", "estonia": "euro", "ethiopia": "Ethiopian birr", "finland": "euro", "france": "euro", "germany": "euro", "ghana": "Ghanaian cedi", "greece": "euro", "hungary": "Hungarian forint", "iceland": "Icelandic króna", "india": "Indian rupee", "indonesia": "Indonesian rupiah", "iran": "Iranian rial", "iraq": "Iraqi dinar", "ireland": "euro", "israel": "Israeli new shekel", "italy": "euro", "japan": "Japanese yen", "jordan": "Jordanian dinar", "kenya": "Kenyan shilling", "kuwait": "Kuwaiti dinar", "latvia": "euro", "lithuania": "euro", "luxembourg": "euro", "malaysia": "Malaysian ringgit", "malta": "euro", "mexico": "Mexican peso", "mongolia": "Mongolian tögrög", "morocco": "Moroccan dirham", "nepal": "Nepalese rupee", "netherlands": "euro", "holland": "euro", "new zealand": "New Zealand dollar", "nigeria": "Nigerian naira", "norway": "Norwegian krone", "pakistan": "Pakistani rupee", "peru": "Peruvian sol", "philippines": "Philippine peso", "poland": "Polish złoty", "portugal": "euro", "qatar": "Qatari riyal", "romania": "Romanian leu", "russia": "Russian ruble", "saudi arabia": "Saudi riyal", "singapore": "Singapore dollar", "slovakia": "euro", "slovenia": "euro", "south africa": "South African rand", "south korea": "South Korean won", "korea": "South Korean won", "spain": "euro", "sri lanka": "Sri Lankan rupee", "sweden": "Swedish krona", "switzerland": "Swiss franc", "taiwan": "New Taiwan dollar", "tanzania": "Tanzanian shilling", "thailand": "Thai baht", "turkey": "Turkish lira", "türkiye": "Turkish lira", "uganda": "Ugandan shilling", "ukraine": "Ukrainian hryvnia", "united arab emirates": "UAE dirham", "uae": "UAE dirham", "united kingdom": "pound sterling", "uk": "pound sterling", "great britain": "pound sterling", "britain": "pound sterling", "england": "pound sterling", "scotland": "pound sterling", "wales": "pound sterling", "united states": "US dollar", "united states of america": "US dollar", "usa": "US dollar", "us": "US dollar", "america": "US dollar", "vietnam": "Vietnamese đồng (dong)", "zimbabwe": "Zimbabwe gold (ZiG)"};
// two countries compared (asked by Void, ask-20261015-0048-1: "comparing two countries automatically generates a travel-metric card"):
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
    showPage((p) => { p.innerHTML = '<h2>' + esc(cq.a + ' and ' + cq.b) + '</h2><ul style="padding-left:18px"><li><b>' + esc(cq.a) + '</b> capital ' + esc(cq.capA) + '</li><li><b>' + esc(cq.b) + '</b> capital ' + esc(cq.capB) + '</li></ul>'
      + '<p><a href="#" data-ask="' + esc(cq.distance) + '">How far apart</a> · <a href="#" data-ask="' + esc(cq.flight) + '">Flight time</a> · <a href="#" data-ask="' + esc('population of ' + cq.a) + '">' + esc(cq.a) + ' facts</a> · <a href="#" data-ask="' + esc('population of ' + cq.b) + '">' + esc(cq.b) + ' facts</a></p>'; });
    return 'country';
  }
  const q = countryOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(q.name) + '</h2><div class="sub">…</div>'; });
  // the built-in answer (capital, or currency for currency asks): shown at once while the live source loads, and kept if it never answers
  const key = q.name.toLowerCase().replace(/^the\s+/, '');
  const known = q.want === 'currencies' ? CURRENCIES[key] : CAPITALS[key];
  // returns 'answered' (the asked field is shown), 'shown' (only the capital is shown) or '' (nothing Void knows)
  const builtIn = (waiting) => { const cap = CAPITALS[key]; const big = known || cap; if (!big || !api._pageStill(el)) return '';
    const answers = !!known && (q.want === 'capital' || q.want === 'currencies');
    el.innerHTML = '<h2>' + esc(q.name.replace(/\b\w/g, (x) => x.toUpperCase())) + '</h2><div class="sub">' + (known && q.want === 'currencies' ? 'Currency' : 'Capital') + '</div><div style="font-size:44px;font-weight:300;line-height:1.15;margin:6px 0 8px">' + esc(big) + '</div>'
      + (answers ? '' : waiting ? '<p>Looking up the ' + esc(q.want) + '…</p>' : '<p>The country service didn\'t answer just now, so only the capital is shown. Ask again in a moment for ' + esc(q.want) + '.</p>')
      + '<div class="src">' + (waiting ? 'From V01D\'s built-in list, checking REST Countries…' : 'From V01D\'s built-in list (the live source, REST Countries, didn\'t answer)') + '</div>';
    return answers ? 'answered' : 'shown'; };
  builtIn(true);
  try {
    const r = await fetch('https://restcountries.com/v3.1/name/' + encodeURIComponent(q.name) + '?fields=name,capital,population,currencies,languages,area,flag,region,subregion,continents,borders,idd,car,cca3,timezones', { signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined });
    const all = r.ok ? await r.json() : [];
    if (!api._pageStill(el)) return 'country';
    const lc = q.name.toLowerCase();
    // the exact name first; else the result whose capital is the one Void knows for that name ("uk" -> the country with London);
    // never just the first result when Void knows the country, since a loose search can put another country first
    const flat = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
    const c = (all || []).find((x) => x.name && (x.name.common.toLowerCase() === lc || x.name.official.toLowerCase() === lc))
      || (CAPITALS[key] ? (all || []).find((x) => (x.capital || []).some((cc) => flat(cc) === flat(CAPITALS[key]))) : (all || [])[0]);
    if (!c) { const b = builtIn(false); if (b === 'answered') return 'country'; if (b) return 'none'; el.innerHTML = '<h2>' + esc(q.name) + '</h2><p>I only know countries this way so far, and I didn\'t find “' + esc(q.name) + '”. Try “what is ' + esc(q.name) + '” for a page about it.</p>'; return 'none'; }
    // the countries on its borders by name (one more call, only when asked; their codes if it fails)
    let borderNames = [];
    if (q.want === 'borders' && Array.isArray(c.borders) && c.borders.length) {
      try { const b = await fetch('https://restcountries.com/v3.1/alpha?codes=' + c.borders.map(encodeURIComponent).join(',') + '&fields=name').then((x) => x.json()); borderNames = (b || []).map((x) => x.name && x.name.common).filter(Boolean).sort(); } catch (_) {}
      if (!borderNames.length) borderNames = c.borders.slice();
      if (!api._pageStill(el)) return 'country';
    }
    const all5 = rowsOf(c, borderNames), extra = ['continent', 'borders', 'calling', 'drives', 'time'];
    const rows = Object.fromEntries(Object.entries(all5).filter(([k, v]) => k === q.want || (!extra.includes(k) && v[1]) || (extra.includes(k) && k !== 'borders' && v[1])));
    const main = rows[q.want] && rows[q.want][1] ? rows[q.want] : q.want in all5 ? [all5[q.want][0], 'not known'] : rows.capital;
    const rest = Object.entries(rows).filter(([k]) => rows[k] !== main && k !== q.want).map(([, v]) => '<li><b>' + esc(v[0]) + '</b> <span style="color:#9a9a9a">— ' + esc(v[1]) + '</span></li>').join('');
    el.innerHTML = '<h2>' + esc((c.flag ? c.flag + ' ' : '') + c.name.common) + '</h2><div class="sub">' + esc(main[0]) + '</div>'
      + '<div style="font-size:44px;font-weight:300;line-height:1.15;margin:6px 0 8px">' + esc(main[1]) + '</div>'
      + '<ul>' + rest + '</ul><div class="sub">' + esc([c.subregion, c.region].filter(Boolean).join(', ')) + '</div>'
      + '<div class="src">Source: <a href="https://restcountries.com/" target="_blank" rel="noopener">REST Countries</a></div>';
    return 'country';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    // keep what Void knows on the page (the capital, with a note that the asked field is not available) rather than an error
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
