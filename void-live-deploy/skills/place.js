/**
 * place skill — street map of any place. Open-Meteo geocoding + OpenStreetMap embed, no key.
 * Contract: { name, examples, match(lower, text), run(text, api) }
 */
function placeOf(text) {
  const t = text.trim().replace(/[?!.]+$/, '');
  const m = t.match(/^(?:show\s+(?:me\s+)?)?(?:a\s+|the\s+)?(?:street\s+)?map\s+(?:of|for)\s+(.+)$/i)
    || t.match(/^where\s+(?:is|are|'s)\s+(.+)$/i)
    || t.match(/^(?:streets|neighbou?rhood|area)\s+(?:around|near|of)\s+(.+)$/i)
    || t.match(/^(.+?)\s+(?:street\s+)?map$/i);
  if (!m) return null;
  const p = m[1].replace(/^(the\s+)/i, '').trim();
  if (!p || /^(everything|the map|you|i|my \w+)$/i.test(p)) return null;
  return p;
}

const label = (r) => r.name + (r.admin1 && r.admin1 !== r.name ? ', ' + r.admin1 : '') + (r.country ? ', ' + r.country : '');

function draw(el, r, others, api) {
  const { esc } = api;
  const zoomSpan = r.population > 1000000 ? 0.18 : r.population > 100000 ? 0.08 : 0.03;
  const bbox = [r.longitude - zoomSpan, r.latitude - zoomSpan * 0.6, r.longitude + zoomSpan, r.latitude + zoomSpan * 0.6].join(',');
  const src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + '&layer=mapnik&marker=' + r.latitude + ',' + r.longitude;
  const big = 'https://www.openstreetmap.org/?mlat=' + r.latitude + '&mlon=' + r.longitude + '#map=' + (zoomSpan > 0.1 ? 11 : zoomSpan > 0.05 ? 13 : 15) + '/' + r.latitude + '/' + r.longitude;
  const alt = others.filter((o) => o !== r).slice(0, 4);
  el.innerHTML = '<h2>' + esc(r.name) + '</h2><div class="sub">' + esc(label(r).split(', ').slice(1).join(', ')) + '</div>'
    + '<iframe title="map" src="' + src + '" style="width:100%;height:340px;border:0;border-radius:10px;margin:8px 0;filter:saturate(.85)" loading="lazy"></iframe>'
    + (alt.length ? '<div class="sub">Other places with this name: ' + alt.map((o, i) => '<a href="#" data-alt="' + i + '">' + esc(label(o)) + '</a>').join(' · ') + '</div>' : '')
    + '<div class="src">Source: <a href="' + big + '" target="_blank" rel="noopener">OpenStreetMap</a></div>';
  el.querySelectorAll('[data-alt]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); draw(el, alt[+a.dataset.alt], others, api); }));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const place = placeOf(text);
  if (!place) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(place) + '</h2><div class="sub">…</div>'; });
  try {
    const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&name=' + encodeURIComponent(place)).then((r) => r.json());
    if (!api._pageStill(el)) return 'place';
    const rs = (g.results || []).sort((a, b) => (b.population || 0) - (a.population || 0));
    if (!rs.length) { el.innerHTML = '<h2>' + esc(place) + '</h2><p>I couldn\'t find that place yet. Try a city or town name, like "map of Lisbon".</p>'; if (api.reportMiss) api.reportMiss(text); return 'none'; }
    draw(el, rs[0], rs, api);
    return 'place';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(place) + '</h2><p>The map service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'place',
  examples: ['map of Lisbon', 'where is Kyoto', 'streets around Penn Station', 'Paris map'],
  match(lower, text) { return !!placeOf(text); },
  run
};
