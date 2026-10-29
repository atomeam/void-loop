/**
 * Weather for a place, as /weather/ shows it (the tower's weather floor, against weather.gov, 2026-10-25): the Open-Meteo forecast
 * (no key, any place on Earth) read into one view with both scales side by side, the words for its weather codes, the next 24 hours
 * and the 7 days ahead with today first, sunrise and sunset, and for a place in the United States the weather service's alerts in
 * force and its nearest radar loop (api.weather.gov and radar.weather.gov, public domain). The page does the fetching; everything
 * here takes what came back and says what to show, so it is tested on fixtures without a network.
 */
export const WX = Object.freeze({
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail',
});
export const words = (code) => WX[code] || 'Weather';
export const cToF = (c) => c * 9 / 5 + 32;
/** a temperature in both scales, Fahrenheit first: "61 °F / 16 °C". Pure. */
export const both = (c) => (Number.isFinite(c) ? Math.round(cToF(c)) + ' °F / ' + Math.round(c) + ' °C' : '');
/** the place a link or a box names: "weather in Boston" and "Boston" both give Boston; 60 characters at most. Pure. */
export function placeOf(q) {
  return String(q || '').replace(/[?.!]/g, ' ').replace(/^\s*(?:what'?s\s+the\s+|the\s+)?(?:weather|forecast|temperature)\s*(?:in|at|for|near)?\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, 60);
}
/** the stage card for the place looked up: "weather in <place>", or "weather here" for where you are (the stage asks the same geocoder). Pure. */
export const weatherAsk = (place) => { const p = placeOf(place); return p ? 'weather in ' + p : 'weather here'; };
export const geocodeUrl = (name) => 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=' + encodeURIComponent(name);
export const forecastUrl = (lat, lon) => 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
  + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day'
  + '&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset'
  + '&forecast_days=7&timezone=auto';
export const pointUrl = (lat, lon) => 'https://api.weather.gov/points/' + (+lat).toFixed(4) + ',' + (+lon).toFixed(4);
export const alertsUrl = (lat, lon) => 'https://api.weather.gov/alerts/active?point=' + (+lat).toFixed(4) + ',' + (+lon).toFixed(4);
export const radarLoop = (station) => 'https://radar.weather.gov/ridge/standard/' + String(station).replace(/[^A-Z0-9]/gi, '').toUpperCase() + '_loop.gif';
/** a geocoding result as the place shown: { name, lat, lon, us } ("Boston, Massachusetts, United States"). Pure. */
export function locOf(r) {
  if (!r || !Number.isFinite(+r.latitude) || !Number.isFinite(+r.longitude)) return null;
  const parts = [r.name, r.admin1 && r.admin1 !== r.name ? r.admin1 : '', r.country].filter(Boolean);
  return { name: parts.join(', '), lat: +r.latitude, lon: +r.longitude, us: r.country_code === 'US' || /united states/i.test(r.country || '') };
}
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** the weekday of a local date "2026-10-25" (Open-Meteo's daily.time, in the place's own zone). Pure. */
export function dayName(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? DAYS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()] : ''; }
/** the hour of a local time "2026-10-25T14:00" as a person says it: 2pm. Pure. */
export function hourName(iso) { const m = String(iso || '').match(/T(\d{2})/); if (!m) return ''; const h = +m[1]; return (h % 12 || 12) + (h < 12 ? 'am' : 'pm'); }
/** the clock of a local time "2026-10-25T06:58" as 6:58 am. Pure. */
export function clockName(iso) { const m = String(iso || '').match(/T(\d{2}):(\d{2})/); if (!m) return ''; const h = +m[1]; return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' am' : ' pm'); }
const num = (x) => (Number.isFinite(+x) ? +x : NaN);
/** Open-Meteo's forecast for a place as one view: now, the next 24 hours from the current hour, 7 days with today first, sunrise and sunset. Pure. */
export function viewOf(w, loc) {
  const c = (w && w.current) || {}, h = (w && w.hourly) || {}, d = (w && w.daily) || {};
  const T = Array.isArray(h.time) ? h.time : [], nowT = String(c.time || T[0] || '');
  let i0 = T.findIndex((t) => t > nowT); i0 = i0 < 0 ? Math.max(0, T.length - 1) : Math.max(0, i0 - 1); // the hour that holds now comes first
  const hours = T.slice(i0, i0 + 24).map((t, k) => ({ at: hourName(t), temp: num(h.temperature_2m && h.temperature_2m[i0 + k]), rain: num(h.precipitation_probability && h.precipitation_probability[i0 + k]), code: num(h.weather_code && h.weather_code[i0 + k]) }));
  const DT = Array.isArray(d.time) ? d.time : [];
  const days = DT.slice(0, 7).map((t, k) => ({ name: dayName(t), today: k === 0, hi: num(d.temperature_2m_max && d.temperature_2m_max[k]), lo: num(d.temperature_2m_min && d.temperature_2m_min[k]), rain: num(d.precipitation_probability_max && d.precipitation_probability_max[k]), code: num(d.weather_code && d.weather_code[k]) }));
  const wind = num(c.wind_speed_10m);
  return { place: loc && loc.name || '', us: !!(loc && loc.us), at: nowT, isDay: c.is_day !== 0,
    now: { temp: num(c.temperature_2m), feels: num(c.apparent_temperature), humidity: num(c.relative_humidity_2m), windKmh: wind, windMph: Number.isFinite(wind) ? Math.round(wind * 0.621371) : NaN, code: num(c.weather_code) },
    hours, days, sunrise: clockName(d.sunrise && d.sunrise[0]), sunset: clockName(d.sunset && d.sunset[0]) };
}
/** the alerts in force from api.weather.gov's active-alerts answer: [{ event, headline, severity, until }]. Pure. */
export function alertsOf(json) {
  const fs = (json && Array.isArray(json.features)) ? json.features : [];
  return fs.map((f) => f && f.properties).filter(Boolean).map((p) => ({ event: String(p.event || 'Alert'), headline: String(p.headline || p.description || '').slice(0, 300), severity: String(p.severity || ''), until: String(p.ends || p.expires || '') })).slice(0, 12);
}
/** the view as the lines the page shows, for tests and for the plain copy. Pure. */
export function textOf(v) {
  const out = [v.place, 'Now: ' + words(v.now.code) + ', ' + both(v.now.temp) + ', feels like ' + both(v.now.feels) + (Number.isFinite(v.now.humidity) ? ', humidity ' + Math.round(v.now.humidity) + '%' : '') + (Number.isFinite(v.now.windKmh) ? ', wind ' + v.now.windMph + ' mph / ' + Math.round(v.now.windKmh) + ' km/h' : '')];
  if (v.sunrise || v.sunset) out.push('Sunrise ' + v.sunrise + ' · Sunset ' + v.sunset);
  out.push('Next 24 hours'); for (const h of v.hours) out.push(h.at + ' ' + both(h.temp) + (Number.isFinite(h.rain) ? ' ' + h.rain + '% chance of rain' : '') + ' ' + words(h.code));
  out.push('7 days ahead'); for (const d of v.days) out.push(d.name + (d.today ? ' (today)' : '') + ' ' + both(d.hi) + ' high, ' + both(d.lo) + ' low' + (Number.isFinite(d.rain) ? ', ' + d.rain + '% chance of rain' : '') + ', ' + words(d.code));
  return out.join('\n');
}
