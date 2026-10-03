/**
 * air skill - Open-Meteo Air Quality + geocoding, no key
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "air quality in Tokyo", "AQI in London", "is the air good in Paris", "what's the air quality in New York".
 * Shows US AQI with a clear label, category, dominant pollutant, short guidance, and dated Open-Meteo sources.
 */
const US_BANDS = [
  { max: 50, label: 'Good', tip: 'Air looks clear. Everyday outdoor plans are fine.' },
  { max: 100, label: 'Moderate', tip: 'Most people are fine outdoors; sensitive folks may take it easier.' },
  { max: 150, label: 'Unhealthy for Sensitive Groups', tip: 'Kids, elders, and anyone with lung or heart issues should cut back outdoor time.' },
  { max: 200, label: 'Unhealthy', tip: 'Everyone benefits from shorter outdoor time and lighter activity.' },
  { max: 300, label: 'Very Unhealthy', tip: 'Stay indoors when you can; keep windows closed and ease outdoor plans.' },
  { max: Infinity, label: 'Hazardous', tip: 'Avoid outdoor activity. Follow local health advice.' }
];
const POLLUTANTS = [
  { key: 'us_aqi_pm2_5', name: 'PM2.5' },
  { key: 'us_aqi_pm10', name: 'PM10' },
  { key: 'us_aqi_ozone', name: 'Ozone' },
  { key: 'us_aqi_nitrogen_dioxide', name: 'Nitrogen dioxide' },
  { key: 'us_aqi_sulphur_dioxide', name: 'Sulphur dioxide' },
  { key: 'us_aqi_carbon_monoxide', name: 'Carbon monoxide' }
];

function airPlace(text) {
  const t = String(text || '').trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/\b(?:in|at|for|near)\s+(.+)$/i);
  if (m) return m[1].replace(/\b(today|now|right now|this (?:morning|afternoon|evening|week))\b/ig, '').trim();
  return t.replace(/\b(what'?s|what is|how'?s|how is|is|the|air\s*quality|a\.?q\.?i\.?|good|bad|clean|safe|ok|okay|healthy|like|there)\b/ig, ' ').replace(/\s+/g, ' ').trim();
}

function bandOf(aqi) {
  const n = Number(aqi);
  if (!Number.isFinite(n)) return null;
  return US_BANDS.find((b) => n <= b.max) || US_BANDS[US_BANDS.length - 1];
}

function dominantOf(cur) {
  let best = null;
  for (const p of POLLUTANTS) {
    const v = Number(cur[p.key]);
    if (!Number.isFinite(v)) continue;
    if (!best || v > best.v) best = { name: p.name, v };
  }
  return best;
}

function asOf(iso) {
  if (!iso) return new Date().toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  const d = new Date(/T/.test(iso) ? iso : iso + 'T00:00:00');
  if (Number.isNaN(+d)) return String(iso);
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
    + ( /T\d/.test(iso) ? ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const place = airPlace(text);
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(place || 'Air quality') + '</h2><div class="sub">.</div>'; });
  try {
    let loc = null;
    if (place) {
      const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(place)).then((r) => r.json());
      const r0 = g.results && g.results[0];
      if (r0) loc = { latitude: r0.latitude, longitude: r0.longitude, name: r0.name + (r0.admin1 && r0.admin1 !== r0.name ? ', ' + r0.admin1 : '') + (r0.country ? ', ' + r0.country : '') };
    }
    if (!api._pageStill(el)) return 'air';
    if (!loc) {
      el.innerHTML = '<h2>Air quality</h2><p>' + (place
        ? 'I couldn\'t find "' + esc(place) + '". Try a city name, like "air quality in Tokyo".'
        : 'Where? Try "air quality in Tokyo" or "AQI in London".') + '</p>';
      return place ? 'none' : 'air';
    }
    const u = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + loc.latitude + '&longitude=' + loc.longitude
      + '&current=us_aqi,european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,us_aqi_pm2_5,us_aqi_pm10,us_aqi_ozone,us_aqi_nitrogen_dioxide,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide&timezone=auto';
    const aq = await fetch(u).then((r) => r.json());
    if (!api._pageStill(el)) return 'air';
    const c = aq.current || {};
    const aqi = c.us_aqi;
    const band = bandOf(aqi);
    if (aqi == null || !band) {
      el.innerHTML = '<h2>' + esc(loc.name) + '</h2><p>Air quality for that place isn\'t available right now. Ask again in a moment.</p>';
      return 'none';
    }
    const dom = dominantOf(c);
    const when = asOf(c.time);
    el.innerHTML = '<h2>' + esc(loc.name) + '</h2>'
      + '<div class="sub">US AQI · ' + esc(band.label) + (dom ? ' · mainly ' + esc(dom.name) : '') + '</div>'
      + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + esc(String(Math.round(aqi))) + '</div>'
      + '<p>' + esc(band.tip) + '</p>'
      + (c.european_aqi != null ? '<p style="color:#8a8a8a">European AQI ' + esc(String(Math.round(c.european_aqi))) + (c.pm2_5 != null ? ' · PM2.5 ' + esc(String(c.pm2_5)) + ' μg/m³' : '') + '</p>' : '')
      + '<div class="src">Source: <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noopener">Open-Meteo Air Quality</a> · as of ' + esc(when) + '</div>';
    return 'air';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Air quality</h2><p>The air quality service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'air',
  examples: [
    'air quality in Tokyo',
    'AQI in London',
    'is the air good in Paris',
    'what\'s the air quality in New York',
    'how is the air in Berlin'
  ],
  nearMisses: [
    'weather in Tokyo',
    'quality time with family',
    'play the song Air',
    'what does fresh air mean',
    'air conditioner settings'
  ],
  match(lower, text) {
    if (/\b(weather|forecast|temperature)\b/.test(lower) && !/\b(air\s*quality|a\.?q\.?i\.?)\b/.test(lower)) return false;
    if (/\bquality\s+time\b/.test(lower)) return false;
    if (/\b(song|album|band|music|conditioner|force|guitar|jordan|jordans)\b/.test(lower) && !/\b(air\s*quality|a\.?q\.?i\.?)\b/.test(lower)) return false;
    return /\b(air\s*quality|a\.?q\.?i\.?)\b/.test(lower)
      || /\bis\s+the\s+air\s+(good|bad|clean|safe|ok|okay|healthy|clear)\b/.test(lower)
      || /\bhow(?:'?s|\s+is)\s+the\s+air\b/.test(lower);
  },
  run
};
