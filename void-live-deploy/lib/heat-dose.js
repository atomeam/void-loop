// heat-dose — the coral heat card's 48-hour projected dose (asked by Verse, ask-20261015-0100-1: "Integrate the 'weather' and
// 'uv' skills into the heat-dose ruler to generate a 48-hour projected dose forecast card"). NOAA's degree heating weeks
// (lib/reefwatch.js) are the record of heat already taken; this is the dose coming: Open-Meteo's marine forecast of sea-surface
// temperature at the Keys (no key) against the bleaching threshold, plus the UV and air forecast the weather and uv skills
// already read. The maths is NOAA Coral Reef Watch's own: a HotSpot is sea temperature above the maximum monthly mean (MMM),
// and degree heating weeks add up HotSpots of 1 °C or more over 12 weeks, in °C-weeks (a day at 2 °C over adds 2/7 of a week).
// Pure: skills/coral.js fetches and draws.
export const KEYS = { latitude: 24.55, longitude: -81.4, name: 'Florida Keys' }; // Looe Key, in the regional virtual station's box
// About 30.5 °C is the Keys' bleaching threshold NOAA Coral Reef Watch quoted through the 2023 heatwave (MMM about 29.5 °C
// plus 1 °C); the station page carries the exact one for the box. Named here so one edit moves it.
export const MMM_C = 29.5, THRESHOLD_C = MMM_C + 1;
export const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine?latitude=' + KEYS.latitude + '&longitude=' + KEYS.longitude + '&hourly=sea_surface_temperature&forecast_days=2&timezone=auto';
export const WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=' + KEYS.latitude + '&longitude=' + KEYS.longitude + '&hourly=uv_index,temperature_2m&forecast_days=2&timezone=auto';

const nums = (a) => (Array.isArray(a) ? a.map((x) => (Number.isFinite(+x) && x !== null ? +x : NaN)) : []);
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
/**
 * The next-48-hours dose from the two forecasts (either may be missing): { hours, hot, over, dhwAdd, sstMin, sstMax, uvPeak,
 * uvHours, airMax, from, to } or null with nothing to read. `hot` counts hours at or above the threshold, `over` is the mean
 * HotSpot over those hours, `dhwAdd` the degree heating weeks those hours add if they hold (NOAA counts HotSpots of 1 °C and
 * more, so hours just over the MMM add nothing), `uvHours` the sum of the hourly UV index (a dose, like NOAA's light stress). Pure.
 */
export function doseForecast(marine, wx, threshold = THRESHOLD_C, mmm = MMM_C) {
  const mh = marine && marine.hourly, wh = wx && wx.hourly;
  const sst = nums(mh && mh.sea_surface_temperature).slice(0, 48), uv = nums(wh && wh.uv_index).slice(0, 48), air = nums(wh && wh.temperature_2m).slice(0, 48);
  const sstOk = sst.filter(Number.isFinite), uvOk = uv.filter(Number.isFinite), airOk = air.filter(Number.isFinite);
  if (!sstOk.length && !uvOk.length) return null;
  const times = (mh && mh.time) || (wh && wh.time) || [];
  const hours = Math.max(sstOk.length, uvOk.length);
  const hotRows = sstOk.filter((t) => t >= threshold), spots = sstOk.map((t) => t - mmm).filter((d) => d >= 1);
  return {
    hours, from: times[0] || null, to: times[Math.min(times.length, hours) - 1] || null,
    sstMin: sstOk.length ? r1(Math.min(...sstOk)) : null, sstMax: sstOk.length ? r1(Math.max(...sstOk)) : null,
    hot: hotRows.length, over: hotRows.length ? r1(hotRows.reduce((a, t) => a + (t - threshold), 0) / hotRows.length) : 0,
    dhwAdd: r2(spots.reduce((a, d) => a + d, 0) / (7 * 24)), // °C-hours over the MMM, in weeks
    uvPeak: uvOk.length ? r1(Math.max(...uvOk)) : null, uvHours: uvOk.length ? Math.round(uvOk.reduce((a, b) => a + b, 0)) : null,
    airMax: airOk.length ? r1(Math.max(...airOk)) : null,
  };
}
const UV_WORD = (u) => (u <= 2 ? 'low' : u <= 5 ? 'moderate' : u <= 7 ? 'high' : u <= 10 ? 'very high' : 'extreme');
/** the card's lines for a dose: [headline, water, light, what it means]. Pure. */
export function doseLines(d, threshold = THRESHOLD_C) {
  if (!d) return [];
  const span = 'next ' + d.hours + ' hours';
  const water = d.sstMax == null ? 'No water forecast just now.'
    : 'Water ' + d.sstMin + '–' + d.sstMax + ' °C' + (d.hot ? ': ' + d.hot + ' of ' + d.hours + ' hours at or above the bleaching threshold (about ' + threshold + ' °C), ' + d.over + ' °C over on average' : ', under the bleaching threshold (about ' + threshold + ' °C) the whole way') + '.';
  const light = d.uvPeak == null ? 'No UV forecast just now.' : 'UV peaks at ' + d.uvPeak + ' (' + UV_WORD(d.uvPeak) + '), ' + d.uvHours + ' UV-hours in all' + (d.airMax != null ? '; air up to ' + d.airMax + ' °C' : '') + '.';
  const means = d.sstMax == null ? 'Heat stress is read from the water, so the UV line is the light half only.'
    : d.dhwAdd >= 0.05 ? 'If it holds, that adds about ' + d.dhwAdd + ' degree heating weeks to the running count' + (d.uvPeak != null && d.uvPeak >= 8 ? ', and the strong light makes bleaching likelier at the same heat' : '') + '.'
    : d.hot ? 'Warm, but under a full degree over the summer maximum, so it adds nothing to the degree heating weeks yet.' : 'No heat dose coming in this window: the reef gets a rest.';
  return ['Projected heat dose, ' + span, water, light, means];
}
