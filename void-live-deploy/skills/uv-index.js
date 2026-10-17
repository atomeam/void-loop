/**
 * uv-index skill — current UV index for a city, from Open-Meteo (no key).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "UV index in Tokyo", "what's the UV in London", "is the UV high in Sydney".
 * Shows the current UV index, WHO category, and short protection tip. Empty surface stays empty.
 */
const BANDS = [
  { max: 2, label: 'Low', tip: 'No protection needed. You can safely stay outside.' },
  { max: 5, label: 'Moderate', tip: 'Take precautions: seek shade during midday, wear a hat and sunscreen.' },
  { max: 7, label: 'High', tip: 'Protection required: reduce time in the sun, wear a hat, sunglasses and sunscreen.' },
  { max: 10, label: 'Very High', tip: 'Extra protection needed: avoid the sun between 11 and 3, use SPF 30+.' },
  { max: Infinity, label: 'Extreme', tip: 'Stay indoors if you can. Unprotected skin can burn in minutes.' },
];

function placeOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/\b(?:in|at|for|near)\s+(.+)$/i);
  if (m) return m[1].replace(/\b(today|now|right now|this (?:morning|afternoon|evening))\b/ig, '').trim();
  return t.replace(/\b(what'?s|what is|how'?s|how is|is|the|uv|index|high|low|good|bad|safe)\b/ig, ' ').replace(/\s+/g, ' ').trim();
}

function bandOf(uv) {
  const n = Number(uv);
  if (!Number.isFinite(n)) return null;
  return BANDS.find((b) => n <= b.max) || BANDS[BANDS.length - 1];
}

async function run(text, api) {
  const { showPage, esc } = api;
  const place = placeOf(text);
  if (!place || place.length < 2) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>UV index · ' + esc(place) + '</h2><div class="sub">looking up…</div>'; });
  try {
    const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(place)).then((r) => r.json());
    const r0 = g.results && g.results[0];
    if (!api._pageStill(el)) return 'uv-index';
    if (!r0) {
      el.innerHTML = '<h2>UV index</h2><p>Could not find “' + esc(place) + '”. Try a city name.</p>';
      return 'none';
    }
    const loc = { lat: r0.latitude, lon: r0.longitude, name: r0.name + (r0.admin1 && r0.admin1 !== r0.name ? ', ' + r0.admin1 : '') + (r0.country ? ', ' + r0.country : '') };
    const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon + '&current=uv_index&timezone=auto';
    const w = await fetch(u).then((r) => r.json());
    if (!api._pageStill(el)) return 'uv-index';
    const uv = w.current && w.current.uv_index;
    const band = bandOf(uv);
    if (uv == null || !band) {
      el.innerHTML = '<h2>' + esc(loc.name) + '</h2><p>UV index is not available for that place right now.</p>';
      return 'none';
    }
    const when = w.current.time ? new Date(w.current.time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'now';
    el.innerHTML = '<h2>' + esc(loc.name) + '</h2>'
      + '<div class="sub">UV index · ' + esc(band.label) + '</div>'
      + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + esc(String(Math.round(uv * 10) / 10)) + '</div>'
      + '<p>' + esc(band.tip) + '</p>'
      + '<div class="src">Source: <a href="https://open-meteo.com/en/docs" target="_blank" rel="noopener">Open-Meteo</a> · as of ' + esc(when) + '</div>';
    return 'uv-index';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>UV index</h2><p>The weather service did not answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'uv-index',
  examples: ['UV index in Tokyo', 'what\'s the UV in London', 'is the UV high in Sydney'],
  nearMisses: ['weather in Tokyo', 'air quality in Paris', 'what does UV mean', 'uv light for plants'],
  match(lower, text) {
    if (/\b(weather|forecast|temperature|air\s*quality|a\.?q\.?i\.?)\b/.test(lower) && !/\buv\b/.test(lower)) return false;
    return /\buv\s*(index)?\b/.test(lower) || /\b(ultraviolet|sun\s*index)\b/.test(lower);
  },
  run,
  suite() {
    return { ok: placeOf('UV index in Tokyo') === 'Tokyo' && placeOf('hello') === 'hello' };
  },
};
