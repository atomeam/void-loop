/**
 * gradient: a CSS gradient made, read back and shared (owner, 2026-10-24: "find the site to conquer and get to work now"; the tower's frontier
 * ranked colorzilla.com, Tranco 101,274, whose gradient editor is the best-known one: colour stops with position and opacity, linear or radial,
 * presets, CSS import, CSS output). Here: linear, radial and conic, any number of stops, each a colour with opacity and a position, the CSS
 * written and READ BACK (paste any gradient a stylesheet holds and edit it), a fallback colour for old browsers (the average of the stops), the
 * whole gradient in a short link, and the worst text contrast across it for white and black text (lib/colour.js), which no gradient editor
 * gives. Pure; the page and the card use it.
 * Tests: tools/gradient.test.mjs.
 */
import { parse as parseColour, toHex, contrast, NAMES, rgbToHsl, hslToRgb } from './colour.js';

export const TYPES = Object.freeze(['linear', 'radial', 'conic']);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/** a colour with opacity from what CSS or a person writes: { r, g, b, a } or null; "transparent" is black at 0. Pure. */
export function colourOf(text) {
  const t = String(text || '').trim().toLowerCase();
  if (t === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  let m = /^#([0-9a-f]{8})$/.exec(t);
  if (m) { const c = parseColour('#' + m[1].slice(0, 6)); return c && { ...c, a: round(parseInt(m[1].slice(6), 16) / 255, 3) }; }
  m = /^#([0-9a-f]{4})$/.exec(t);
  if (m) { const c = parseColour('#' + m[1].slice(0, 3)); return c && { ...c, a: round(parseInt(m[1][3] + m[1][3], 16) / 255, 3) }; }
  m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(t);
  if (m) {
    const parts = m[2].split(/\s*[,/]\s*|\s+/).filter(Boolean); let a = 1;
    if (parts.length === 4) { const x = parts.pop(); a = /%$/.test(x) ? parseFloat(x) / 100 : parseFloat(x); }
    const c = parseColour(m[1].replace(/a$/, '') + '(' + parts.join(', ') + ')'); return c && Number.isFinite(a) ? { ...c, a: round(clamp(a, 0, 1), 3) } : null;
  }
  const c = parseColour(t); return c ? { ...c, a: 1 } : null;
}
/** a colour as CSS: #rrggbb when opaque, rgba() otherwise. Pure. */
export const cssColour = (c) => (c.a >= 1 ? toHex(c) : 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + round(c.a, 3) + ')');

/** a gradient made whole: a known type, an angle 0..359, at least two stops sorted by position (0..100), each { color: {r,g,b,a}, pos }. Pure. */
export function normal(g) {
  const type = TYPES.includes(g && g.type) ? g.type : 'linear', angle = ((Math.round(Number(g && g.angle) || 0) % 360) + 360) % 360;
  let stops = ((g && g.stops) || []).map((s) => ({ color: typeof s.color === 'string' ? colourOf(s.color) : s.color, pos: s.pos })).filter((s) => s.color);
  if (stops.length < 2) return null;
  stops = stops.map((s, i, all) => ({ color: s.color, pos: Number.isFinite(Number(s.pos)) && s.pos !== null && s.pos !== '' ? round(clamp(Number(s.pos), 0, 100)) : round((i / (all.length - 1)) * 100) }));
  stops.sort((a, b) => a.pos - b.pos);
  return { type, angle, shape: g && g.shape === 'circle' ? 'circle' : 'ellipse', stops };
}
/** the CSS background-image value of a gradient. Pure. */
export function css(g) {
  const n = normal(g); if (!n) return '';
  const list = n.stops.map((s) => cssColour(s.color) + ' ' + s.pos + '%').join(', ');
  if (n.type === 'radial') return 'radial-gradient(' + n.shape + ' at center, ' + list + ')';
  if (n.type === 'conic') return 'conic-gradient(from ' + n.angle + 'deg at center, ' + list + ')';
  return 'linear-gradient(' + n.angle + 'deg, ' + list + ')';
}
/** the colour old browsers show instead: the stops' average, weighted by the stretch each covers. Pure. */
export function fallback(g) {
  const n = normal(g); if (!n) return '';
  const s = n.stops, w = s.map((x, i) => ((i ? x.pos - s[i - 1].pos : x.pos) + (i < s.length - 1 ? s[i + 1].pos - x.pos : 100 - x.pos)) / 2 || 1e-9), sum = w.reduce((a, b) => a + b, 0);
  const avg = (k) => s.reduce((a, x, i) => a + x.color[k] * w[i], 0) / sum;
  return toHex({ r: avg('r'), g: avg('g'), b: avg('b') });
}
/** the full rule a stylesheet takes: the fallback colour, then the gradient. Pure. */
export const rule = (g) => { const c = css(g); return c ? 'background-color: ' + fallback(g) + ';\nbackground-image: ' + c + ';' : ''; };
/** where a gradient lies on a w × h picture, as CSS draws it: a linear one's line (through the middle, long enough that its ends meet the
 *  corners), a radial one's centre and radii (farthest-corner, the CSS default), a conic one's centre and its start as a canvas angle
 *  (canvas counts from the right, CSS from the top). Pure. */
export function geometry(g, w, h) {
  const n = normal(g); if (!n || !(w > 0) || !(h > 0)) return null;
  const cx = w / 2, cy = h / 2;
  if (n.type === 'radial') return n.shape === 'circle' ? { type: 'radial', cx, cy, rx: Math.hypot(cx, cy), ry: Math.hypot(cx, cy) } : { type: 'radial', cx, cy, rx: cx * Math.SQRT2, ry: cy * Math.SQRT2 };
  const a = (n.angle * Math.PI) / 180;
  if (n.type === 'conic') return { type: 'conic', cx, cy, start: a - Math.PI / 2 };
  const len = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a)), dx = (Math.sin(a) * len) / 2, dy = (-Math.cos(a) * len) / 2;
  return { type: 'linear', x0: cx - dx, y0: cy - dy, x1: cx + dx, y1: cy + dy };
}
/** draw a gradient on a 2D canvas context of w × h, the way the CSS shows it (the picture other pages take). true when drawn. */
export function drawGradient(ctx, g, w, h) {
  const n = normal(g), at = geometry(n, w, h); if (!at) return false;
  let fill, scaleY = 1;
  if (at.type === 'linear') fill = ctx.createLinearGradient(at.x0, at.y0, at.x1, at.y1);
  else if (at.type === 'conic') { if (!ctx.createConicGradient) return false; fill = ctx.createConicGradient(at.start, at.cx, at.cy); }
  else { scaleY = at.ry / at.rx; fill = ctx.createRadialGradient(at.cx, at.cy / scaleY, 0, at.cx, at.cy / scaleY, at.rx); }
  for (const st of n.stops) fill.addColorStop(clamp(st.pos / 100, 0, 1), cssColour(st.color));
  ctx.save(); ctx.clearRect(0, 0, w, h); ctx.scale(1, scaleY); ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h / scaleY); ctx.restore();
  return true;
}

const STOP = /((?:#[0-9a-f]{3,8})|(?:rgba?|hsla?)\([^)]*\)|[a-z]+)(?:\s+(-?[\d.]+)%)?/gi;
/** a gradient read back from CSS ("linear-gradient(90deg, #f00 0%, rgba(0,0,255,.5) 100%)", "to right", "radial-gradient(circle, ...)",
 *  "conic-gradient(from 45deg, ...)", with or without "background:" in front), or null. Pure. */
export function read(text) {
  const t = String(text || '').trim().replace(/^background(?:-image)?\s*:\s*/i, '').replace(/;\s*$/, '');
  const m = /^(?:-webkit-|-moz-)?(linear|radial|conic|repeating-linear|repeating-radial)-gradient\(([\s\S]*)\)$/i.exec(t); if (!m) return null;
  const type = m[1].toLowerCase().replace('repeating-', ''); let body = m[2].trim(), angle = type === 'linear' ? 180 : 0, shape = 'ellipse';
  const head = /^([^,(]*(?:\([^)]*\))?[^,(]*),/.exec(body), first = head ? head[1].trim().toLowerCase() : '';
  const DIRS = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270, 'to top right': 45, 'to right top': 45, 'to bottom right': 135, 'to right bottom': 135, 'to bottom left': 225, 'to left bottom': 225, 'to top left': 315, 'to left top': 315 };
  if (head && !colourOf(first.split(/\s+/)[0])) {
    if (type === 'linear') { const d = /^(-?[\d.]+)(deg|turn|rad)$/.exec(first); angle = d ? Number(d[1]) * (d[2] === 'turn' ? 360 : d[2] === 'rad' ? 180 / Math.PI : 1) : DIRS[first] !== undefined ? DIRS[first] : 180; }
    if (type === 'radial' && /\bcircle\b/.test(first)) shape = 'circle';
    if (type === 'conic') { const d = /from\s+(-?[\d.]+)deg/.exec(first); angle = d ? Number(d[1]) : 0; }
    body = body.slice(head[0].length);
  }
  const stops = []; for (const s of body.split(/,(?![^(]*\))/)) { STOP.lastIndex = 0; const x = STOP.exec(s.trim()); if (!x) return null; const c = colourOf(x[1]); if (!c) return null; stops.push({ color: c, pos: x[2] === undefined ? null : Number(x[2]) }); }
  return normal({ type, angle, shape, stops });
}

/** the whole gradient in a short link (hash of the page): "l90-ff0000ff.0-0000ff80.100". Pure; open() reads it back. */
export function pack(g) {
  const n = normal(g); if (!n) return '';
  const a2 = (a) => Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0');
  return n.type[0] + n.angle + (n.type === 'radial' && n.shape === 'circle' ? 'c' : '') + '-' + n.stops.map((s) => toHex(s.color).slice(1) + a2(s.color.a) + '.' + s.pos).join('-');
}
/** a packed link read back, or null. Pure. */
export function open(code) {
  const m = /^([lrc])(\d{1,3})(c?)-((?:[0-9a-f]{8}\.[\d.]+-?){2,16})$/i.exec(String(code || '').trim()); if (!m) return null;
  const stops = m[4].split('-').filter(Boolean).map((p) => ({ color: colourOf('#' + p.slice(0, 8)), pos: Number(p.slice(9)) }));
  return normal({ type: { l: 'linear', r: 'radial', c: 'conic' }[m[1].toLowerCase()], angle: Number(m[2]), shape: m[3] ? 'circle' : 'ellipse', stops });
}

/** the worst contrast for white and for black text anywhere along the gradient (sampled at 50 points, opacity over a white page):
 *  { white, black, text } where text is the one that stays readable best. Pure. */
export function textContrast(g) {
  const n = normal(g); if (!n) return null;
  const at = (p) => { const s = n.stops; let i = s.findIndex((x) => x.pos >= p); if (i <= 0) return s[i === 0 ? 0 : s.length - 1].color; const a = s[i - 1], b = s[i], k = b.pos === a.pos ? 0 : (p - a.pos) / (b.pos - a.pos); const mix = (q) => a.color[q] + (b.color[q] - a.color[q]) * k; return { r: mix('r'), g: mix('g'), b: mix('b'), a: mix('a') }; };
  const W = { r: 255, g: 255, b: 255 }, K = { r: 0, g: 0, b: 0 }; let white = 21, black = 21;
  for (let i = 0; i <= 50; i++) { const c = at(i * 2), o = { r: c.r * c.a + 255 * (1 - c.a), g: c.g * c.a + 255 * (1 - c.a), b: c.b * c.a + 255 * (1 - c.a) }; white = Math.min(white, contrast(o, W)); black = Math.min(black, contrast(o, K)); }
  return { white: round(white, 2), black: round(black, 2), text: black >= white ? '#000000' : '#FFFFFF' };
}

/** the stops in the other order (colorzilla's "reverse"). Pure. */
export function reverse(g) { const n = normal(g); return n && { ...n, stops: n.stops.map((x) => ({ color: x.color, pos: round(100 - x.pos) })).reverse() }; }
/** every stop's hue turned by `dh` degrees and its saturation scaled by `ks` (colorzilla's "hue/saturation"), opacity kept. Pure. */
export function adjust(g, dh = 0, ks = 1) {
  const n = normal(g); if (!n) return null;
  return { ...n, stops: n.stops.map((x) => { const h = rgbToHsl(x.color), c = hslToRgb(h.h + dh, clamp(h.s * ks, 0, 100), h.l); return { color: { ...c, a: x.color.a }, pos: x.pos }; }) };
}
/** a stop colour written the way a stylesheet prefers: 'hex' (#rrggbb, or #rrggbbaa with opacity), 'rgb' (rgb()/rgba()), 'hsl' (hsl()/hsla()). Pure. */
export function inFormat(c, f = 'hex') {
  const a = round(c.a, 3);
  if (f === 'rgb') return a >= 1 ? 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')' : 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + a + ')';
  if (f === 'hsl') { const h = rgbToHsl(c), x = Math.round(h.h) % 360 + ', ' + Math.round(h.s) + '%, ' + Math.round(h.l) + '%'; return a >= 1 ? 'hsl(' + x + ')' : 'hsla(' + x + ', ' + a + ')'; }
  return a >= 1 ? toHex(c) : toHex(c) + Math.round(a * 255).toString(16).padStart(2, '0');
}
/** css() with the stops in a chosen format. Pure. */
export const cssIn = (g, f = 'hex') => { const n = normal(g); if (!n) return ''; return css(n).replace(/(#[0-9a-f]{6}|rgba\([^)]*\)) (\d+(?:\.\d+)?%)/g, (m0, col, pos) => inFormat(colourOf(col), f) + ' ' + pos); };
/** the SCSS a design system keeps: a variable per stop and the gradient built from them. Pure. */
export function scss(g, name = 'gradient', f = 'hex') {
  const n = normal(g); if (!n) return '';
  const vars = n.stops.map((x, i) => '$' + name + '-' + (i + 1) + ': ' + inFormat(x.color, f) + ';').join('\n');
  return vars + '\n$' + name + ': ' + css(n).replace(/(#[0-9a-f]{6}|rgba\([^)]*\)) (\d+(?:\.\d+)?%)/g, (() => { let i = 0; return (m0, c, pos) => '$' + name + '-' + (++i) + ' ' + pos; })()) + ';';
}
/** a gradient from colours sampled along a picture (colorzilla's "import image"): `samples` evenly spaced [{r,g,b}], kept as the fewest stops
 *  that redraw every sample within `tol` (each channel, 0-255), at most `max`; the picture never leaves the device. Pure. */
export function fromSamples(samples, { angle = 90, tol = 24, max = 8 } = {}) {
  const s = (samples || []).filter((c) => c && [c.r, c.g, c.b].every(Number.isFinite)); if (s.length < 2) return null;
  const keep = [0, s.length - 1];
  const worst = () => { let at = -1, err = tol; keep.sort((a, b) => a - b); for (let k = 1; k < keep.length; k++) { const i0 = keep[k - 1], i1 = keep[k]; for (let i = i0 + 1; i < i1; i++) { const t = (i - i0) / (i1 - i0), e = Math.max(...['r', 'g', 'b'].map((q) => Math.abs(s[i0][q] + (s[i1][q] - s[i0][q]) * t - s[i][q]))); if (e > err) { err = e; at = i; } } } return at; };
  for (let w; keep.length < max && (w = worst()) >= 0;) keep.push(w);
  keep.sort((a, b) => a - b);
  return normal({ type: 'linear', angle, stops: keep.map((i) => ({ color: { r: Math.round(s[i].r), g: Math.round(s[i].g), b: Math.round(s[i].b), a: 1 }, pos: round((i / (s.length - 1)) * 100) })) });
}

// presets: plain, well-known pairings, nothing borrowed from a site's own preset list
export const PRESETS = Object.freeze([
  { name: 'Sunset', g: { type: 'linear', angle: 135, stops: [{ color: '#ff5f6d', pos: 0 }, { color: '#ffc371', pos: 100 }] } },
  { name: 'Ocean', g: { type: 'linear', angle: 180, stops: [{ color: '#2193b0', pos: 0 }, { color: '#6dd5ed', pos: 100 }] } },
  { name: 'Violet', g: { type: 'linear', angle: 90, stops: [{ color: '#6d4aff', pos: 0 }, { color: '#c86dd7', pos: 100 }] } },
  { name: 'Forest', g: { type: 'linear', angle: 160, stops: [{ color: '#134e5e', pos: 0 }, { color: '#71b280', pos: 100 }] } },
  { name: 'Fade to clear', g: { type: 'linear', angle: 180, stops: [{ color: '#000000', pos: 0 }, { color: 'rgba(0, 0, 0, 0)', pos: 100 }] } },
  { name: 'Spotlight', g: { type: 'radial', shape: 'circle', stops: [{ color: '#fff7c2', pos: 0 }, { color: '#f7b733', pos: 45 }, { color: '#1f1c2c', pos: 100 }] } },
  { name: 'Colour wheel', g: { type: 'conic', angle: 0, stops: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'].map((color, i) => ({ color, pos: round((i / 6) * 100) })) } },
]);

// the asks: "gradient generator", "css gradient", "make a gradient from red to blue", "gradient from #ff5f6d to #ffc371", "linear gradient generator"
const NAMED = Object.keys(NAMES).join('|');
const COL = '(#[0-9a-f]{3,8}|' + NAMED + ')';
/** what an ask wants: { g } (a gradient, maybe the default) or null. Pure. */
export function askGradient(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  // a gradient written as CSS, "css gradient linear-gradient(135deg, #ff5f6d 0%, #ffc371 100%)": what the gradient page's own stage link asks,
  // so its card opens on every stop, angle and type the page has (owner via the team, 2026-10-29), not on two colours at 90 degrees
  const w = /^(?:(?:show|open)\s+(?:me\s+)?)?(?:the\s+|this\s+|a\s+)?(?:css\s+)?gradient:?\s+((?:repeating-)?(?:linear|radial|conic)-gradient\(.+\))$/.exec(t);
  if (w && t.length <= 1200) { const r = read(w[1]); if (r) return { g: r }; }
  if (t.length > 120) return null;
  let m = new RegExp('^(?:make|create|generate|show|give)?\\s*(?:me\\s+)?(?:an?\\s+)?(?:(linear|radial|conic)\\s+)?(?:css\\s+)?gradient\\s+(?:from\\s+)?' + COL + '\\s+(?:to|and|into)\\s+' + COL + '$').exec(t);
  if (m) return { g: normal({ type: m[1] || 'linear', angle: 90, stops: [{ color: m[2] }, { color: m[3] }] }) };
  m = /^(?:(?:a|the)\s+)?(?:(linear|radial|conic)\s+)?(?:css\s+)?(?:colou?r\s+)?gradient(?:\s+(?:generator|maker|editor|creator|tool|background))?$/.exec(t);
  if (m && (/\b(?:generator|maker|editor|creator|tool|background|css)\b/.test(t) || m[1])) return { g: normal({ ...PRESETS[2].g, type: m[1] || 'linear' }) };
  if (/^(?:css|ultimate css|colorzilla)\s+gradient(?:\s+generator)?$|^gradient\s+css(?:\s+generator)?$/.test(t)) return { g: normal(PRESETS[2].g) };
  // "make a 2d sunset with blue and orange", "render a sphere with pink to blue": a thing drawn in two named colours (a sphere is radial).
  // Both colours must be named, so "make a list with milk, eggs" or "make a plan with sam" are not gradients.
  m = new RegExp('^(?:make|render|create|draw|generate)\\s+(?:me\\s+)?an?\\s+([a-z0-9 ]{1,30}?)\\s+with\\s+' + COL + '\\s+(?:to|and|into)\\s+' + COL + '$').exec(t);
  if (m) return { g: normal({ type: /\b(?:sphere|ball|orb|circle|sun)\b/.test(m[1]) ? 'radial' : 'linear', angle: /\b(?:sunset|sunrise|sky|horizon)\b/.test(m[1]) ? 180 : 90, stops: [{ color: m[2] }, { color: m[3] }] }) };
  return null;
}
