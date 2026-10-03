/**
 * uv skill - Open-Meteo UV index + geocoding, no key
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "UV index in Miami", "how strong is the sun in LA", "should I wear sunscreen in Phoenix", "what's the UV in Tokyo".
 * Shows current UV (WHO scale), today's max, clear guidance, and a dated Open-Meteo source.
 */
const UV_BANDS = [
  { max: 2, label: 'Low', tip: 'Everyday outdoor plans are fine for most people. Shade and sunscreen still help if you burn easily.' },
  { max: 5, label: 'Moderate', tip: 'Seek shade around midday. Sunscreen SPF 30+, a hat, and sunglasses if you will be out for a while.' },
  { max: 7, label: 'High', tip: 'Protection matters. Sunscreen SPF 30+, hat, and shade between about 10am and 4pm.' },
  { max: 10, label: 'Very High', tip: 'Extra care outdoors. Minimize midday sun, reapply sunscreen, cover up, and use shade.' },
  { max: Infinity, label: 'Extreme', tip: 'Avoid midday sun when you can. Full protection: sunscreen, hat, long sleeves, and shade.' }
];

function uvPlace(text) {
  const t = String(text || '').trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/\b(?:in|at|for|near)\s+(.+)$/i);
  if (m) return m[1].replace(/\b(today|now|right now|this (?:morning|afternoon|evening|week)|tonight)\b/ig, '').trim();
  return t.replace(/\b(what'?s|what is|how'?s|how is|how|strong|is|the|uv\s*index|u\.?v\.?|sun|sunscreen|sunburn|wear|should|i|do|need|like|there|today|now)\b/ig, ' ').replace(/\s+/g, ' ').trim();
}

function bandOf(uv) {
  const n = Number(uv);
  if (!Number.isFinite(n)) return null;
  return UV_BANDS.find((b) => n <= b.max) || UV_BANDS[UV_BANDS.length - 1];
}

function asOf(iso) {
  if (!iso) return new Date().toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  const d = new Date(/T/.test(iso) ? iso : iso + 'T00:00:00');
  if (Number.isNaN(+d)) return String(iso);
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
    + (/T\d/.test(iso) ? ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
}

function pickHourly(hourly) {
  if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.uv_index)) return null;
  const now = Date.now();
  let best = null;
  for (let i = 0; i < hourly.time.length; i++) {
    const t = Date.parse(hourly.time[i]);
    if (Number.isNaN(t)) continue;
    const v = Number(hourly.uv_index[i]);
    if (!Number.isFinite(v)) continue;
    const row = { time: hourly.time[i], uv: v, dist: Math.abs(t - now) };
    if (!best || row.dist < best.dist) best = row;
  }
  return best;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const place = uvPlace(text);
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(place || 'UV index') + '</h2><div class="sub">…</div>'; });
  try {
    let loc = null;
    if (place) {
      const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(place)).then((r) => r.json());
      const r0 = g.results && g.results[0];
      if (r0) loc = { latitude: r0.latitude, longitude: r0.longitude, name: r0.name + (r0.admin1 && r0.admin1 !== r0.name ? ', ' + r0.admin1 : '') + (r0.country ? ', ' + r0.country : '') };
    }
    if (!api._pageStill(el)) return 'uv';
    if (!loc) {
      el.innerHTML = '<h2>UV index</h2><p>' + (place
        ? 'I couldn\'t find "' + esc(place) + '". Try a city name, like "UV index in Miami".'
        : 'Where? Try "UV index in Miami" or "how strong is the sun in LA".') + '</p>';
      return place ? 'none' : 'uv';
    }
    const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.latitude + '&longitude=' + loc.longitude
      + '&hourly=uv_index&daily=uv_index_max&timezone=auto&forecast_days=1';
    const fx = await fetch(u).then((r) => r.json());
    if (!api._pageStill(el)) return 'uv';
    const now = pickHourly(fx.hourly);
    const dayMax = fx.daily && Array.isArray(fx.daily.uv_index_max) ? Number(fx.daily.uv_index_max[0]) : NaN;
    const uv = now ? now.uv : dayMax;
    const band = bandOf(uv);
    if (!Number.isFinite(uv) || !band) {
      el.innerHTML = '<h2>' + esc(loc.name) + '</h2><p>UV for that place isn\'t available right now. Ask again in a moment.</p>';
      return 'none';
    }
    const when = asOf(now && now.time);
    const maxLine = Number.isFinite(dayMax)
      ? '<p style="color:#8a8a8a">Today\'s peak UV ' + esc(String(Math.round(dayMax * 10) / 10)) + (bandOf(dayMax) ? ' · ' + esc(bandOf(dayMax).label) : '') + '</p>'
      : '';
    el.innerHTML = '<h2>' + esc(loc.name) + '</h2>'
      + '<div class="sub">UV index · ' + esc(band.label) + '</div>'
      + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + esc(String(Math.round(uv * 10) / 10)) + '</div>'
      + '<p>' + esc(band.tip) + '</p>'
      + maxLine
      + '<div class="src">Source: <a href="https://open-meteo.com/en/docs" target="_blank" rel="noopener">Open-Meteo</a> · WHO UV scale · as of ' + esc(when) + '</div>';
    return 'uv';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>UV index</h2><p>The UV service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'uv',
  examples: [
    'UV index in Miami',
    'how strong is the sun in LA',
    'should I wear sunscreen in Phoenix',
    'what\'s the UV in Tokyo',
    'UV in Lisbon today'
  ],
  nearMisses: [
    'weather in Miami',
    'sunrise in Tokyo',
    'sunset in LA',
    'air quality in Phoenix',
    'what is ultraviolet light'
  ],
  match(lower, text) {
    if (/\b(sunrise|sunset|sun\s+rise|sun\s+set)\b/.test(lower)) return false;
    if (/\b(weather|forecast|temperature|rain|snow)\b/.test(lower) && !/\b(uv|u\.?v\.?|sunscreen|sunburn)\b/.test(lower)) return false;
    if (/\b(air\s*quality|a\.?q\.?i\.?)\b/.test(lower)) return false;
    if (/\b(ultraviolet\s+light|what\s+is\s+uv|define\s+uv)\b/.test(lower)) return false;
    return /\b(uv\s*index|u\.?v\.?\s*index)\b/.test(lower)
      || /\buv\b/.test(lower)
      || /\b(sunscreen|sunburn)\b/.test(lower)
      || /\bhow\s+strong\s+is\s+the\s+sun\b/.test(lower)
      || /\bshould\s+i\s+wear\s+sunscreen\b/.test(lower);
  },
  run
};
