// The outside services the browser checks call (Wikipedia, translate, Open-Meteo weather, geocoding, air quality and pollen,
// USGS quakes, Frankfurter rates), answered offline with the same made-up data every run. One set for every runner: the suite
// (tools/test_void.mjs fresh()), the 3D checks run alone (node tools/test_3d.mjs --browser), on a laptop and in CI alike, so a
// local run never differs from verify-main because a service was slow, down or returned today's weather.
//   outsideReply(url) -> a Playwright route.fulfill() object; anything not listed gets an empty 204 (never the real network)
//   routeOutside(ctx) -> sends every request that is not to 127.0.0.1 / localhost through outsideReply
//   voidApiReply(url) -> /api/reflect and /api/will, Void's own read-only data, or null for anything else
const json = (body) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

export function outsideReply(u) {
  if (u.includes('translate.googleapis.com')) return json([[['hola', 'hello']]]);
  if (u.includes('/w/api.php')) return json({ query: { search: [{ title: 'Black hole' }] } });
  if (u.includes('/page/summary/')) return json({ title: 'Black hole', extract: 'A region of spacetime.', timestamp: '2026-09-20T10:00:00Z' });
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
  if (u.includes('api.open-meteo.com')) { const d = new Date().toISOString().slice(0, 10); return json({ current: { temperature_2m: 20, apparent_temperature: 19, weather_code: 1, wind_speed_10m: 5 }, daily: { temperature_2m_max: [24], temperature_2m_min: [15], precipitation_probability_max: [10], uv_index_max: [7.2] }, hourly: { time: Array.from({ length: 24 }, (_, i) => d + 'T' + String(i).padStart(2, '0') + ':00'), temperature_2m: Array(24).fill(20), precipitation_probability: Array(24).fill(5), weather_code: Array(24).fill(1), uv_index: Array(24).fill(6.5) } }); }
  if (u.includes('frankfurter')) return json({ amount: 100, base: 'USD', date: '2026-09-26', rates: { EUR: 92 } });
  return { status: 204, body: '' };
}

// Void's own data-only endpoints the page reads on load (what Void said of itself, what it wants next), the same in every runner
export function voidApiReply(u) {
  if (u.includes('/api/reflect')) return json({ entries: [{ at: '2026-10-08T18:09:00Z', kind: 'daily', question: 'q', thoughts: 'I am strong at sums and thin on places.', weakest: 'My maps are flat.', next_game: 'Backgammon, because people keep asking.', asks: [] }], asks: [{ ask: 'Give the map card terrain', small: false, kind: 'daily', at: '2026-10-08T18:09:00Z' }] });
  if (u.includes('/api/will')) return json({ at: '2026-09-27T23:00:00Z', wants: [{ kind: 'people asked', title: 'learn x', i_want: 'I want to answer every question about tides.', because: 'asked 9 times' }] });
  return null;
}

export function routeOutside(ctx) {
  return ctx.route(/^https?:\/\/(?!(?:127\.0\.0\.1|localhost)[:/])/, (r) => r.fulfill(outsideReply(r.request().url())));
}
