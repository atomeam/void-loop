/**
 * night-sky skill — the sky world (frontier #21, sky PR B): "show me the sky" turns the whole stage into the sky over
 * the visitor right now, behind every card: the sun or the stars, the moon in its phase, the planets by name, a horizon
 * with the compass on it. Every position comes from lib/sky-math.js for this minute and this place; it redraws once a
 * minute (never per frame) and "hide the sky" puts the void back. The place is the browser's location when it gives it,
 * else a rough place from the time zone, and the label says which.
 * It is a world (void.html setWorld), not a card: the sky card with its explanation is the next piece (sky PR C).
 */
import { sky } from '../lib/sky-math.js';

/** what the ask means: null, { show: true } or { hide: true } */
export function nightSkyOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:hide|close|clear|remove|turn\s+off)\s+(?:the\s+)?(?:night\s+)?sky$|^(?:back\s+to\s+the\s+void|no\s+more\s+sky)$/.test(t)) return { hide: true };
  if (/^(?:please\s+)?(?:show|open|give)(?:\s+me)?\s+(?:the\s+)?(?:night\s+|real\s+|live\s+)?sky(?:\s+(?:tonight|now|right\s+now|above\s+me|over\s+me))?$|^what'?s?\s+(?:is\s+)?in\s+the\s+sky(?:\s+(?:tonight|now|right\s+now))?$|^(?:the\s+)?(?:night\s+)?sky\s+(?:tonight|right\s+now|now)$|^what\s+does\s+the\s+sky\s+look\s+like(?:\s+(?:tonight|now|right\s+now))?$|^stargazing$|^night\s+sky$/.test(t)) return { show: true };
  return null;
}

// a rough place from the time zone when the browser gives no location: the longitude from the offset, the latitude from
// the hemisphere the zone's region sits in. Good enough to put the right stars up; the label says "about".
const SOUTH = /^(?:Australia|Antarctica)\/|^Pacific\/(?:Auckland|Chatham|Fiji|Tongatapu|Noumea)|^America\/(?:Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima)|^Africa\/(?:Johannesburg|Maputo|Harare|Windhoek|Gaborone|Lusaka)|^Indian\/(?:Mauritius|Reunion)/;
export function placeFromZone(zone, offsetMinutes) {
  const lonE = Math.max(-180, Math.min(180, -offsetMinutes / 4)) || 0; // never -0
  return { lat: SOUTH.test(String(zone || '')) ? -34 : 45, lonE, rough: true };
}

/** the panorama: azimuth across (a 200° field centred on the pole the observer faces away from), altitude up */
export function project(alt, az, W, H, centerAz) {
  const d = ((az - centerAz + 540) % 360) - 180, hY = H * 0.8, top = H * 0.06;
  return { x: W / 2 + d * (W / 200), y: hY - (alt / 90) * (hY - top), visible: Math.abs(d) <= 100 && alt > -2 };
}
/** the sky's colour from the sun's altitude: day blue, the twilights, night */
export function skyColor(sunAlt) {
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, k))));
  const night = [[2, 4, 12], [8, 12, 28]], twilight = [[18, 26, 58], [196, 112, 74]], day = [[52, 112, 196], [160, 200, 240]];
  const [top, bottom] = sunAlt >= 6 ? day : sunAlt >= -6 ? [mix(twilight[0], day[0], (sunAlt + 6) / 12), mix(twilight[1], day[1], (sunAlt + 6) / 12)]
    : [mix(night[0], twilight[0], (sunAlt + 18) / 12), mix(night[1], twilight[1], (sunAlt + 18) / 12)];
  return { top: 'rgb(' + top.join(',') + ')', bottom: 'rgb(' + bottom.join(',') + ')', stars: Math.max(0, Math.min(1, (-sunAlt - 4) / 8)) };
}
export const starRadius = (mag) => Math.max(0.7, 2.6 - 0.55 * mag);
const PLANET_COLOR = { mercury: '#c9b9a6', venus: '#fff4d6', mars: '#e8805a', jupiter: '#f2dcb4', saturn: '#e8d49a', uranus: '#a8e0e6', neptune: '#8fa8f0' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function draw(cv, now, place) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || innerWidth, H = cv.clientHeight || innerHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); if (!g) return null;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = sky(now, place.lat, place.lonE), col = skyColor(s.sun.alt), center = place.lat >= 0 ? 180 : 0, hY = H * 0.8;
  const sk = g.createLinearGradient(0, 0, 0, hY); sk.addColorStop(0, col.top); sk.addColorStop(1, col.bottom);
  g.fillStyle = sk; g.fillRect(0, 0, W, hY);
  // stars, faded in by the twilight
  if (col.stars > 0) for (const st of s.stars) {
    const p = project(st.alt, st.az, W, H, center); if (!p.visible || st.alt < 0) continue;
    g.globalAlpha = col.stars * (st.mag < 0.5 ? 1 : 0.85); g.fillStyle = '#fff';
    g.beginPath(); g.arc(p.x, p.y, starRadius(st.mag), 0, Math.PI * 2); g.fill();
    if (st.mag < 1.3) { g.globalAlpha = col.stars * 0.7; g.font = '11px ui-sans-serif, system-ui, sans-serif'; g.fillStyle = '#c8d2ee'; g.fillText(st.name, p.x + 5, p.y - 4); }
  }
  g.globalAlpha = 1;
  // planets, named
  for (const pl of s.planets) {
    if (pl.alt < 0 || (s.sun.alt > -4 && pl.name !== 'venus' && pl.name !== 'jupiter')) continue;
    const p = project(pl.alt, pl.az, W, H, center); if (!p.visible) continue;
    g.fillStyle = PLANET_COLOR[pl.name]; g.beginPath(); g.arc(p.x, p.y, 2.8, 0, Math.PI * 2); g.fill();
    g.font = '12px ui-sans-serif, system-ui, sans-serif'; g.fillStyle = '#e8ecf8'; g.fillText(cap(pl.name), p.x + 6, p.y + 4);
  }
  // the moon in its phase: lit on the sun's side; the terminator is an ellipse whose width follows the lit fraction
  if (s.moon.alt > -1) {
    const p = project(s.moon.alt, s.moon.az, W, H, center), r = 11;
    if (p.visible) {
      g.fillStyle = 'rgba(40,44,56,0.9)'; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      const k = s.moon.fraction, side = s.moon.waxing === (place.lat >= 0) ? 1 : -1, w = r * Math.abs(1 - 2 * k);
      g.fillStyle = '#ecebe4'; g.beginPath();
      g.arc(p.x, p.y, r, -Math.PI / 2, Math.PI / 2, side < 0);
      g.ellipse(p.x, p.y, w, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0.5) === (side < 0));
      g.fill();
      g.font = '12px ui-sans-serif, system-ui, sans-serif'; g.fillStyle = '#e8ecf8'; g.fillText('Moon · ' + Math.round(k * 100) + '% lit', p.x + r + 6, p.y + 4);
    }
  }
  // the sun, with its glow
  if (s.sun.alt > -1) {
    const p = project(s.sun.alt, s.sun.az, W, H, center);
    if (p.visible) {
      const glow = g.createRadialGradient(p.x, p.y, 4, p.x, p.y, 80); glow.addColorStop(0, 'rgba(255,240,200,0.9)'); glow.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = glow; g.fillRect(p.x - 80, p.y - 80, 160, 160);
      g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(p.x, p.y, 14, 0, Math.PI * 2); g.fill();
    }
  }
  // the ground and the compass
  g.fillStyle = s.sun.alt > 0 ? '#1d2418' : '#05070a'; g.fillRect(0, hY, W, H - hY);
  g.font = '12px ui-sans-serif, system-ui, sans-serif'; g.fillStyle = 'rgba(220,226,240,0.7)';
  for (const [az, n] of [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']]) {
    const p = project(0, az, W, H, center); if (p.visible) g.fillText(n, p.x - 6, hY + 18);
  }
  const at = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  g.fillStyle = 'rgba(220,226,240,0.6)'; g.fillText('The sky over ' + (place.rough ? 'about ' : '') + Math.abs(place.lat).toFixed(1) + '°' + (place.lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(place.lonE).toFixed(1) + '°' + (place.lonE >= 0 ? 'E' : 'W') + ' · ' + at + (place.rough ? ' · place from your time zone' : ''), 16, hY + 40);
  return s;
}

const world = {
  mount(host, ctx) {
    const cv = document.createElement('canvas'); cv.className = 'night-sky'; cv.style.cssText = 'width:100%;height:100%;display:block';
    host.appendChild(cv);
    const opts = ctx.opts || {}, now = () => (opts.at ? new Date(opts.at) : new Date());
    let zone = ''; try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {}
    let place = opts.place || placeFromZone(zone, new Date().getTimezoneOffset()), last = null;
    const paint = () => { last = draw(cv, now(), place); window.__voidSky = { place, sun: last && last.sun, moon: last && last.moon, planets: last && last.planets.filter((p) => p.alt > 0).map((p) => p.name) }; };
    paint();
    if (!opts.place && navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => { place = { lat: p.coords.latitude, lonE: p.coords.longitude, rough: false }; paint(); }, () => {}, { timeout: 8000, maximumAge: 600000 });
    const iv = setInterval(paint, 60000); // the sky moves a quarter of a degree a minute: once a minute is plenty, and calm
    const onResize = () => paint(); addEventListener('resize', onResize);
    return { update: paint, dispose() { clearInterval(iv); removeEventListener('resize', onResize); delete window.__voidSky; } };
  },
};

async function run(text, api) {
  const q = nightSkyOf(text);
  if (!q || !api.stage.setWorld) return 'none';
  if (q.hide) { api.stage.setWorld(null); api.say('Back to the void'); return 'nightsky'; }
  api.stage.setWorld('nightsky');
  api.say('The sky over you, right now · it follows the clock · "hide the sky" to go back');
  return 'nightsky';
}

export default {
  name: 'nightsky',
  nightSkyOf,
  examples: ['show me the sky', 'show the night sky', "what's in the sky tonight", 'what is in the sky right now', 'night sky', 'hide the sky'],
  nearMisses: ['why is the sky blue', 'sky news', 'skyrim', 'the sky is the limit', 'blue sky thinking', 'moon phase tonight', 'show me the stars of the show'],
  match(lower, text) { return !!nightSkyOf(text); },
  run,
  world,
};
