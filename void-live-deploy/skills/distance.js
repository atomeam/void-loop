/**
 * distance skill — how far one place is from another, as the crow flies (Open-Meteo places, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "distance from London to Paris", "how far is Tokyo from Osaka", "how far from New York to Boston".
 */
export function placesOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:what(?:'s| is)\s+the\s+)?distance\s+(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+)$/i)
    || t.match(/^how\s+far\s+(?:is\s+it\s+)?from\s+(.+?)\s+to\s+(.+)$/i);
  if (m) return { a: m[1].trim(), b: m[2].trim() };
  const n = t.match(/^how\s+far\s+(?:away\s+)?is\s+(.+?)\s+from\s+(.+)$/i);
  if (n) return { a: n[2].trim(), b: n[1].trim() };
  return null;
}
async function geo(name) {
  const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=' + encodeURIComponent(name.split(',')[0])).then((r) => r.json());
  return ((g && g.results) || []).sort((x, y) => (y.population || 0) - (x.population || 0))[0] || null;
}
function km(a, b) {
  const R = 6371.0088, rad = (d) => d * Math.PI / 180;
  const dl = rad(b.latitude - a.latitude), dn = rad(b.longitude - a.longitude);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = placesOf(text);
  if (!q) return 'none';
  const title = q.a + ' → ' + q.b;
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">…</div>'; });
  try {
    const [a, b] = await Promise.all([geo(q.a), geo(q.b)]);
    if (!api._pageStill(el)) return 'distance';
    if (!a || !b) { el.innerHTML = '<h2>' + esc(title) + '</h2><p>I couldn\'t find “' + esc(!a ? q.a : q.b) + '”. Try a city name.</p>'; return 'none'; }
    const d = km(a, b), mi = d * 0.621371;
    const lab = (r) => r.name + (r.country ? ', ' + r.country : '');
    el.innerHTML = '<h2>' + esc(a.name + ' → ' + b.name) + '</h2><div class="sub">' + esc(lab(a)) + ' to ' + esc(lab(b)) + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(Math.round(d).toLocaleString()) + ' km</div>'
      + '<p style="color:#8a8a8a">' + esc(Math.round(mi).toLocaleString()) + ' miles, in a straight line (roads are longer)</p>'
      + '<p class="dir-links">Route: <a href="https://www.openstreetmap.org/directions?from=' + a.latitude + '%2C' + a.longitude + '&to=' + b.latitude + '%2C' + b.longitude + '" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://www.google.com/maps/dir/?api=1&origin=' + a.latitude + '%2C' + a.longitude + '&destination=' + b.latitude + '%2C' + b.longitude + '" target="_blank" rel="noopener">Google Maps</a></p>'
      + '<div class="src">Source: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (places) · great-circle distance</div>';
    return 'distance';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(title) + '</h2><p>The place service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}
export default {
  name: 'distance',
  examples: ['distance from London to Paris', 'how far is Tokyo from Osaka', 'how far from New York to Boston'],
  nearMisses: ['how far is the moon', 'distance learning', 'map of Paris', 'time difference between London and Tokyo'],
  match(lower, text) { const p = placesOf(text); return !!p && !/\b(moon|sun|mars|space|stars?)\b/i.test(p.a + ' ' + p.b); },
  run
};
