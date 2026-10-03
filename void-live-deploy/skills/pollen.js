/**
 * pollen skill - Open-Meteo CAMS pollen (Europe) + geocoding, no key
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "pollen in Paris", "allergy forecast in Berlin", "how bad is the pollen in London",
 * "ragweed count in Vienna", "is pollen high in Madrid".
 * Shows the leading pollen type right now, grains/m3, a plain band + tip, today's peak,
 * and tomorrow's peak from the 4-day CAMS forecast.
 * Counts cover Europe (CAMS); elsewhere Void says so plainly.
 */
const TYPES = [
  { key: 'grass_pollen', name: 'Grass' },
  { key: 'birch_pollen', name: 'Birch' },
  { key: 'alder_pollen', name: 'Alder' },
  { key: 'olive_pollen', name: 'Olive' },
  { key: 'mugwort_pollen', name: 'Mugwort' },
  { key: 'ragweed_pollen', name: 'Ragweed' }
];
const BANDS = [
  { max: 0, label: 'None', tip: 'No measurable pollen in this hour. Outdoor plans are easy for most people.' },
  { max: 30, label: 'Low', tip: 'Mild levels. Sensitive folks may notice it; everyday outdoor plans are usually fine.' },
  { max: 60, label: 'Moderate', tip: 'Keep windows closed if you react, and rinse off after long outdoor time.' },
  { max: 100, label: 'High', tip: 'Limit midday outdoor time if you react. Antihistamines and closed windows help many people.' },
  { max: Infinity, label: 'Very High', tip: 'Strong pollen day. Stay indoors when you can if you react, and follow your usual allergy plan.' }
];

function pollenPlace(text) {
  const t = String(text || '').trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/\b(?:in|at|for|near|around)\s+(.+)$/i);
  if (m) {
    return m[1]
      .replace(/\b(today|tonight|now|right now|this (?:morning|afternoon|evening|week)|lately|currently|tomorrow)\b/ig, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return t
    .replace(/\b(what'?s|what is|how'?s|how is|how|bad|high|low|is|the|pollen(?:\s+count|\s+level|\s+index)?|allerg(?:y|ies)|forecast|count|levels?|like|there|today|now|tomorrow)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bandOf(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return null;
  return BANDS.find((b) => v <= b.max) || BANDS[BANDS.length - 1];
}

function asOf(iso) {
  if (!iso) return new Date().toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  const d = new Date(/T/.test(iso) ? iso : iso + 'T00:00:00');
  if (Number.isNaN(+d)) return String(iso);
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
    + (/T\d/.test(iso) ? ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
}

function pickHour(hourly) {
  if (!hourly || !Array.isArray(hourly.time)) return null;
  const now = Date.now();
  let best = null;
  for (let i = 0; i < hourly.time.length; i++) {
    const t = Date.parse(hourly.time[i]);
    if (Number.isNaN(t)) continue;
    const row = { i, time: hourly.time[i], dist: Math.abs(t - now) };
    if (!best || row.dist < best.dist) best = row;
  }
  return best;
}

function readingAt(hourly, i) {
  const out = [];
  for (const p of TYPES) {
    const v = Number(hourly[p.key] && hourly[p.key][i]);
    if (!Number.isFinite(v)) continue;
    out.push({ name: p.name, key: p.key, v });
  }
  out.sort((a, b) => b.v - a.v);
  return out;
}

function dayKey(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function peakOnDay(hourly, ymd) {
  let peak = null;
  if (!hourly || !Array.isArray(hourly.time)) return null;
  for (let i = 0; i < hourly.time.length; i++) {
    if (!String(hourly.time[i]).startsWith(ymd)) continue;
    for (const p of TYPES) {
      const v = Number(hourly[p.key] && hourly[p.key][i]);
      if (!Number.isFinite(v)) continue;
      if (!peak || v > peak.v) peak = { name: p.name, v, time: hourly.time[i] };
    }
  }
  return peak;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const place = pollenPlace(text);
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(place || 'Pollen') + '</h2><div class="sub">.</div>'; });
  try {
    let loc = null;
    if (place) {
      const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(place)).then((r) => r.json());
      const r0 = g.results && g.results[0];
      if (r0) loc = { latitude: r0.latitude, longitude: r0.longitude, name: r0.name + (r0.admin1 && r0.admin1 !== r0.name ? ', ' + r0.admin1 : '') + (r0.country ? ', ' + r0.country : '') };
    }
    if (!api._pageStill(el)) return 'pollen';
    if (!loc) {
      el.innerHTML = '<h2>Pollen</h2><p>' + (place
        ? 'I couldn\'t find "' + esc(place) + '". Try a city name, like "pollen in Paris".'
        : 'Where? Try "pollen in Paris" or "allergy forecast in Berlin".') + '</p>';
      return place ? 'none' : 'pollen';
    }
    const keys = TYPES.map((t) => t.key).join(',');
    const u = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + loc.latitude + '&longitude=' + loc.longitude
      + '&hourly=' + keys + '&forecast_days=4&timezone=auto';
    const aq = await fetch(u).then((r) => r.json());
    if (!api._pageStill(el)) return 'pollen';
    const hour = pickHour(aq.hourly);
    const rows = hour ? readingAt(aq.hourly, hour.i) : [];
    if (!rows.length) {
      el.innerHTML = '<h2>' + esc(loc.name) + '</h2>'
        + '<p>Pollen counts for that place aren\'t in the free Europe forecast right now (CAMS covers much of Europe). Try a European city, or check a local allergy site.</p>'
        + '<div class="src">Source: <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noopener">Open-Meteo Air Quality / CAMS pollen</a></div>';
      return 'pollen';
    }
    const top = rows[0];
    const band = bandOf(top.v);
    const today = peakOnDay(aq.hourly, dayKey(0));
    const next = peakOnDay(aq.hourly, dayKey(1));
    const when = asOf(hour.time);
    const others = rows.slice(1, 4).filter((r) => r.v > 0)
      .map((r) => esc(r.name) + ' ' + esc(String(Math.round(r.v))))
      .join(' · ');
    el.innerHTML = '<h2>' + esc(loc.name) + '</h2>'
      + '<div class="sub">Pollen · ' + esc(band.label) + ' · mainly ' + esc(top.name) + '</div>'
      + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + esc(String(Math.round(top.v))) + '</div>'
      + '<p style="color:#8a8a8a">grains/m³ · ' + esc(top.name) + '</p>'
      + '<p>' + esc(band.tip) + '</p>'
      + (others ? '<p style="color:#8a8a8a">Also: ' + others + '</p>' : '')
      + (today && today.v > top.v ? '<p style="color:#8a8a8a">Today\'s peak: ' + esc(today.name) + ' ' + esc(String(Math.round(today.v))) + ' around ' + esc(asOf(today.time)) + '</p>' : '')
      + (next && next.v > 0 ? '<p style="color:#8a8a8a">Tomorrow\'s peak look: ' + esc(next.name) + ' ' + esc(String(Math.round(next.v))) + ' around ' + esc(asOf(next.time)) + '</p>' : '')
      + '<div class="src">Source: <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noopener">Open-Meteo Air Quality / CAMS pollen</a> · as of ' + esc(when) + ' · Europe 4-day forecast · not medical advice</div>';
    return 'pollen';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Pollen</h2><p>The pollen service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'pollen',
  examples: [
    'pollen in Paris',
    'allergy forecast in Berlin',
    'how bad is the pollen in London',
    'is pollen high in Madrid',
    'ragweed count in Vienna'
  ],
  nearMisses: [
    'air quality in Paris',
    'weather in Berlin',
    'what is a pollen grain',
    'bee pollen supplements',
    'UV index in London'
  ],
  match(lower, text) {
    if (/\b(air\s*quality|a\.?q\.?i\.?|weather|forecast|temperature|uv\s*index|sunscreen)\b/.test(lower) && !/\b(pollen|allerg)/.test(lower)) return false;
    if (/\b(bee\s+pollen|pollen\s+grain|what\s+is\s+pollen|supplement)\b/.test(lower)) return false;
    return /\bpollen\b/.test(lower)
      || /\ballerg(?:y|ies)\s+forecast\b/.test(lower)
      || /\bhow\s+bad\s+is\s+(?:the\s+)?pollen\b/.test(lower)
      || /\bis\s+pollen\s+(high|low|bad|bad\s+today)\b/.test(lower)
      || /\b(ragweed|birch|grass|alder|olive|mugwort)\s+(count|pollen|levels?)\b/.test(lower);
  },
  run
};
