/**
 * quake skill — recent earthquakes from the USGS feed, no key
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "recent earthquakes", "earthquakes near Japan", "any big earthquakes today".
 * A definition ask ("what is an earthquake") stays with the article page.
 */
function quakeAsk(text) {
  const t = String(text || '').trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  if (!/\b(earthquakes?|quakes?|seismic)\b/i.test(t)) return null;
  if (/\b(what is|what's|whats|explain|define|meaning of|movie|film|song|album|book)\b/i.test(t) && !/\b(recent|latest|today|near|around|any)\b/i.test(t)) return null;
  const m = t.match(/\b(?:near|around|in|at)\s+(.+)$/i);
  const place = m ? m[1].replace(/\b(today|now|right now|this (?:morning|week))\b/ig, '').trim() : '';
  return { place };
}

function whenOf(ms) {
  const d = new Date(ms);
  if (Number.isNaN(+d)) return '';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = quakeAsk(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Earthquakes</h2><div class="sub">…</div>'; });
  try {
    let loc = null;
    if (q.place) {
      const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(q.place)).then((r) => r.json());
      const r0 = g.results && g.results[0];
      if (r0) loc = { latitude: r0.latitude, longitude: r0.longitude, name: r0.name + (r0.country ? ', ' + r0.country : '') };
    }
    if (!api._pageStill(el)) return 'quake';
    if (q.place && !loc) {
      el.innerHTML = '<h2>Earthquakes</h2><p>I couldn\'t find "' + esc(q.place) + '". Try a city or region, or just "recent earthquakes".</p>';
      return 'none';
    }
    let u = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=8&orderby=time&minmagnitude=4.5';
    if (loc) u += '&latitude=' + loc.latitude + '&longitude=' + loc.longitude + '&maxradiuskm=800';
    const data = await fetch(u).then((r) => r.json());
    if (!api._pageStill(el)) return 'quake';
    const rows = (data.features || []).filter((f) => f.properties && f.properties.mag != null);
    if (!rows.length) {
      el.innerHTML = '<h2>' + esc(loc ? loc.name : 'Earthquakes') + '</h2><p>No magnitude 4.5 or larger in that window. Smaller ones are left off on purpose.</p>'
        + '<div class="src">Source: <a href="https://earthquake.usgs.gov/earthquakes/map/" target="_blank" rel="noopener">USGS</a></div>';
      return 'quake';
    }
    const lis = rows.map((f) => {
      const p = f.properties;
      const href = p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.place || 'event') + '</a>' : esc(p.place || 'event');
      return '<li><b>M ' + esc(String(p.mag)) + '</b> · ' + href + (p.time ? ' <span style="color:#8a8a8a">· ' + esc(whenOf(p.time)) + '</span>' : '') + '</li>';
    }).join('');
    el.innerHTML = '<h2>' + esc(loc ? 'Near ' + loc.name : 'Recent earthquakes') + '</h2>'
      + '<div class="sub">Magnitude 4.5 and up · newest first</div><ul>' + lis + '</ul>'
      + '<div class="src">Source: <a href="https://earthquake.usgs.gov/earthquakes/map/" target="_blank" rel="noopener">USGS</a></div>';
    return 'quake';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Earthquakes</h2><p>The earthquake feed didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'quake',
  examples: ['recent earthquakes', 'earthquakes near Japan', 'any big earthquakes today', 'quakes around Chile'],
  nearMisses: ['what is an earthquake', 'earthquake movie', 'weather in Japan', 'air quality in Tokyo'],
  match(lower, text) { return !!quakeAsk(text); },
  run
};
