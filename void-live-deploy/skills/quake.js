/**
 * quake skill - recent earthquakes from USGS (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "earthquakes near Tokyo", "recent earthquakes", "was there an earthquake in California",
 * "biggest quake today", "quakes around Lisbon".
 * Shows magnitude, place, time, depth, and a USGS map link. Safety note when strong nearby.
 */
const TYPES = /\b(earth\s*quakes?|quakes?|tremors?|seismic\s+(?:activity|event|events))\b/;

function placeOf(text) {
  const t = String(text || '').trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/\b(?:near|around|by|in|at|for|close\s+to)\s+(.+)$/i);
  if (!m) return '';
  return m[1]
    .replace(/\b(today|tonight|this\s+(?:morning|afternoon|evening|week)|recent(?:ly)?|lately|now|right\s+now)\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ago(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return 'just now';
  if (sec < 3600) { const m = Math.round(sec / 60); return m + (m === 1 ? ' minute ago' : ' minutes ago'); }
  if (sec < 86400) { const h = Math.round(sec / 3600); return h + (h === 1 ? ' hour ago' : ' hours ago'); }
  const d = Math.round(sec / 86400);
  return d + (d === 1 ? ' day ago' : ' days ago');
}

function band(mag) {
  const n = Number(mag);
  if (!Number.isFinite(n)) return { label: '', tip: '' };
  if (n < 3) return { label: 'Minor', tip: 'Usually felt only nearby, if at all.' };
  if (n < 4) return { label: 'Light', tip: 'Often felt; little or no damage.' };
  if (n < 5) return { label: 'Moderate', tip: 'Can shake buildings; check local guidance if nearby.' };
  if (n < 6) return { label: 'Strong', tip: 'Can cause damage. Follow local alerts if you are close.' };
  if (n < 7) return { label: 'Major', tip: 'Serious shaking. Follow official emergency guidance if nearby.' };
  return { label: 'Great', tip: 'Widespread effects. Follow official emergency guidance.' };
}

async function geo(name) {
  const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(name)).then((r) => r.json());
  const r0 = g.results && g.results[0];
  if (!r0) return null;
  return {
    latitude: r0.latitude,
    longitude: r0.longitude,
    name: r0.name + (r0.admin1 && r0.admin1 !== r0.name ? ', ' + r0.admin1 : '') + (r0.country ? ', ' + r0.country : '')
  };
}

function rowHtml(f, esc) {
  const p = f.properties || {};
  const c = (f.geometry && f.geometry.coordinates) || [];
  const mag = p.mag;
  const b = band(mag);
  const when = p.time ? new Date(p.time).toISOString() : '';
  const depth = c[2] != null ? Math.round(c[2]) + ' km deep' : '';
  const href = p.url || ('https://earthquake.usgs.gov/earthquakes/eventpage/' + (p.ids || '').replace(/^,|,.*$/g, ''));
  return '<li style="margin:8px 0">'
    + '<b>M' + esc(String(mag != null ? Math.round(mag * 10) / 10 : '?')) + '</b>'
    + (b.label ? ' · ' + esc(b.label) : '')
    + ' — ' + esc(p.place || 'Unknown place')
    + '<div style="color:#8a8a8a;font-size:13px">'
    + esc(ago(when) || '')
    + (depth ? ' · ' + esc(depth) : '')
    + (p.url ? ' · <a href="' + esc(href) + '" target="_blank" rel="noopener">USGS</a>' : '')
    + '</div></li>';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const place = placeOf(text);
  const title = place ? 'Earthquakes near ' + place : 'Recent earthquakes';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">.</div>'; });
  try {
    let loc = null;
    if (place) {
      loc = await geo(place);
      if (!api._pageStill(el)) return 'quake';
      if (!loc) {
        el.innerHTML = '<h2>Earthquakes</h2><p>I couldn\'t find "' + esc(place) + '". Try a city or region, like "earthquakes near Tokyo".</p>';
        return 'none';
      }
    }
    const start = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    let url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=' + start
      + '&orderby=time&limit=8';
    if (loc) {
      url += '&latitude=' + loc.latitude + '&longitude=' + loc.longitude + '&maxradiuskm=500&minmagnitude=2.5';
    } else {
      url += '&minmagnitude=4.5';
    }
    const j = await fetch(url).then((r) => r.json());
    if (!api._pageStill(el)) return 'quake';
    const feats = (j && j.features) || [];
    const where = loc ? loc.name : 'worldwide (M4.5+)';
    if (!feats.length) {
      el.innerHTML = '<h2>' + esc(loc ? 'Near ' + loc.name : 'Recent earthquakes') + '</h2>'
        + '<p>No matching quakes in the last week' + (loc ? ' within about 500 km' : '') + '.</p>'
        + '<div class="src">Source: <a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener">USGS</a></div>';
      return 'quake';
    }
    const top = feats[0];
    const topMag = top.properties && top.properties.mag;
    const tip = band(topMag).tip;
    el.innerHTML = '<h2>' + esc(loc ? 'Near ' + loc.name : 'Recent earthquakes') + '</h2>'
      + '<div class="sub">' + esc(where) + ' · last 7 days</div>'
      + '<ul style="list-style:none;padding:0;margin:8px 0">' + feats.map((f) => rowHtml(f, esc)).join('') + '</ul>'
      + (tip ? '<p style="color:#8a8a8a">' + esc(tip) + '</p>' : '')
      + '<p style="color:#8a8a8a">For alerts and safety steps, use your local emergency service. This is a public USGS feed, not a warning system.</p>'
      + '<div class="src">Source: <a href="https://earthquake.usgs.gov/fdsnws/event/1/" target="_blank" rel="noopener">USGS Earthquake Catalog</a></div>';
    return 'quake';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Earthquakes</h2><p>The earthquake service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'quake',
  examples: [
    'earthquakes near Tokyo',
    'recent earthquakes',
    'was there an earthquake in California',
    'quakes around Lisbon',
    'biggest quake today'
  ],
  nearMisses: [
    'weather in Tokyo',
    'air quality in Lisbon',
    'what is an earthquake',
    'map of California',
    'UV index in Miami'
  ],
  match(lower, text) {
    if (/\b(what\s+is|define|meaning\s+of|wikipedia)\b/.test(lower) && TYPES.test(lower)) return false;
    if (/\b(weather|forecast|air\s*quality|a\.?q\.?i\.?|uv\s*index)\b/.test(lower)) return false;
    if (/\bearthquake\s+(proof|insurance|drill|engineering)\b/.test(lower)) return false;
    return TYPES.test(lower)
      || /\b(was\s+there\s+an?\s+earth\s*quake|any\s+earth\s*quakes?|seismic\s+activity)\b/.test(lower);
  },
  run
};
