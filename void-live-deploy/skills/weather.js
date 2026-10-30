/**
 * weather skill — the weather now and the forecast for a place, kept current while the card is up (Open-Meteo, no key)
 * Contract: { name, examples, match(lower, text), run(text, api) }
 * api: { showPage, esc, say, reportMiss, loopLog }
 * The card stays current on its own: skills/live.js re-fetches the forecast every 15 minutes while it is up.
 * Asked by Verse (ask-20261014-1523-1, "link the 'weather' skill to the 'remind' or 'timer' skill so weather changes trigger
 * actionable prompts"): when rain, snow, frost or heat is in the next hours, the card offers one ask the timer skill takes
 * ("remind me to bring an umbrella in 110 minutes"), timed to the hour before it starts, so a visitor gets a countdown on the
 * stage at once (the remind skill's "remind me at 2pm" is the owner's: it goes to the confirm line and needs the key).
 */
import { keepLive } from './live.js';
const WX = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail'
};

// the words of the asks match() takes that name no place ("chance of rain today", "is there a storm coming", "what's the high tonight"): with no
// "in/at/for/near <place>", what is left after them is the place, and nothing left means here. Every match() pattern's own words are in it.
const WHEN = "today'?s?|tonight'?s?|tomorrow'?s?|now|right now|this week(?:end)?|outside|here";
// "high", "low" and "wind" go only as the forecast words ("the high", "low tonight", "wind speed"), so High Point and Wind Gap stay places
const WX_WORDS = new RegExp("\\b(" + ["(?:the|today'?s|tonight'?s|tomorrow'?s) (?:high|low|wind)|(?:high|low)(?= (?:temp|today|tonight|tomorrow))", WHEN, "what should i wear|what to wear|what'?s|what is|what will be|the|weather|forecast|temp(?:erature)?|like|is it|will it|going to|is there|on the way|coming",
  "rain(?:ing)?|snow(?:ing)?|showers|(?:thunder)?storms?|stormy|sleet|hail|frost|freez(?:e|ing)|sunny|windy|cloudy|foggy|humid(?:ity)?|hurricane|tornado|blizzard|heat\\s*wave|cold snap",
  "chance of|dew point|wind chill|heat index|wind speed|how|cold|hot|warm|get|be",
  "do i|should i|will i|need|bring|take|wear|an?|umbrella|raincoat|rain jacket|jacket|coat|shorts|boots"].join('|') + ")\\b", 'ig');
export function weatherPlace(text) {
  const m = text.match(/\b(?:in|at|for|near)\s+([^?.!]+)$/i);
  if (m) return m[1].replace(new RegExp('\\b(' + WHEN + ')\\b', 'ig'), '').replace(/\s+/g, ' ').trim();
  return text.replace(/[?.!,]/g, '').replace(WX_WORDS, ' ').replace(/\s+/g, ' ').trim();
}

const RAIN = (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95, SNOW = (c) => (c >= 71 && c <= 77) || c === 85 || c === 86;
const hourWord = (iso) => { const hr = new Date(iso).getHours(); return (hr % 12 || 12) + (hr < 12 ? 'am' : 'pm'); };
/** the one actionable prompt in the next hours: { kind, at, minutes, ask, why } for rain, snow, frost or heat (°C), or null; the
 * ask is the timer skill's "remind me to … in N minutes", N the minutes until the hour before it starts (5 at least). Pure. */
export function weatherPrompt(hourly, now = Date.now(), hours = 8) {
  const h = hourly || {}, T = Array.isArray(h.time) ? h.time : [];
  const at = (i) => hourWord(T[i > 0 ? i - 1 : 0]), from = (i) => hourWord(T[i]);
  const mins = (i) => { const ms = Date.parse(T[i > 0 ? i - 1 : 0]) - now; return Number.isFinite(ms) ? Math.max(5, Math.round(ms / 60000)) : 5; };
  const one = (kind, i, what, why) => ({ kind, at: at(i), minutes: mins(i), ask: 'remind me to ' + what + ' in ' + mins(i) + ' minutes', why });
  for (let i = 0; i < Math.min(T.length, hours); i++) {
    const c = +(h.weather_code || [])[i], p = +(h.precipitation_probability || [])[i], t = +(h.temperature_2m || [])[i];
    if (SNOW(c)) return one('snow', i, 'leave early, snow is coming', 'Snow from ' + from(i) + '.');
    if (RAIN(c) || p >= 50) return one('rain', i, 'bring an umbrella', 'Rain from ' + from(i) + (p >= 50 ? ' (' + p + '% chance)' : '') + '.');
    if (Number.isFinite(t) && t <= 0) return one('frost', i, 'cover the plants, frost tonight', 'Frost from ' + from(i) + '.');
    if (Number.isFinite(t) && t >= 32) return one('heat', i, 'drink water and find shade', 'Heat from ' + from(i) + ' (' + Math.round(t) + ' °C).');
  }
  return null;
}

/** the hourly arrays from index `i` on (the hour now), the same keys. Pure. */
export function hourlyFrom(h, i) { const o = {}; for (const k of Object.keys(h || {})) o[k] = Array.isArray(h[k]) ? h[k].slice(i) : h[k]; return o; }
/** a visibility in metres as people read it: "24 km", "800 m", "15 mi". Pure. */
export function visText(m, us) { if (us) { const mi = m / 1609.344; return (mi >= 10 ? Math.round(mi) : Math.round(mi * 10) / 10) + ' mi'; } return m >= 10000 ? Math.round(m / 1000) + ' km' : m >= 1000 ? Math.round(m / 100) / 10 + ' km' : Math.round(m) + ' m'; }
/** the hour-by-hour graph to seven days (weather.gov's hourly weather graph): the temperature as a line, the chance of rain as bars, a line at
 *  each midnight with the day's name, the hour now marked; an SVG string with numbers only in it. Pure. */
export function graph(h, now, us) {
  const T = (h && h.time) || [], n = Math.min(T.length, 168); if (n < 2) return '';
  const temps = h.temperature_2m.slice(0, n).map((c) => (us ? c * 9 / 5 + 32 : c)), rain = (h.precipitation_probability || []).slice(0, n);
  const W = 600, H = 190, L = 44, R = 6, top = 16, mid = 120, lo = Math.floor(Math.min(...temps)), hi = Math.ceil(Math.max(...temps)) + (Math.max(...temps) === Math.min(...temps) ? 1 : 0);
  const x = (i) => L + ((W - L - R) * i) / (n - 1), y = (t) => top + ((mid - top) * (hi - t)) / (hi - lo), bw = Math.max(1, (W - L - R) / n);
  let out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Temperature and chance of rain, hour by hour, ' + Math.round(n / 24) + ' days" style="width:100%;height:auto;display:block">';
  for (let i = 0; i < n; i++) if (rain[i]) out += '<rect x="' + x(i).toFixed(1) + '" y="' + (H - 26 - (rain[i] / 100) * 36).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + ((rain[i] / 100) * 36).toFixed(1) + '" fill="#5aa9e6" opacity=".55"/>';
  for (let i = 0; i < n; i++) if (/T00:/.test(T[i]) || i === 0) { const d = new Date(T[i]); out += (i ? '<line x1="' + x(i).toFixed(1) + '" x2="' + x(i).toFixed(1) + '" y1="' + top + '" y2="' + (H - 24) + '" stroke="#8b90a0" stroke-opacity=".35"/>' : '') + '<text x="' + (x(i) + 3).toFixed(1) + '" y="' + (H - 4) + '" font-size="19" fill="#8b90a0">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + '</text>'; }
  if (now > 0 && now < n) out += '<line x1="' + x(now).toFixed(1) + '" x2="' + x(now).toFixed(1) + '" y1="' + top + '" y2="' + (H - 24) + '" stroke="#ffffff" stroke-opacity=".6" stroke-dasharray="4 4"/>';
  out += '<polyline points="' + temps.map((t, i) => x(i).toFixed(1) + ',' + y(t).toFixed(1)).join(' ') + '" fill="none" stroke="#ffb347" stroke-width="3"/>';
  out += '<text x="2" y="' + (y(hi) + 6).toFixed(1) + '" font-size="19" fill="#8b90a0">' + hi + '°</text><text x="2" y="' + (y(lo) + 6).toFixed(1) + '" font-size="19" fill="#8b90a0">' + lo + '°</text></svg>';
  return '<div class="wx-graph" style="margin-top:8px"><div style="color:#8b90a0;font-size:12px">Hour by hour to ' + Math.round(n / 24) + (Math.round(n / 24) === 1 ? ' day' : ' days') + ': temperature <span style="color:#ffb347">—</span>, chance of rain <span style="color:#5aa9e6">▮</span></div>' + out + '</div>';
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
      + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,pressure_msl,visibility,dew_point_2m&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7&timezone=auto';
    const f = /^(US|United States)/.test(loc.name.split(', ').pop()) || /United States/.test(loc.name) || (!place && navigator.language === 'en-US');
    const T = (c) => Math.round(f ? c * 9 / 5 + 32 : c) + '°';
    // fetch and draw, in place: the first time here, then every 15 minutes while the card is up (skills/live.js), so a
    // card left open shows the weather now, not the weather when it was asked
    const draw = async () => {
      const w = await fetch(u).then((r) => r.json());
      if (!api._pageStill(el)) return;
      const c = w.current, d = w.daily, hAll = w.hourly;
      if (!c || !d || !hAll) throw new Error('no forecast');
      // the hourly forecast runs seven days from midnight there: the row and the prompt start at the hour now (current.time is the place's own clock)
      const from = Math.max(0, c.time ? hAll.time.findIndex((t) => t >= String(c.time).slice(0, 13)) : 0), h = hourlyFrom(hAll, from);
      queueMicrotask(() => weatherMini(api, el, w, loc, place)); // after the card's text is in: the diorama goes on top
      const next = weatherPrompt(h); // asked by Verse: rain, snow, frost or heat in the next hours offers one reminder
      const nextLine = next ? '<p class="wx-next">' + esc(next.why) + ' <a href="#" data-ask="' + esc(next.ask) + '">' + esc(next.ask) + '</a> <span style="color:#8b90a0;font-size:12px">· a timer on the stage, to ' + esc(next.at) + '</span></p>' : '';
      const hours = h.time.slice(0, 8).map((t, i) => '<div style="text-align:center"><div style="color:#8b90a0;font-size:12px;white-space:nowrap">' + esc(new Date(t).toLocaleTimeString([], { hour: 'numeric' })) + '</div><div style="font-weight:500">' + T(h.temperature_2m[i]) + '</div><div style="color:#8b90a0;font-size:11px">' + (h.precipitation_probability[i] != null ? h.precipitation_probability[i] + '%' : '') + '</div></div>').join('');
      el.classList.add('vp-tight'); // a weather card is a glance: tight, no empty right half
      el.innerHTML = '<h2>' + esc(loc.name) + '</h2>'
        + '<div class="sub">' + esc(WX[c.weather_code] || '') + ' · feels ' + T(c.apparent_temperature) + ' · wind ' + Math.round(f ? c.wind_speed_10m * 0.621 : c.wind_speed_10m) + (f ? ' mph' : ' km/h') + (Number.isFinite(c.relative_humidity_2m) ? ' · humidity ' + Math.round(c.relative_humidity_2m) + '%' : '')
        + (Number.isFinite(c.pressure_msl) ? ' · pressure ' + (f ? (c.pressure_msl * 0.0295300).toFixed(2) + ' inHg' : Math.round(c.pressure_msl) + ' hPa') : '') + (Number.isFinite(c.visibility) ? ' · visibility ' + visText(c.visibility, f) : '') + (Number.isFinite(c.dew_point_2m) ? ' · dew point ' + T(c.dew_point_2m) : '') + '</div>'
        + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + T(c.temperature_2m) + '</div>'
        + '<p>Today ' + T(d.temperature_2m_max[0]) + ' / ' + T(d.temperature_2m_min[0]) + (d.precipitation_probability_max && d.precipitation_probability_max[0] != null ? ' · rain chance ' + d.precipitation_probability_max[0] + '%' : '') + '</p>'
        + nextLine
        + '<div class="wx-hours" style="display:grid;grid-auto-flow:column;grid-auto-columns:minmax(46px,1fr);overflow-x:auto;gap:8px 2px;padding:10px 0 4px;margin-top:6px;border-top:1px solid rgba(255,255,255,.07)">' + hours + '</div>'
        + graph(hAll, from, f)
        + '<div class="src">Source: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>' + (loc.guessed ? ' · place from your time zone; ask "weather in …" for another' : '') + '</div>';
    };
    await draw();
    if (!api._pageStill(el)) return 'weather';
    keepLive(api, el, { name: 'weather', every: 15 * 60e3, refresh: draw });
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
  // one key per card: a refresh (live.js) redraws the text and re-attaches the same diorama with the new forecast, instead of building a second one
  el._wxKey = el._wxKey || 'weather:' + Math.random().toString(36).slice(2, 9);
  api.stage.miniature(host, 'weather', { code: c.weather_code, temp: c.temperature_2m, unit: f ? 'F' : 'C', isDay: c.is_day !== 0, wind: c.wind_speed_10m },
    { key: el._wxKey, label: 'Weather diorama: ' + (WX[c.weather_code] || 'weather') + ', ' + Math.round(c.temperature_2m) + '°C' }).catch(() => host.remove());
}

export default {
  name: 'weather',
  examples: ['weather in Tokyo', 'weather here', 'will it rain tomorrow', 'temperature in London', 'forecast for New York'],
  match(lower, text) {
    if (/\b(pollen|allerg)/.test(lower)) return false;
    if (/\bwater\s+(?:boils?|freezes?)\b|\bdoes\s+water\s+(?:boil|freeze)\b|\b(?:boiling|freezing)\s+point\b/.test(lower)) return false; // a fact the calculator answers
    // food and body temperatures are not the weather ("temperature to cook chicken", "body temperature"), but "temperature in Turkey" still is
    if (/\btemp(?:erature)?\b/.test(lower) && (/\b(cook|cooked|bake|roast|oven|internal|body|fever|steak|doneness|medium[\s-]rare|well[\s-]done)\b/.test(lower) || /\btemp(?:erature)?\s+(?:for|of|should)\s+(?:a\s+|the\s+)?(chicken|pork|beef|steak|turkey|fish|salmon|burgers?|eggs?|ham|lamb|leftovers)\b/.test(lower) || /\b(chicken|pork|beef|steak|fish|salmon|burgers?)\s+(?:be|is)\s+(?:done|cooked)/.test(lower))) return false;
    return /\b(weather|forecast|temperature)\b/.test(lower)
      || /\b(is it|will it|going to)\s+(rain|snow|freeze|frost|storm|hail|sleet)\b/.test(lower)
      || /^is\s+it\s+(?:going\s+to\s+be\s+)?(raining|snowing|sunny|windy|cloudy|hot|cold|freezing|foggy|humid|stormy)\b/.test(lower)
      || /\bhow\s+(cold|hot|warm)\s+(?:is\s+it|will\s+it\s+(?:be|get)|is\s+it\s+going\s+to\s+(?:be|get))\b/.test(lower)
      // "chance of rain today", "is there a storm coming", "what's the high today", "dew point today"
      || /\bchance\s+of\s+(?:rain|snow|showers|storms?|thunderstorms?|sleet|hail|frost)\b/.test(lower)
      || /\bis\s+there\s+(?:a\s+)?(?:storm|thunderstorm|hurricane|tornado|blizzard|heat\s*wave|cold\s+snap)\s+(?:coming|on\s+the\s+way|tonight|today|tomorrow)\b/.test(lower)
      || /^(?:what(?:'?s|\s+is|\s+will\s+be)\s+)?(?:the\s+|today'?s\s+|tomorrow'?s\s+)?(?:high|low)(?:\s+temp(?:erature)?)?\s+(?:today|tonight|tomorrow)\b/.test(lower)
      || /^(?:what(?:'?s|\s+is)\s+(?:the\s+)?)?(?:dew\s+point|wind\s*chill|heat\s+index)(?:\s+(?:today|tonight|tomorrow|now|outside|right\s+now|here|(?:in|at|for)\s+[a-z].*))?$/.test(lower)
      // "humidity in Miami", "what's the wind speed in Chicago": the card shows both
      || /^(?:what(?:'?s|\s+is)\s+(?:the\s+)?)?(?:humidity|wind(?:\s+speed)?)\s+(?:like\s+)?(?:in|at|for)\s+[a-z]/.test(lower)
      // "do i need an umbrella today in seattle", "should i bring a jacket": the forecast answers it
      || /^what\s+(?:should\s+i\s+|to\s+)wear\b(?!\s+(?:to|for|with)\b)/.test(lower)
      || /^(?:do|will|should)\s+i\s+(?:need|bring|take|wear)\s+(?:an?\s+)?(?:umbrella|raincoat|rain\s+jacket|jacket|coat|shorts|boots)\b/.test(lower);
  },
  run
};
