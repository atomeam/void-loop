// The outside services the browser checks call (Wikipedia, translate, Open-Meteo weather, geocoding, air quality and pollen,
// USGS quakes, Frankfurter rates), answered offline with the same made-up data every run. One set for every runner: the suite
// (tools/test_void.mjs fresh()), the 3D checks run alone (node tools/test_3d.mjs --browser), on a laptop and in CI alike, so a
// local run never differs from verify-main because a service was slow, down or returned today's weather.
//   outsideReply(url) -> a Playwright route.fulfill() object; anything not listed gets an empty 204 (never the real network)
//   routeOutside(ctx) -> sends every request that is not to 127.0.0.1 / localhost through outsideReply
//   voidApiReply(url) -> /api/reflect and /api/will, Verse's own read-only data, or null for anything else
const json = (body) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

export function outsideReply(u) {
  if (u.includes('translate.googleapis.com')) return json([[['hola', 'hello']]]);
  if (u.includes('/w/api.php')) return json({ query: { search: [{ title: 'Black hole' }] } });
  if (u.includes('/page/summary/')) return json({ title: 'Black hole', extract: 'A region of spacetime.', timestamp: '2026-09-20T10:00:00Z' });
  if (u.includes('geocoding-api.open-meteo.com') && /name=Bergen/i.test(u)) return json({ results: [{ name: 'Bergen', country: 'Norway', latitude: 60.39, longitude: 5.32, population: 280000 }] }); // the rainy city: the weather prompt
  if (u.includes('marine-api.open-meteo.com')) { const d = new Date().toISOString().slice(0, 10); return json({ hourly: { time: Array.from({ length: 48 }, (_, i) => d + 'T' + String(i % 24).padStart(2, '0') + ':00'), sea_surface_temperature: Array(48).fill(0).map((_, i) => (i >= 10 && i < 40 ? 31.2 : 29.8)) } }); } // the coral heat dose: 30 hours over the threshold
  if (u.includes('geocoding-api.open-meteo.com')) return json({ results: [{ name: 'Lisbon', country: 'Portugal', latitude: 38.7, longitude: -9.1, population: 500000 }, { name: 'Lisbon', admin1: 'Ohio', country: 'United States', latitude: 40.7, longitude: -80.7, population: 2800 }] });
  if (u.includes('air-quality-api.open-meteo.com')) {
    if (/grass_pollen|birch_pollen|alder_pollen/.test(u)) {
      const d0 = new Date(); d0.setHours(0,0,0,0);
      const d1 = new Date(d0); d1.setDate(d1.getDate()+1);
      const fmt = (d) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      const day0 = fmt(d0), day1 = fmt(d1);
      const times = [];
      for (let i=0;i<24;i++) times.push(day0+'T'+String(i).padStart(2,'0')+':00');
      for (let i=0;i<24;i++) times.push(day1+'T'+String(i).padStart(2,'0')+':00');
      const grass = Array(24).fill(45).concat(Array(24).fill(70));
      const birch = Array(24).fill(12).concat(Array(24).fill(18));
      return json({ hourly: { time: times, grass_pollen: grass, birch_pollen: birch, alder_pollen: Array(48).fill(3), olive_pollen: Array(48).fill(0), mugwort_pollen: Array(48).fill(8), ragweed_pollen: Array(48).fill(22) } });
    }
    return json({ current: { time: '2026-10-03T12:00', us_aqi: 42, european_aqi: 25, pm2_5: 10.2, pm10: 18.0, ozone: 55, nitrogen_dioxide: 12, sulphur_dioxide: 3, carbon_monoxide: 140, us_aqi_pm2_5: 42, us_aqi_pm10: 16, us_aqi_ozone: 18, us_aqi_nitrogen_dioxide: 11, us_aqi_sulphur_dioxide: 2, us_aqi_carbon_monoxide: 2 } });
  }
  if (u.includes('earthquake.usgs.gov')) {
    const now = Date.now();
    return json({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { mag: 5.2, place: '12 km E of Lisbon, Portugal', time: now - 3600e3, url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000demo', ids: ',us7000demo,' }, geometry: { type: 'Point', coordinates: [-9.0, 38.7, 10] } },
      { type: 'Feature', properties: { mag: 3.1, place: '45 km SW of Lisbon, Portugal', time: now - 7200e3, url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000demo2', ids: ',us7000demo2,' }, geometry: { type: 'Point', coordinates: [-9.4, 38.4, 8] } }
    ] });
  }
  if (u.includes('api.open-meteo.com') && u.includes('latitude=60.39')) { const d = new Date().toISOString().slice(0, 10); const base = new Date(); base.setMinutes(0, 0, 0); const t = (i) => { const x = new Date(base.getTime() + i * 36e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') + 'T' + String(x.getHours()).padStart(2, '0') + ':00'; };
    return json({ current: { temperature_2m: 9, apparent_temperature: 7, weather_code: 3, wind_speed_10m: 20, relative_humidity_2m: 88 }, daily: { temperature_2m_max: [11], temperature_2m_min: [6], precipitation_probability_max: [85], uv_index_max: [1.5] }, hourly: { time: Array.from({ length: 8 }, (_, i) => t(i)), temperature_2m: Array(8).fill(9), precipitation_probability: [10, 20, 70, 85, 80, 60, 30, 10], weather_code: [3, 3, 61, 63, 63, 61, 3, 2], uv_index: Array(8).fill(1) } }); }
  // seven days hour by hour from midnight on this machine's clock (as timezone=auto gives them for the place), the hour now in current.time,
  // and the pressure and visibility the weather card shows
  if (u.includes('api.open-meteo.com')) { const z = new Date(); z.setHours(0, 0, 0, 0); const t = (i) => { const x = new Date(z.getTime() + i * 36e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') + 'T' + String(x.getHours()).padStart(2, '0') + ':00'; };
    return json({ current: { time: t(new Date().getHours()), temperature_2m: 20, apparent_temperature: 19, weather_code: 1, wind_speed_10m: 5, pressure_msl: 1016.4, visibility: 24140 }, daily: { temperature_2m_max: [24], temperature_2m_min: [15], precipitation_probability_max: [10], uv_index_max: [7.2] }, hourly: { time: Array.from({ length: 168 }, (_, i) => t(i)), temperature_2m: Array.from({ length: 168 }, (_, i) => 20 + 4 * Math.sin((i - 9) * Math.PI / 12)), precipitation_probability: Array.from({ length: 168 }, (_, i) => (i > 60 && i < 80 ? 70 : 5)), weather_code: Array(168).fill(1), uv_index: Array(168).fill(6.5) } }); }
  if (u.includes('api.datamuse.com')) return json([{ word: 'islet' }, { word: 'stile' }, { word: 'tiles' }, { word: 'inlet' }, { word: 'steal' }]); // the words skill: anagrams of tlesi keep islet, stile, tiles
  if (u.includes('frankfurter')) return json({ amount: 100, base: 'USD', date: '2026-09-26', rates: { EUR: 92 } });
  return { status: 204, body: '' };
}

// Verse's own data-only endpoints the page reads on load (what Verse said of itself, what it wants next), the same in every runner
export function voidApiReply(u) {
  if (u.includes('/api/reflect')) return json({ entries: [{ at: '2026-10-08T18:09:00Z', kind: 'daily', question: 'q', thoughts: 'I am strong at sums and thin on places.', weakest: 'My maps are flat.', next_game: 'Backgammon, because people keep asking.', asks: [] }], asks: [{ ask: 'Give the map card terrain', small: false, kind: 'daily', at: '2026-10-08T18:09:00Z' }], follow: { total: 5, built: 2, recent: [{ ask: 'Learn Go on the stage', at: '2026-10-08T17:55:00Z', ref: 'https://github.com/atomeam/void-loop/pull/244', what: 'asked by Verse: Go. skills/go.js is a two-player 9x9 board', times: 2 }] } });
  if (u.includes('/api/will')) return json({ at: '2026-09-27T23:00:00Z', wants: [{ kind: 'people asked', title: 'learn x', i_want: 'I want to answer every question about tides.', because: 'asked 9 times' }] });
  return null;
}

export function routeOutside(ctx) {
  return ctx.route(/^https?:\/\/(?!(?:127\.0\.0\.1|localhost)[:/])/, (r) => r.fulfill(outsideReply(r.request().url())));
}
