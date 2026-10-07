/**
 * country skill — capital, population, currency, languages and area of a country, from REST Countries (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "capital of Australia", "population of Japan", "what currency does Brazil use", "languages spoken in Switzerland".
 */
const FIELDS = { capital: 'capital', population: 'population', currency: 'currencies', currencies: 'currencies', language: 'languages', languages: 'languages', area: 'area', flag: 'flags', size: 'area' };
export function countryOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:what(?:'?s| is| are)\s+)?(?:the\s+)?(capital|population|currency|currencies|official\s+languages?|languages?|area|size|flag)(?:\s+city)?\s+of\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m) return { want: FIELDS[m[1].toLowerCase().replace(/^official\s+/, '')] || 'all', name: m[2].trim() };
  m = t.match(/^(?:what|which)\s+(currency|languages?)\s+(?:does|do|is|are)\s+(?:used\s+in|spoken\s+in)?\s*(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40}?)(?:\s+(?:use|speak|have))?$/i);
  if (m) return { want: FIELDS[m[1].toLowerCase()], name: m[2].trim() };
  m = t.match(/^how\s+many\s+people\s+live\s+in\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m) return { want: 'population', name: m[1].trim() };
  m = t.match(/^(?:what\s+)?languages?\s+(?:are\s+|is\s+)?spoken\s+in\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m) return { want: 'languages', name: m[1].trim() };
  return null;
}
// Built-in capitals (UN members and common names), used only when REST Countries does not answer, so a capital ask never fails.
const CAPITALS = {"afghanistan": "Kabul", "albania": "Tirana", "algeria": "Algiers", "andorra": "Andorra la Vella", "angola": "Luanda", "antigua and barbuda": "Saint John's", "argentina": "Buenos Aires", "armenia": "Yerevan", "australia": "Canberra", "austria": "Vienna", "azerbaijan": "Baku", "bahamas": "Nassau", "bahrain": "Manama", "bangladesh": "Dhaka", "barbados": "Bridgetown", "belarus": "Minsk", "belgium": "Brussels", "belize": "Belmopan", "benin": "Porto-Novo", "bhutan": "Thimphu", "bolivia": "Sucre", "bosnia and herzegovina": "Sarajevo", "botswana": "Gaborone", "brazil": "Brasília", "brunei": "Bandar Seri Begawan", "bulgaria": "Sofia", "burkina faso": "Ouagadougou", "burundi": "Gitega", "cabo verde": "Praia", "cape verde": "Praia", "cambodia": "Phnom Penh", "cameroon": "Yaoundé", "canada": "Ottawa", "central african republic": "Bangui", "chad": "N'Djamena", "chile": "Santiago", "china": "Beijing", "colombia": "Bogotá", "comoros": "Moroni", "congo": "Brazzaville", "republic of the congo": "Brazzaville", "democratic republic of the congo": "Kinshasa", "dr congo": "Kinshasa", "drc": "Kinshasa", "costa rica": "San José", "ivory coast": "Yamoussoukro", "côte d'ivoire": "Yamoussoukro", "cote d'ivoire": "Yamoussoukro", "croatia": "Zagreb", "cuba": "Havana", "cyprus": "Nicosia", "czechia": "Prague", "czech republic": "Prague", "denmark": "Copenhagen", "djibouti": "Djibouti", "dominica": "Roseau", "dominican republic": "Santo Domingo", "ecuador": "Quito", "egypt": "Cairo", "el salvador": "San Salvador", "equatorial guinea": "Malabo", "eritrea": "Asmara", "estonia": "Tallinn", "eswatini": "Mbabane", "swaziland": "Mbabane", "ethiopia": "Addis Ababa", "fiji": "Suva", "finland": "Helsinki", "france": "Paris", "gabon": "Libreville", "gambia": "Banjul", "georgia": "Tbilisi", "germany": "Berlin", "ghana": "Accra", "greece": "Athens", "grenada": "St. George's", "guatemala": "Guatemala City", "guinea": "Conakry", "guinea-bissau": "Bissau", "guyana": "Georgetown", "haiti": "Port-au-Prince", "honduras": "Tegucigalpa", "hungary": "Budapest", "iceland": "Reykjavík", "india": "New Delhi", "indonesia": "Jakarta", "iran": "Tehran", "iraq": "Baghdad", "ireland": "Dublin", "israel": "Jerusalem", "italy": "Rome", "jamaica": "Kingston", "japan": "Tokyo", "jordan": "Amman", "kazakhstan": "Astana", "kenya": "Nairobi", "kiribati": "Tarawa", "north korea": "Pyongyang", "south korea": "Seoul", "korea": "Seoul", "kuwait": "Kuwait City", "kyrgyzstan": "Bishkek", "laos": "Vientiane", "latvia": "Riga", "lebanon": "Beirut", "lesotho": "Maseru", "liberia": "Monrovia", "libya": "Tripoli", "liechtenstein": "Vaduz", "lithuania": "Vilnius", "luxembourg": "Luxembourg", "madagascar": "Antananarivo", "malawi": "Lilongwe", "malaysia": "Kuala Lumpur", "maldives": "Malé", "mali": "Bamako", "malta": "Valletta", "marshall islands": "Majuro", "mauritania": "Nouakchott", "mauritius": "Port Louis", "mexico": "Mexico City", "micronesia": "Palikir", "moldova": "Chișinău", "monaco": "Monaco", "mongolia": "Ulaanbaatar", "montenegro": "Podgorica", "morocco": "Rabat", "mozambique": "Maputo", "myanmar": "Naypyidaw", "burma": "Naypyidaw", "namibia": "Windhoek", "nauru": "Yaren", "nepal": "Kathmandu", "netherlands": "Amsterdam", "holland": "Amsterdam", "new zealand": "Wellington", "nicaragua": "Managua", "niger": "Niamey", "nigeria": "Abuja", "north macedonia": "Skopje", "macedonia": "Skopje", "norway": "Oslo", "oman": "Muscat", "pakistan": "Islamabad", "palau": "Ngerulmud", "panama": "Panama City", "papua new guinea": "Port Moresby", "paraguay": "Asunción", "peru": "Lima", "philippines": "Manila", "poland": "Warsaw", "portugal": "Lisbon", "qatar": "Doha", "romania": "Bucharest", "russia": "Moscow", "rwanda": "Kigali", "saint kitts and nevis": "Basseterre", "saint lucia": "Castries", "saint vincent and the grenadines": "Kingstown", "samoa": "Apia", "san marino": "San Marino", "sao tome and principe": "São Tomé", "são tomé and príncipe": "São Tomé", "saudi arabia": "Riyadh", "senegal": "Dakar", "serbia": "Belgrade", "seychelles": "Victoria", "sierra leone": "Freetown", "singapore": "Singapore", "slovakia": "Bratislava", "slovenia": "Ljubljana", "solomon islands": "Honiara", "somalia": "Mogadishu", "south africa": "Pretoria", "south sudan": "Juba", "spain": "Madrid", "sri lanka": "Sri Jayawardenepura Kotte", "sudan": "Khartoum", "suriname": "Paramaribo", "sweden": "Stockholm", "switzerland": "Bern", "syria": "Damascus", "tajikistan": "Dushanbe", "tanzania": "Dodoma", "thailand": "Bangkok", "timor-leste": "Dili", "east timor": "Dili", "togo": "Lomé", "tonga": "Nuku'alofa", "trinidad and tobago": "Port of Spain", "tunisia": "Tunis", "turkey": "Ankara", "türkiye": "Ankara", "turkmenistan": "Ashgabat", "tuvalu": "Funafuti", "uganda": "Kampala", "ukraine": "Kyiv", "united arab emirates": "Abu Dhabi", "uae": "Abu Dhabi", "united kingdom": "London", "uk": "London", "great britain": "London", "britain": "London", "england": "London", "scotland": "Edinburgh", "wales": "Cardiff", "united states": "Washington, D.C.", "united states of america": "Washington, D.C.", "usa": "Washington, D.C.", "us": "Washington, D.C.", "america": "Washington, D.C.", "uruguay": "Montevideo", "uzbekistan": "Tashkent", "vanuatu": "Port Vila", "vatican city": "Vatican City", "vatican": "Vatican City", "venezuela": "Caracas", "vietnam": "Hanoi", "yemen": "Sana'a", "zambia": "Lusaka", "zimbabwe": "Harare", "taiwan": "Taipei", "palestine": "Ramallah", "kosovo": "Pristina"};
async function run(text, api) {
  const { showPage, esc } = api;
  const q = countryOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(q.name) + '</h2><div class="sub">…</div>'; });
  // the built-in capital, for when the service is down or slow: answers capital asks (and names the capital for others)
  const builtIn = () => { const cap = CAPITALS[q.name.toLowerCase().replace(/^the\s+/, '')]; if (!cap || !api._pageStill(el)) return false;
    el.innerHTML = '<h2>' + esc(q.name.replace(/\b\w/g, (x) => x.toUpperCase())) + '</h2><div class="sub">Capital</div><div style="font-size:44px;font-weight:300;line-height:1.15;margin:6px 0 8px">' + esc(cap) + '</div>'
      + (q.want === 'capital' ? '' : '<p>The country service didn\'t answer just now, so only the capital is shown. Ask again in a moment for ' + esc(q.want) + '.</p>')
      + '<div class="src">From Void\'s built-in list (the live source, REST Countries, didn\'t answer)</div>';
    return q.want === 'capital'; };
  try {
    const r = await fetch('https://restcountries.com/v3.1/name/' + encodeURIComponent(q.name) + '?fields=name,capital,population,currencies,languages,area,flag,region,subregion', { signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined });
    const all = r.ok ? await r.json() : [];
    if (!api._pageStill(el)) return 'country';
    const lc = q.name.toLowerCase();
    const c = (all || []).find((x) => x.name && (x.name.common.toLowerCase() === lc || x.name.official.toLowerCase() === lc)) || (all || [])[0];
    if (!c) { if (builtIn()) return 'country'; el.innerHTML = '<h2>' + esc(q.name) + '</h2><p>I only know countries this way so far, and I didn\'t find “' + esc(q.name) + '”. Try “what is ' + esc(q.name) + '” for a page about it.</p>'; return 'none'; }
    const cur = Object.values(c.currencies || {}).map((x) => x.name + (x.symbol ? ' (' + x.symbol + ')' : '')).join(', ');
    const langs = Object.values(c.languages || {}).join(', ');
    const rows = { capital: ['Capital', (c.capital || []).join(', ') || 'none'], population: ['Population', (c.population || 0).toLocaleString()], currencies: ['Currency', cur || 'none'], languages: ['Languages', langs || 'none'], area: ['Area', Math.round(c.area || 0).toLocaleString() + ' km²'] };
    const main = rows[q.want] || rows.capital;
    const rest = Object.entries(rows).filter(([k]) => rows[k] !== main).map(([, v]) => '<li><b>' + esc(v[0]) + '</b> <span style="color:#9a9a9a">— ' + esc(v[1]) + '</span></li>').join('');
    el.innerHTML = '<h2>' + esc((c.flag ? c.flag + ' ' : '') + c.name.common) + '</h2><div class="sub">' + esc(main[0]) + '</div>'
      + '<div style="font-size:44px;font-weight:300;line-height:1.15;margin:6px 0 8px">' + esc(main[1]) + '</div>'
      + '<ul>' + rest + '</ul><div class="sub">' + esc([c.subregion, c.region].filter(Boolean).join(', ')) + '</div>'
      + '<div class="src">Source: <a href="https://restcountries.com/" target="_blank" rel="noopener">REST Countries</a></div>';
    return 'country';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    if (builtIn()) return 'country';
    el.innerHTML = '<h2>' + esc(q.name) + '</h2><p>The country service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}
export default {
  name: 'country',
  examples: ['capital of Australia', 'population of Japan', 'what currency does Brazil use', 'languages spoken in Switzerland'],
  nearMisses: ['capital letters', 'what is capitalism', 'population growth', 'weather in Japan'],
  match(lower, text) { return !!countryOf(text); },
  run
};
