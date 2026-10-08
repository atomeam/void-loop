/**
 * weather skill — Open-Meteo, no key
 * Contract: { name, examples, match(lower, text), run(text, api) }
 * api: { showPage, esc, say, reportMiss, loopLog }
 */
const WX = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail'
};

function weatherPlace(text) {
  const m = text.match(/\b(?:in|at|for|near)\s+([^?.!]+)$/i);
  if (m) return m[1].replace(/\b(today|tomorrow|now|right now|this week)\b/ig, '').trim();
  const t = text.replace(/[?.!]/g, '').replace(/\b(what'?s|what is|the|weather|forecast|temperature|like|today|now|is it|will it|going to|rain|snow|raining|snowing|sunny|windy|cloudy|how|cold|hot|warm|here|outside|what should i wear|do i|should i|will i|need|bring|take|an?|umbrella|raincoat|jacket|coat)\b/ig, ' ').trim();
  return t;
}

function hereCoords() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ latitude: p.coords.latitude, longitude: p.coords.longitude, name: 'Here' }), () => res(null), { timeout: 8000, maximumAge: 600000 });
  });
}

async function run(text, api) {
  const { showPage, esc, say, reportMiss, loopLog } = api;
  const place = weatherPlace(text);
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(place || 'Weather') + '</h2><div class="sub">…</div>'; });
  try {
    let loc = null;
    if (place) {
      const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(place)).then((r) => r.json());
      const r0 = g.results && g.results[0];
      if (r0) loc = { latitude: r0.latitude, longitude: r0.longitude, name: r0.name + (r0.admin1 && r0.admin1 !== r0.name ? ', ' + r0.admin1 : '') + (r0.country ? ', ' + r0.country : '') };
    } else {
      // where you are: the device's location if already allowed (no prompt), else the city your time zone names
      let granted = false;
      try { granted = navigator.permissions && (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'; } catch (_) {}
      if (granted) loc = await hereCoords();
      if (!loc) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        const city = tz.includes('/') ? tz.split('/').pop().replace(/_/g, ' ') : '';
        if (city) {
          const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(city)).then((r) => r.json()).catch(() => null);
          const r0 = g && g.results && g.results[0];
          if (r0) loc = { latitude: r0.latitude, longitude: r0.longitude, name: r0.name + (r0.country ? ', ' + r0.country : ''), guessed: true };
        }
      }
    }
    if (!api._pageStill(el)) return 'weather';
    if (!loc) {
      el.innerHTML = '<h2>Weather</h2><p>' + (place ? 'I couldn\'t find "' + esc(place) + '". Try a city name, like "weather in Tokyo".' : 'Where? Try "weather in Tokyo", or allow location for "weather here".') + '</p>';
      return place ? 'none' : 'weather';
    }
    const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.latitude + '&longitude=' + loc.longitude
      + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_hours=8&forecast_days=1&timezone=auto';
    const w = await fetch(u).then((r) => r.json());
    if (!api._pageStill(el)) return 'weather';
    queueMicrotask(() => weatherMini(api, el, w, loc, place)); // after the card's text is in: the diorama goes on top
    const f = /^(US|United States)/.test(loc.name.split(', ').pop()) || /United States/.test(loc.name) || (!place && navigator.language === 'en-US');
    const T = (c) => Math.round(f ? c * 9 / 5 + 32 : c) + '°';
    const c = w.current, d = w.daily, h = w.hourly;
    const hours = h.time.slice(0, 8).map((t, i) => '<div style="text-align:center;min-width:44px"><div style="color:#8a8a8a;font-size:12px">' + esc(new Date(t).toLocaleTimeString([], { hour: 'numeric' })) + '</div><div>' + T(h.temperature_2m[i]) + '</div><div style="color:#8a8a8a;font-size:11px">' + (h.precipitation_probability[i] != null ? h.precipitation_probability[i] + '%' : '') + '</div></div>').join('');
    el.innerHTML = '<h2>' + esc(loc.name) + '</h2>'
      + '<div class="sub">' + esc(WX[c.weather_code] || '') + ' · feels ' + T(c.apparent_temperature) + ' · wind ' + Math.round(f ? c.wind_speed_10m * 0.621 : c.wind_speed_10m) + (f ? ' mph' : ' km/h') + '</div>'
      + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + T(c.temperature_2m) + '</div>'
      + '<p>Today ' + T(d.temperature_2m_max[0]) + ' / ' + T(d.temperature_2m_min[0]) + (d.precipitation_probability_max && d.precipitation_probability_max[0] != null ? ' · rain chance ' + d.precipitation_probability_max[0] + '%' : '') + '</p>'
      + '<div style="display:flex;gap:6px;overflow-x:auto;padding:6px 0 2px">' + hours + '</div>'
      + '<div class="src">Source: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>' + (loc.guessed ? ' · place from your time zone; ask "weather in …" for another' : '') + '</div>';
    return 'weather';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Weather</h2><p>The weather service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

// the card's 3D miniature (skills/mini/weather.js): a diorama with the sky the forecast reports, rain or snow falling,
// day or night by the place's own clock, and a thermometer at the real temperature. Without WebGL the band goes away.
function weatherMini(api, el, w, loc, place) {
  const c = w && w.current; if (!c || !api.stage || !api.stage.miniature || !api._pageStill(el)) return;
  const f = /^(US|United States)/.test(loc.name.split(', ').pop()) || /United States/.test(loc.name) || (!place && navigator.language === 'en-US');
  const host = document.createElement('div'); host.className = 'vmini'; host.style.cssText = 'height:' + (Math.min(innerWidth, innerHeight) < 560 ? 180 : 230) + 'px;margin:0 0 6px';
  el.prepend(host);
  api.stage.miniature(host, 'weather', { code: c.weather_code, temp: c.temperature_2m, unit: f ? 'F' : 'C', isDay: c.is_day !== 0, wind: c.wind_speed_10m },
    { key: 'weather:' + Math.random().toString(36).slice(2, 9), label: 'Weather diorama: ' + (WX[c.weather_code] || 'weather') + ', ' + Math.round(c.temperature_2m) + '°C' }).catch(() => host.remove());
}

export default {
  name: 'weather',
  examples: ['weather in Tokyo', 'weather here', 'will it rain tomorrow', 'temperature in London', 'forecast for New York'],
  match(lower, text) {
    if (/\b(pollen|allerg)/.test(lower)) return false;
    if (/\bwater\s+(?:boils?|freezes?)\b|\bdoes\s+water\s+(?:boil|freeze)\b|\b(?:boiling|freezing)\s+point\b/.test(lower)) return false; // a fact the calculator answers
    // food and body temperatures are not the weather ("temperature to cook chicken", "body temperature"), but "temperature in Turkey" still is
    if (/\btemp(?:erature)?\b/.test(lower) && (/\b(cook|cooked|bake|roast|oven|internal|body|fever)\b/.test(lower) || /\btemp(?:erature)?\s+(?:for|of|should)\s+(?:a\s+|the\s+)?(chicken|pork|beef|steak|turkey|fish|salmon|burgers?|eggs?|ham|lamb|leftovers)\b/.test(lower) || /\b(chicken|pork|beef|steak|fish|salmon|burgers?)\s+(?:be|is)\s+(?:done|cooked)/.test(lower))) return false;
    return /\b(weather|forecast|temperature)\b/.test(lower)
      || /\b(is it|will it|going to)\s+(rain|snow|freeze|frost|storm|hail|sleet)\b/.test(lower)
      || /^is\s+it\s+(raining|snowing|sunny|windy|cloudy|hot|cold)\b/.test(lower)
      || /\bhow\s+(cold|hot|warm)\s+is\s+it\b/.test(lower)
      // "do i need an umbrella today in seattle", "should i bring a jacket": the forecast answers it
      || /^what\s+should\s+i\s+wear\b(?!\s+(?:to|for|with)\b)/.test(lower)
      || /^(?:do|will|should)\s+i\s+(?:need|bring|take)\s+(?:an?\s+)?(?:umbrella|raincoat|rain\s+jacket|jacket|coat)\b/.test(lower);
  },
  run
};
