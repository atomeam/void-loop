// The aurora index (frontier #21, sky part 2): NOAA's planetary K-index says how far from the poles the aurora reaches tonight; at the
// visitor's latitude, and only in the dark, that becomes a green lean on the sky's glow. Pure functions, no network: the feed is read by
// functions/api/aurora.js and the page asks that route, so a visitor's browser never talks to NOAA.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// the feed has been two shapes: an array of rows with a header row, and an array of objects; either way the newest reading counts
export function parseKp(json) {
  if (!Array.isArray(json) || json.length === 0) return null;
  let best = null;
  for (const row of json) {
    let at, kp;
    if (Array.isArray(row)) { at = row[0]; kp = row[1]; } else if (row && typeof row === 'object') { at = row.time_tag; kp = row.Kp != null ? row.Kp : row.kp_index; } else continue;
    const k = Number(kp), t = Date.parse(String(at || '').replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(at)) ? '' : 'Z'));
    if (!Number.isFinite(k) || k < 0 || k > 9 || !Number.isFinite(t)) continue; // the header row and anything odd fall out here
    if (!best || t > best.t) best = { t, kp: k };
  }
  return best ? { kp: best.kp, at: new Date(best.t).toISOString() } : null;
}

// how strongly the aurora reaches a latitude: the oval's edge comes down about 3.5° of latitude per step of Kp from 66° (Kp 9 reaches ~34°);
// ten degrees poleward of the edge it is overhead. 0 at the edge or beyond, 1 well inside it. Geographic latitude, so only a rough guide.
export function auroraStrength(kp, lat) {
  const k = Number(kp), l = Math.abs(Number(lat));
  if (!Number.isFinite(k) || !Number.isFinite(l)) return 0;
  return clamp((l - (66 - 3.5 * clamp(k, 0, 9))) / 10, 0, 1);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
// lean a sky tint toward aurora green: only after dark (daylight 0..1 from skyOf), never more than a third of the way, so it stays a void
export function tintWithAurora(glow, strength, daylight = 0) {
  const s = clamp(Number(strength) || 0, 0, 1) * (1 - clamp(Number(daylight) || 0, 0, 1)) * 0.34;
  if (!(s > 0) || !/^#[0-9a-f]{6}$/i.test(glow || '')) return glow;
  const a = hex(glow), g = [14, 70, 44];
  return toHex(a.map((v, i) => v + (g[i] - v) * s));
}
