// void-seal — Verse's card art, drawn in the browser from a seed. Same key, same picture, on every device, with no model and nothing sent anywhere.
// The look (owner, 2026-10-30: "get rid of all the old art lets come up with a moder professional sleek look for everything"): quiet light. A
// near-black ground in the family's hue, two or three large soft fields of colour like light through frosted glass, one set of hairlines that the
// seed composes (rings, currents, rays, a band or orbits), a few points of light, a fine grain, and the card's subject as a clean lit icon.
// The family's hue tints it; the rarity sets how much light it has (a Mythic carries a gold sheen and more lines, a Common is plainest).
// Pure apart from the canvas it is handed: sealPlan(seed, opts) returns plain numbers (tested), drawSeal(ctx, w, h, plan) draws them.

import { motifsFor, motifPaths, motifHue, GROUNDED } from './card-subject.js';

export const VERSION = 4; // 4: quiet light (2026-10-30); 3 was the atom galaxy, 2 the flow field
/** FNV-1a 32-bit of a string. Pure. */
export function seedOf(s) { let h = 0x811c9dc5; for (const ch of String(s == null ? '' : s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
/** a seeded generator (mulberry32). Pure. */
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the light by rarity: particle count, how bright each stroke is, how much bloom, how many lattice rings
export const LIGHT = { mythic: { n: 1500, a: 0.075, bloom: 0.38, rings: 5, gold: 1 }, rare: { n: 1250, a: 0.065, bloom: 0.32, rings: 4, gold: 0.7 }, uncommon: { n: 1050, a: 0.055, bloom: 0.28, rings: 3, gold: 0.35 }, common: { n: 900, a: 0.05, bloom: 0.24, rings: 2, gold: 0 } };
// the composition, picked by the seed: what the hairlines draw
export const FORMS = ['vortex', 'currents', 'burst', 'rift', 'orbit'];
// the core's shape by kind: sides of the lattice polygon (0 = an eye), and whether rays burst from it
const CORE = { Film: [8, 1], Show: [6, 1], Album: [0, 0], Song: [0, 1], Band: [5, 1], Game: [4, 1], Book: [4, 0], Person: [0, 0], Place: [3, 0], Creature: [0, 1], Organisation: [6, 0], Event: [12, 1], Idea: [6, 1], Answer: [0, 1], Skill: [5, 0], Miniature: [4, 1] };
const rarityKey = (r) => { const w = String(r && typeof r === 'object' ? r.name : r || '').toLowerCase(); return ({ proven: 'mythic', checked: 'rare', tested: 'uncommon', experiment: 'common' })[w] || (LIGHT[w] ? w : 'common'); };

/** everything the picture is, as numbers: same key, kind, hue and rarity in, same plan out. Pure. */
export function sealPlan(key, { kind = 'Idea', hue = null, rarity = 'common', nouns = null } = {}) {
  const seed = seedOf(String(key || '').toLowerCase().trim() + '|' + kind), r = rng(seed), L = LIGHT[rarityKey(rarity)];
  const h = Number.isFinite(+hue) ? ((+hue % 360) + 360) % 360 : Math.floor(r() * 360);
  const [sides, rays] = CORE[kind] || CORE.Idea;
  // the subject's motif: the card's own short name first ("black hole", "cat": the subject), else the answer's words, else nothing (the lines alone)
  const keyWords = String(key || '').toLowerCase().split(/[^a-z]+/).filter(Boolean), motif = kind === 'Person' ? 'person' : (keyWords.length <= 4 && motifsFor(keyWords)[0]) || (motifsFor(nouns || [])[0]) || motifsFor(keyWords)[0] || '';
  const mh = motifHue(motif), main = mh == null ? h : mh; // a dragon burns red and the sea is blue; the family's hue still tints the nebula and the counter-light
  return {
    seed, hue: h, kind, light: L,
    // a palette of three lights on black: the subject's hue (else the family's), a cold counter-hue and a third
    palette: [main, (h + 150 + Math.floor(r() * 60)) % 360, (h + 300 + Math.floor(r() * 40)) % 360],
    field: { scale: 1.6 + r() * 2.2, twist: 0.6 + r() * 1.6, swirl: r() < 0.5 ? 1 : -1, octaves: 3 },
    form: FORMS[Math.floor(r() * FORMS.length)],
    // the card's subject, drawn in light at the core (owner, 2026-10-18: "the art should be of each card's subject"): the answer's words
    // (lib/card-subject.js subjectOf) mapped to a motif, else the key's own words; none found keeps the lines alone
    motif, grounded: GROUNDED.has(motif),
    core: { x: 0.28 + r() * 0.44, y: 0.38 + r() * 0.24, sides, rays, spin: r() * Math.PI * 2, size: 0.3 + r() * 0.12 },
    // the soft fields of light under the lines
    nebula: Array.from({ length: 3 }, () => ({ x: 0.1 + r() * 0.8, y: r(), r: 0.35 + r() * 0.35, c: Math.floor(r() * 3), a: 0.16 + r() * 0.12 })),
    stars: 140 + Math.floor(r() * 120),
    // the points of light: a Mythic has more than a Common
    bolts: { mythic: 7, rare: 5, uncommon: 3, common: 2 }[rarityKey(rarity)],
    lines: { tilt: (r() - 0.5) * 0.9, ratio: 0.3 + r() * 0.25, gap: 6 + r() * 4, rots: Array.from({ length: 6 }, () => (r() - 0.5) * 1.6), at: Array.from({ length: 6 }, () => r() * Math.PI * 2) },
  };
}

// smooth seeded value noise in 2D (bilinear over a hashed lattice with a smoothstep), octaves summed: -1..1
function noise2(seed) {
  const H = (x, y) => { let n = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296 * 2 - 1; };
  const s = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi); const a = H(xi, yi), b = H(xi + 1, yi), c = H(xi, yi + 1), d = H(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  return (x, y, o = 3) => { let t = 0, amp = 1, f = 1, norm = 0; for (let i = 0; i < o; i++) { t += v(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; } return t / norm; };
}
const hsl = (h, s, l, a) => 'hsla(' + Math.round(h) + ',' + s + '%,' + l + '%,' + a + ')';

/** draw the plan on a 2D context of w x h. The only impure part: it paints. */
export function drawSeal(ctx, w, h, p) {
  const r = rng(p.seed ^ 0x9e3779b9), L = p.light, m = Math.min(w, h), M = Math.max(w, h), cx = w / 2, N = noise2(p.seed);
  const msz = p.motif ? Math.min(p.core.size * m * 2.1, h * 0.64) : 0;
  const cy = msz ? Math.max(msz / 2 + h * 0.06, Math.min(h - msz / 2 - h * 0.06, p.core.y * h)) : h * (0.4 + p.core.y * 0.25);
  const [c0, c1] = p.palette, ln = p.lines || { tilt: 0, ratio: 0.4, gap: 8, rots: [0, 0, 0, 0, 0, 0], at: [0, 0, 0, 0, 0, 0] };
  const glow = (x, y, rad, hue, sat, lite, a) => { if (a <= 0.002 || rad < 0.5) return; const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, hsl(hue, sat, lite, a)); g.addColorStop(1, hsl(hue, sat, lite, 0)); ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
  const line = (pts, a, hue) => { ctx.strokeStyle = hsl(hue, 70, 80, a); ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
  const ring = (rx, ry, rot, a, hue) => { const c = Math.cos(rot), s = Math.sin(rot), pts = []; for (let i = 0; i <= 96; i++) { const t = i / 96 * Math.PI * 2, x = Math.cos(t) * rx, y = Math.sin(t) * ry; pts.push([cx + x * c - y * s, cy + x * s + y * c]); } line(pts, a, hue); return (t) => { const x = Math.cos(t) * rx, y = Math.sin(t) * ry; return [cx + x * c - y * s, cy + x * s + y * c]; }; };
  ctx.save();
  // the ground: near black, the family's hue in it, a touch lighter at the top
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, hsl(p.hue, 24, 10, 1)); bg.addColorStop(1, hsl(p.hue, 20, 5, 1));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // the light: large soft fields of colour
  ctx.globalCompositeOperation = 'lighter';
  for (const n of p.nebula) glow(n.x * w, n.y * h, n.r * M, p.palette[n.c], 70, 52, n.a * (0.7 + L.bloom));
  glow(cx, cy, m * 0.7, c0, 80, 60, 0.12 + L.bloom * 0.2);
  // the hairlines the seed composes
  ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const form = p.form || 'vortex', many = 10 + L.rings * 3, sparks = [];
  if (form === 'vortex') { for (let k = 1; k <= many; k++) { const rx = M * 0.04 + k * (M * 0.46 / many); const at = ring(rx, rx * ln.ratio, ln.tilt, 0.05 + 0.2 * (1 - k / many), k % 3 ? c0 : c1); if (k % 4 === 0) sparks.push(at(ln.at[k % 6] + k)); } }
  else if (form === 'orbit') { for (let k = 0; k < 2 + L.rings; k++) { const rx = M * (0.16 + 0.07 * k); const at = ring(rx, rx * ln.ratio, ln.rots[k % 6], 0.26 - k * 0.025, k % 2 ? c1 : c0); sparks.push(at(ln.at[k % 6])); } }
  else if (form === 'currents') { const n = 14 + L.rings * 3, sc = p.field.scale; for (let i = 0; i < n; i++) { const y0 = (i + 0.5) / n * h, pts = []; for (let x = -8; x <= w + 8; x += 6) pts.push([x, y0 + N(x / w * sc, y0 / h * sc + i * 0.07, 3) * h * 0.22]); line(pts, 0.04 + 0.16 * Math.exp(-(((y0 - cy) / (h * 0.32)) ** 2)), i % 3 ? c0 : c1); if (i % 5 === 2) sparks.push(pts[Math.floor(pts.length * (0.2 + r() * 0.6))]); } }
  else if (form === 'burst') { const n = 56 + L.rings * 10; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2 + ln.tilt, len = m * (0.3 + 0.35 * (N(Math.cos(t) * 2, Math.sin(t) * 2, 2) + 1) / 2), r0 = m * 0.12;
      line([[cx + Math.cos(t) * r0, cy + Math.sin(t) * r0], [cx + Math.cos(t) * (r0 + len), cy + Math.sin(t) * (r0 + len)]], 0.06 + 0.14 * r(), i % 4 ? c0 : c1); if (i % 17 === 5) sparks.push([cx + Math.cos(t) * (r0 + len), cy + Math.sin(t) * (r0 + len)]); } }
  else { const t = ln.tilt * 0.6 - 0.35, c = Math.cos(t), s = Math.sin(t), span = Math.hypot(w, h), n = Math.ceil(span / ln.gap); for (let i = -n; i <= n; i++) { const d = i * ln.gap * 0.5, a = 0.02 + 0.24 * Math.exp(-((d / (M * 0.11)) ** 2)); if (a < 0.03) continue;
      const x0 = cx - c * span - s * d, y0 = cy - s * span + c * d; line([[x0, y0], [x0 + c * span * 2, y0 + s * span * 2]], a, i % 3 ? c0 : c1); if (i === 0) sparks.push([cx, cy]); } }
  // the points of light
  for (let i = 0; i < p.bolts; i++) { const [x, y] = sparks[i % Math.max(1, sparks.length)] || [cx + (r() - 0.5) * w * 0.6, cy + (r() - 0.5) * h * 0.6], j = i < sparks.length ? 0 : 1; glow(x + j * (r() - 0.5) * m * 0.3, y, m * 0.05, c0, 90, 70, 0.4); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5); }
  // a Mythic's gold sheen along the top
  if (L.gold) { const g = ctx.createLinearGradient(0, 0, 0, h * 0.35); g.addColorStop(0, hsl(44, 90, 70, 0.14 * L.gold)); g.addColorStop(1, hsl(44, 90, 70, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.35); }
  // the subject: a clean lit icon on a soft halo
  const paths = p.motif && typeof Path2D === 'function' ? motifPaths(p.motif) : null;
  if (paths) {
    const sz = msz; glow(cx, cy, sz * 0.72, c0, 90, 62, 0.22);
    ctx.save(); ctx.translate(cx - sz / 2, cy - sz / 2); ctx.scale(sz / 100, sz / 100);
    const shapes = paths.map(([d, f]) => [new Path2D(d), f]);
    ctx.globalCompositeOperation = 'source-over';
    const lit = ctx.createLinearGradient(0, 0, 0, 100); lit.addColorStop(0, hsl(c0, 70, 82, 0.96)); lit.addColorStop(1, hsl(c0, 55, 56, 0.96));
    for (const [P, f] of shapes) if (f !== 'N') { ctx.fillStyle = f === 'I' ? hsl(p.hue, 30, 8, 0.92) : f === 'G' ? 'hsla(44,85%,62%,0.95)' : f === 'R' ? 'hsla(5,75%,56%,0.95)' : f === 'L' ? hsl(c0, 70, 88, 0.96) : lit; ctx.fill(P); }
    ctx.lineWidth = 100 / Math.max(40, sz) * 1.2; ctx.strokeStyle = hsl(c0, 90, 92, 0.85);
    for (const [P] of shapes) ctx.stroke(P);
    ctx.restore();
  }
  // a fine grain, for a printed finish
  ctx.globalCompositeOperation = 'source-over';
  const grains = Math.max(1800, Math.round(w * h / 26));
  for (let i = 0; i < grains; i++) { const b = r(); ctx.fillStyle = b < 0.5 ? 'rgba(255,255,255,' + (0.012 + b * 0.05).toFixed(3) + ')' : 'rgba(0,0,0,' + (0.03 + (b - 0.5) * 0.12).toFixed(3) + ')'; ctx.fillRect(r() * w, r() * h, 1, 1); }
  const v = ctx.createLinearGradient(0, h * 0.55, 0, h); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// On the card: the art box (.vc-art) gets the seal as a picture under any painted art (lib/card-forge.js lays its image over it) and over
// Verse's ink plate (lib/card-art.js, kept for where no canvas runs and for the saved SVG). Drawn when the browser is idle, once per key and
// size per page (a rebuilt frame reuses the picture). A real photo of the thing is never covered.
export const SEAL_CSS = '.vcard .vc-art>img.vc-seal{position:absolute;inset:0;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;object-fit:cover;display:block;animation:vc-seal-in .6s ease-out 1}.vcard .vc-art.vc-sealed>svg{visibility:hidden}@keyframes vc-seal-in{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.vcard .vc-art .vc-seal{animation:none}}';
const made = new Map();
/** the picture for a plan at w x h CSS pixels (2x for sharpness), as a data URL; '' where no canvas runs */
export function sealUrl(plan, w, h) {
  const k = plan.seed + '|' + plan.hue + '|' + plan.light.n + '|' + plan.motif + '|' + w + 'x' + h; if (made.has(k)) return made.get(k);
  let url = '';
  try { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const ctx = c.getContext('2d'); if (ctx) { ctx.scale(2, 2); drawSeal(ctx, w, h, plan); url = c.toDataURL('image/webp', 0.9); if (!/^data:image\/webp/.test(url)) url = c.toDataURL('image/jpeg', 0.9); } } catch (_) { url = ''; }
  if (made.size > 120) made.delete(made.keys().next().value);
  made.set(k, url); return url;
}
/** put the seal into a card's art box: key, kind, hue and rarity as the ink plate gets them. Never throws. */
export function sealArt(box, { key = '', kind = 'Idea', hue = null, rarity = null, nouns = null } = {}) {
  try {
    if (!box || box.classList.contains('has-photo') || box.querySelector(':scope > .vc-seal') || typeof document === 'undefined') return;
    let tries = 0;
    const go = () => {
      if (!box.isConnected || box.classList.contains('has-photo') || box.classList.contains('vc-forged') || box.querySelector(':scope > .vc-seal')) return; // a real picture or a painting arrived while this waited: it is the art
      if ((box.clientWidth || 0) < 120 && tries++ < 10) { setTimeout(go, 120); return; } // the card is still laying out
      const w = Math.max(160, Math.min(720, Math.round(box.clientWidth || 520))), h = Math.max(60, Math.min(400, Math.round(box.clientHeight || 150)));
      const url = sealUrl(sealPlan(key, { kind, hue, rarity, nouns }), w, h); if (!url) return;
      const im = document.createElement('img'); im.className = 'vc-seal'; im.alt = ''; im.decoding = 'async'; im.src = url;
      box.insertBefore(im, box.querySelector(':scope > .vc-forge-img, :scope > .vc-forge-btn')); box.classList.add('vc-sealed');
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 400 }); else setTimeout(go, 0);
  } catch (_) {}
}
