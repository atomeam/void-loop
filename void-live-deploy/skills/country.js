/**
 * country skill — capital, population, currency, languages and area of a country, from REST Countries (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "capital of Australia", "population of Japan", "what currency does Brazil use", "languages spoken in Switzerland".
 */
const FIELDS = { capital: 'capital', population: 'population', currency: 'currencies', currencies: 'currencies', language: 'languages', languages: 'languages', area: 'area', flag: 'flags', size: 'area' };
export function countryOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:what(?:'s| is| are)\s+)?(?:the\s+)?(capital|population|currency|currencies|official\s+languages?|languages?|area|size|flag)(?:\s+city)?\s+of\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m) return { want: FIELDS[m[1].toLowerCase().replace(/^official\s+/, '')] || 'all', name: m[2].trim() };
  m = t.match(/^(?:what|which)\s+(currency|languages?)\s+(?:does|do|is|are)\s+(?:used\s+in|spoken\s+in)?\s*(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40}?)(?:\s+(?:use|speak|have))?$/i);
  if (m) return { want: FIELDS[m[1].toLowerCase()], name: m[2].trim() };
  m = t.match(/^how\s+many\s+people\s+live\s+in\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m) return { want: 'population', name: m[1].trim() };
  m = t.match(/^(?:what\s+)?languages?\s+(?:are\s+|is\s+)?spoken\s+in\s+(?:the\s+)?([A-Za-zÀ-ÿ' .-]{3,40})$/i);
  if (m) return { want: 'languages', name: m[1].trim() };
  return null;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = countryOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(q.name) + '</h2><div class="sub">…</div>'; });
  try {
    const r = await fetch('https://restcountries.com/v3.1/name/' + encodeURIComponent(q.name) + '?fields=name,capital,population,currencies,languages,area,flag,region,subregion');
    const all = r.ok ? await r.json() : [];
    if (!api._pageStill(el)) return 'country';
    const lc = q.name.toLowerCase();
    const c = (all || []).find((x) => x.name && (x.name.common.toLowerCase() === lc || x.name.official.toLowerCase() === lc)) || (all || [])[0];
    if (!c) { el.innerHTML = '<h2>' + esc(q.name) + '</h2><p>I only know countries this way so far, and I didn\'t find “' + esc(q.name) + '”. Try “what is ' + esc(q.name) + '” for a page about it.</p>'; return 'none'; }
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
